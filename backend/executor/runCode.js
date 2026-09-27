/**
 * Docker Sandbox Code Runner
 *
 * Reads CODE, LANG, INPUT from environment variables.
 * Compiles (if needed), runs, and outputs JSON result to stdout.
 *
 * Supported languages: python, cpp, c, java, javascript
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 5000; // 5 second execution timeout

const code = process.env.CODE || '';
const lang = (process.env.LANG || 'python').toLowerCase().trim();
const input = process.env.INPUT || '';

// Per-execution working directory is passed from the parent (runInDocker.js)
// as a UUID-keyed path to prevent concurrent runs from colliding.
// Falls back to the shared .work directory for backwards compatibility.
const WORK_DIR = process.env.WORK_DIR || path.join(__dirname, '.work');

// ─── Path sanitizer ───────────────────────────────────────────────────────────
// Strips absolute server paths from error messages so users NEVER see
// internal filesystem details like D:\Projects\AWT project\DevPrep\...

const PATH_PATTERNS = [
  // Escape the work dir path for use in regex (handles backslashes, spaces)
  new RegExp(WORK_DIR.replace(/[\\/]/g, '[/\\\\]').replace(/[.*+?^${}()|[\]]/g, '\\$&') + '[/\\\\]?[^\n"]*', 'gi'),
  // Any Windows absolute path e.g. C:\...  or  C:/...
  /[A-Za-z]:[/\\][^\n"']*/g,
  // Paths in stack trace parentheses e.g. (C:\path\file.js:1:1)
  /\([A-Za-z]:[/\\][^)\n]+\)/g,
  // Project-specific dir names as a fallback (catches partial paths)
  /(?:DevPrep|executor|\.work|AWT project)[/\\][^\n"']*/gi,
];

function sanitizeError(msg) {
  if (!msg) return '';
  let clean = String(msg);
  // First pass: named patterns
  for (const pattern of PATH_PATTERNS) {
    clean = clean.replace(pattern, '');
  }
  // Second pass: catch any remaining drive-letter paths
  clean = clean.replace(/[A-Za-z]:[/\\]\S+/g, '');
  return clean.trim();
}

// ─── Device Guard / Security policy detector ─────────────────────────────────
function isDeviceGuardError(msg) {
  if (!msg) return false;
  const m = String(msg).toLowerCase();
  return (
    m.includes('device guard') ||
    m.includes('your organization') ||
    m.includes('blocked by') ||
    m.includes('wldp') ||
    m.includes('code integrity')
  );
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf-8');
}

function run(command) {
  try {
    const result = execSync(command, {
      timeout: TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      cwd: WORK_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PATH: process.env.PATH }
    });
    return { stdout: result.toString('utf-8'), stderr: '' };
  } catch (err) {
    // Timeout
    if (err.killed || (err.signal && err.signal === 'SIGTERM')) {
      return { stdout: '', stderr: 'Time Limit Exceeded', timedOut: true };
    }

    const rawStderr = (err.stderr || '').toString('utf-8');
    const rawMsg    = err.message || '';

    // Device Guard — Windows blocks unsigned compiled executables
    if (isDeviceGuardError(rawStderr) || isDeviceGuardError(rawMsg)) {
      return {
        stdout: '',
        stderr: 'Execution blocked by system security policy (Device Guard). Compiled languages (C++/C/Java) cannot run in this environment. Please use JavaScript or Python.',
        timedOut: false,
        compileError: false,
        deviceGuard: true
      };
    }

    return {
      stdout: (err.stdout || '').toString('utf-8'),
      stderr: sanitizeError(rawStderr) || sanitizeError(rawMsg)
    };
  }
}

function execute() {
  ensureDir(WORK_DIR);

  const inputFile = path.join(WORK_DIR, 'input.txt');
  writeFile(inputFile, input);

  let result;

  switch (lang) {
    case 'python':
    case 'python3': {
      const codeFile = path.join(WORK_DIR, 'solution.py');
      writeFile(codeFile, code);
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      result = run(`${pyCmd} "${codeFile}" < "${inputFile}"`);
      // Sanitize Python tracebacks which include full file paths
      if (result.stderr) result.stderr = sanitizeError(result.stderr);
      break;
    }

    case 'cpp':
    case 'c++': {
      const codeFile = path.join(WORK_DIR, 'solution.cpp');
      const binFile  = path.join(WORK_DIR, 'solution');
      writeFile(codeFile, code);

      const compileResult = run(`g++ -o "${binFile}" "${codeFile}" -std=c++17 -O2`);
      if (compileResult.stderr) {
        result = {
          stdout: '',
          stderr: sanitizeError(compileResult.stderr),
          compileError: true
        };
        break;
      }

      result = run(`"${binFile}" < "${inputFile}"`);
      if (result.deviceGuard) break; // already has clean message
      if (result.stderr) result.stderr = sanitizeError(result.stderr);
      break;
    }

    case 'c': {
      const codeFile = path.join(WORK_DIR, 'solution.c');
      const binFile  = path.join(WORK_DIR, 'solution');
      writeFile(codeFile, code);

      const compileResult = run(`g++ -x c -o "${binFile}" "${codeFile}" -O2`);
      if (compileResult.stderr) {
        result = {
          stdout: '',
          stderr: sanitizeError(compileResult.stderr),
          compileError: true
        };
        break;
      }

      result = run(`"${binFile}" < "${inputFile}"`);
      if (result.deviceGuard) break;
      if (result.stderr) result.stderr = sanitizeError(result.stderr);
      break;
    }

    case 'java': {
      const codeFile = path.join(WORK_DIR, 'Main.java');
      writeFile(codeFile, code);

      const compileResult = run(`javac "${codeFile}"`);
      if (compileResult.stderr) {
        result = {
          stdout: '',
          stderr: sanitizeError(compileResult.stderr),
          compileError: true
        };
        break;
      }

      result = run(`java -cp "${WORK_DIR}" Main < "${inputFile}"`);
      if (result.deviceGuard) break;
      if (result.stderr) result.stderr = sanitizeError(result.stderr);
      break;
    }

    case 'javascript':
    case 'js':
    case 'node': {
      const codeFile = path.join(WORK_DIR, 'solution.js');
      writeFile(codeFile, code);
      result = run(`node "${codeFile}" < "${inputFile}"`);
      // Sanitize Node.js stack traces which include full paths
      if (result.stderr) result.stderr = sanitizeError(result.stderr);
      break;
    }

    default:
      result = { stdout: '', stderr: `Unsupported language: ${lang}` };
  }

  const output = {
    output:       (result.stdout || '').trimEnd(),
    error:        result.stderr  || '',
    timedOut:     result.timedOut     || false,
    compileError: result.compileError || false
  };

  process.stdout.write(JSON.stringify(output));
}

try {
  execute();
} catch (err) {
  process.stdout.write(JSON.stringify({
    output: '',
    error: sanitizeError(err.message) || 'An unexpected error occurred in the sandbox.',
    timedOut: false,
    compileError: false
  }));
}
