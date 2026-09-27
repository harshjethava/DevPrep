/**
 * executionLimiter.js
 *
 * In-process semaphore that caps the number of simultaneously running
 * code-execution child processes.
 *
 * Each call to executeCode() or runAgainstTestCases() spawns one or more
 * child processes.  Without a limit, a burst of 50 concurrent submissions
 * would fork 50+ processes simultaneously, exhausting RAM and CPU and likely
 * crashing the Render free tier (512 MB RAM).
 *
 * We use p-limit (v3, CommonJS-compatible) to restrict concurrency to
 * MAX_CONCURRENT_EXECUTIONS at a time.  Additional requests queue behind
 * the semaphore and are served in order as slots free up.
 *
 * Usage (Express middleware):
 *   const { executionLimiter } = require('./executionLimiter');
 *   router.post('/run', clerkAuth, executionLimiter, handler);
 */

const pLimit = require('p-limit');

// Maximum simultaneous code execution child processes.
// Set via env var for easy tuning; default 4 suits a 1-vCPU Render instance.
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '4', 10);

const limit = pLimit(MAX_CONCURRENT);

/**
 * Express middleware that queues the request through the semaphore before
 * proceeding to the next handler.  The actual execution happens downstream;
 * this middleware just ensures at most MAX_CONCURRENT requests run at once.
 *
 * If the queue is already full (more than MAX_QUEUE requests waiting),
 * we reject immediately with 429 rather than letting requests pile up
 * indefinitely and time out after 15 s with no useful error.
 */
const MAX_QUEUE = parseInt(process.env.MAX_EXECUTION_QUEUE || '20', 10);

function executionLimiter(req, res, next) {
  // p-limit exposes the number of tasks currently waiting in the queue
  if (limit.pendingCount >= MAX_QUEUE) {
    return res.status(429).json({
      error: 'Server is busy',
      message: 'Too many code executions queued. Please try again in a moment.',
      retryAfter: 5
    });
  }

  // Wrap next() in the limiter.  When a slot opens, the limiter calls the
  // wrapped function which resumes Express's handler chain.
  limit(() =>
    new Promise((resolve) => {
      // Intercept res.end / res.json / res.send to know when the response
      // is done so we can release the semaphore slot.
      const originalEnd = res.end.bind(res);
      res.end = (...args) => {
        resolve();
        return originalEnd(...args);
      };
      next();
    })
  ).catch((err) => {
    // Unexpected error inside the limiter — pass to Express error handler
    next(err);
  });
}

module.exports = { executionLimiter, limit };
