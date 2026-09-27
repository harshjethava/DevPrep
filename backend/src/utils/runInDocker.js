/**
 * Code execution launcher.
 *
 * Runs user code via executor/runCode.js in an isolated child process.
 *
 * SECURITY HARDENING (Phase 1):
 *  - Child process env is minimal: only CODE, INPUT, LANG, WORK_DIR, PATH
 *    and OS-level variables needed by compilers.
 *    ALL server secrets (MONGO_URI, GROQ_API_KEY, CLERK_SECRET_KEY, etc.)
 *    are deliberately excluded from the child process environment.
 *  - Each execution runs in its own UUID-named subdirectory of executor/.work
 *    to prevent concurrent users from overwriting each other source files.
 *  - An output sanitiser scrubs known secret values as a defence-in-depth
 *    measure in case a secret ever leaks through compiler/runtime output.
 */

const { exec } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const EXECUTOR_PATH = path.resolve(__dirname, '../../executor/runCode.js');
const WORK_BASE = path.resolve(__dirname, '../../executor/.work');
const TIMEOUT_MS = 15000;

// Capture secret values ONCE at module load so we can scrub them from output.
// These must be read before any chance of env mutation.
const SECRET_VALUES = [
  process.env.MONGO_URI,
  process.env.GROQ_API_KEY,
  process.env.CLERK_SECRET_KEY,
  process.env.CLERK_WEBHOOK_SECRET,
  process.env.RESEND_API_KEY,
  process.env.JWT_SECRET,
  process.env.HUGGINGFACE_API_KEY,
  process.env.GEMINI_API_KEY,
].filter((v) => v && v.length > 4);

function sanitizeOutput(str) {
  if (!str) return '';
  let out = String(str);
  for (const secret of SECRET_VALUES) {
    out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

function sanitizeResult(result) {
  return {
    output:       sanitizeOutput(result.output || ''),
    error:        sanitizeOutput(result.error  || ''),
    timedOut:     result.timedOut     || false,
    compileError: result.compileError || false,
  };
}

function tryParseJSON(str) {
  if (!str) return null;
  try {
    const obj = JSON.parse(str.trim());
    return {
      output:       obj.output       || '',
      error:        obj.error        || '',
      timedOut:     obj.timedOut     || false,
      compileError: obj.compileError || false,
    };
  } catch {
    return null;
  }
}

function cleanupWorkDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Build a minimal, secrets-free environment for the executor child process.
 * Only PATH and OS variables required by compilers are included.
 */
function buildChildEnv({ code, input, lang, workDir }) {
  const env = {
    CODE:     code,
    INPUT:    input,
    LANG:     lang,
    WORK_DIR: workDir,
    PATH:     process.env.PATH || '',
  };

  // Windows OS variables required for basic OS and compiler operations
  const windowsVars = [
    'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'SystemDrive',
    'WINDIR', 'COMSPEC', 'TEMP', 'TMP',
  ];
  for (const key of windowsVars) {
    if (process.env[key]) env[key] = process.env[key];
  }

  // Java home needed for javac/java on systems with non-default JDK paths
  if (process.env.JAVA_HOME) env.JAVA_HOME = process.env.JAVA_HOME;

  return env;
}

/**
 * Execute user code in an isolated child process.
 *
 * @param {Object} opts
 * @param {string} opts.code     - source code to execute
 * @param {string} opts.language - "python" | "cpp" | "c" | "java" | "javascript"
 * @param {string} [opts.input]  - stdin for the program
 * @returns {Promise<{output: string, error: string, timedOut: boolean, compileError: boolean}>}
 */
function runCode({ code, language, input = '' }) {
  return new Promise((resolve) => {
    const lang    = String(language).toLowerCase().trim();
    const execId  = crypto.randomUUID();
    const workDir = path.join(WORK_BASE, execId);
    const childEnv = buildChildEnv({ code, input, lang, workDir });

    exec(`node "${EXECUTOR_PATH}"`, {
      timeout:   TIMEOUT_MS,
      maxBuffer: 5 * 1024 * 1024,
      env:       childEnv,
    }, (err, stdout, stderr) => {
      // Always clean up the per-execution working directory
      cleanupWorkDir(workDir);

      if (err) {
        if (err.killed || err.signal === 'SIGTERM') {
          return resolve({ output: '', error: 'Execution timed out', timedOut: true, compileError: false });
        }
        const parsed = tryParseJSON(stdout);
        if (parsed) return resolve(sanitizeResult(parsed));
        return resolve({ output: '', error: sanitizeOutput(stderr || err.message || 'Execution failed'), timedOut: false, compileError: false });
      }

      const parsed = tryParseJSON(stdout);
      if (parsed) return resolve(sanitizeResult(parsed));

      // Fallback — executor output was not JSON
      resolve({
        output: sanitizeOutput(stdout.trim()),
        error:  sanitizeOutput(stderr || ''),
        timedOut:     false,
        compileError: false,
      });
    });
  });
}

module.exports = { runCode };
