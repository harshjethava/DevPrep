/**
 * Judge Service — Docker-based code execution.
 *
 * Drop-in replacement for the Judge0 API version.
 * Exports the same interface: executeCode(), runAgainstTestCases()
 */

const path = require('path');
const { runCode: dockerRunCode } = require('./runInDocker');

const SUPPORTED_LANGUAGES = new Set([
  'javascript', 'js', 'node',
  'python', 'python3',
  'cpp', 'c++',
  'c',
  'java'
]);

// ─── Path sanitizer (second layer of defence) ─────────────────────────────────
// Even if the executor leaks a path, this catches it before the API response
// reaches the client.
const BACKEND_ROOT = path.resolve(__dirname, '../..');

const SERVER_PATH_PATTERNS = [
  // Match the backend root and any subpath (forward or back slashes)
  new RegExp(
    BACKEND_ROOT.replace(/[\\/]/g, '[/\\\\]').replace(/[.*+?^${}()|[\]]/g, '\\$&') + '[/\\\\]?[^\n"]*',
    'gi'
  ),
  // Any Windows absolute path  e.g. C:\Users\...  or  C:/Users/...
  /[A-Za-z]:[/\\][^\n"']*/g,
  // Partial paths leaking in Node.js stack traces: "at Object.<anonymous> (path/to/file.js:1:1)"
  // Match filename paths inside parentheses in stack frames
  /\(([A-Za-z]:[/\\][^)\n]+)\)/g,
  // Paths with project-specific dir names (project name as fallback)
  /(?:DevPrep|executor|AWT project)[/\\][^\n"']*/gi,
];

function sanitizeServerPaths(msg) {
  if (!msg) return '';
  let clean = String(msg);
  // First pass: replace full path matches
  for (const pattern of SERVER_PATH_PATTERNS) {
    clean = clean.replace(pattern, '<sandbox>');
  }
  // Second pass: strip any remaining absolute path fragments (starts with drive letter)
  clean = clean.replace(/[A-Za-z]:[/\\]\S+/g, '<sandbox>');
  return clean;
}

/**
 * Execute code with given stdin input.
 *
 * @param {string} language
 * @param {string} sourceCode
 * @param {string} stdin
 * @returns {{ stdout, stderr, status, time, memory, compileOutput }}
 */
async function executeCode(language, sourceCode, stdin = '') {
  const lang = String(language).toLowerCase().trim();

  if (!SUPPORTED_LANGUAGES.has(lang)) {
    return {
      stdout: '',
      stderr: `Unsupported language: ${language}`,
      status: 'error',
      time: '0',
      memory: '0',
      compileOutput: ''
    };
  }

  const start = Date.now();
  const result = await dockerRunCode({ code: sourceCode, language: lang, input: stdin });
  const elapsed = ((Date.now() - start) / 1000).toFixed(3);

  // Sanitize any paths that leaked through from the executor
  const cleanError = sanitizeServerPaths(result.error || '');

  // Map Docker result to the standard judge interface
  if (result.timedOut) {
    return {
      stdout: '',
      stderr: 'Time Limit Exceeded',
      status: 'time_limit',
      time: elapsed,
      memory: '0',
      compileOutput: ''
    };
  }

  if (result.compileError) {
    return {
      stdout: '',
      stderr: cleanError,
      status: 'compile_error',
      time: elapsed,
      memory: '0',
      compileOutput: cleanError
    };
  }

  if (result.error && !result.output) {
    return {
      stdout: '',
      stderr: cleanError,
      status: 'runtime_error',
      time: elapsed,
      memory: '0',
      compileOutput: ''
    };
  }

  return {
    stdout: result.output,
    stderr: cleanError,
    status: 'accepted',
    time: elapsed,
    memory: '0',
    compileOutput: ''
  };
}

/**
 * Compare user output to expected output.
 * Trims whitespace, normalises line endings.
 */
function compareOutput(userOutput, expectedOutput) {
  const normalize = (s) =>
    String(s || '')
      .replace(/\r\n/g, '\n')
      .trim();
  return normalize(userOutput) === normalize(expectedOutput);
}

/**
 * Run code against an array of test cases, compare outputs.
 *
 * @param {string} language
 * @param {string} sourceCode
 * @param {Array<{input: string, expectedOutput: string}>} testCases
 * @returns {{ results, passedCount, totalCount, overallStatus }}
 */
async function runAgainstTestCases(language, sourceCode, testCases) {
  const results = [];
  let passedCount = 0;

  for (const tc of testCases) {
    const execResult = await executeCode(language, sourceCode, tc.input);

    const actualOutput   = (execResult.stdout || '').trim();
    const expectedOutput = (tc.expectedOutput || '').trim();
    const passed =
      execResult.status === 'accepted' && compareOutput(actualOutput, expectedOutput);

    if (passed) passedCount++;

    results.push({
      input: tc.input,
      expectedOutput,
      actualOutput,
      passed,
      status: passed
        ? 'accepted'
        : execResult.status === 'accepted'
          ? 'wrong_answer'
          : execResult.status,
      time: execResult.time,
      memory: execResult.memory,
      stderr: execResult.stderr,
      compileOutput: execResult.compileOutput
    });

    // Stop early on compile error (all subsequent tests will fail the same way)
    if (execResult.status === 'compile_error') break;
  }

  // Determine overall status: use the most severe failure across all results.
  // Priority: compile_error > time_limit > memory_limit > runtime_error > wrong_answer > accepted
  const SEVERITY = { compile_error: 5, time_limit: 4, memory_limit: 3, runtime_error: 2, wrong_answer: 1, accepted: 0 };
  let overallStatus = 'accepted';
  if (passedCount < testCases.length) {
    for (const r of results) {
      if (!r.passed) {
        const s = r.status || 'wrong_answer';
        if ((SEVERITY[s] || 0) > (SEVERITY[overallStatus] || 0)) {
          overallStatus = s;
        }
      }
    }
    // Ensure we never return 'accepted' when some tests failed
    if (overallStatus === 'accepted') overallStatus = 'wrong_answer';
  }

  return {
    results,
    passedCount,
    totalCount: testCases.length,
    overallStatus
  };
}

module.exports = {
  executeCode,
  runAgainstTestCases,
  compareOutput
};
