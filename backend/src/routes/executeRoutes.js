const express = require('express');
const { body } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { executionLimiter } = require('../middleware/executionLimiter');
const CodingProblem = require('../models/CodingProblem');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { executeCode, runAgainstTestCases } = require('../utils/judgeService');

const router = express.Router();
const clerkAuth = clerkAuthMiddleware();

/* ───────── helpers ───────── */

async function resolveUser(req) {
  if (req.auth && req.auth.userId) {
    return User.findOne({ clerkUserId: req.auth.userId });
  }
  if (req.user) return req.user;
  return null;
}

/* ───────── POST /run ───────── */

router.post(
  '/run',
  clerkAuth,
  executionLimiter,
  [
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('language').optional().isString().withMessage('Language must be a string'),
    body('input').optional().isString().withMessage('Input must be a string')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { code, language = 'python', input = '' } = req.body;

      const result = await executeCode(language, code, input);

      res.status(200).json({
        output: result.stdout,
        error: result.stderr || result.compileOutput || '',
        status: result.status,
        executionTime: result.time
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ───────── POST /submit ───────── */

router.post(
  '/submit',
  clerkAuth,
  executionLimiter,
  [
    body('problemId').trim().notEmpty().withMessage('Problem ID is required'),
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('language').optional().isString().withMessage('Language must be a string')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { problemId, code, language = 'python' } = req.body;

      // Fetch problem with all test cases (including hidden)
      const problem = await CodingProblem.findById(problemId).lean();
      if (!problem) {
        res.status(404);
        throw new Error('Problem not found');
      }

      const allTests = problem.testCases || [];
      if (!allTests.length) {
        return res.status(200).json({
          status: 'Accepted',
          passedCount: 0,
          totalCount: 0,
          executionTime: '0',
          message: 'No test cases available'
        });
      }

      // Run against ALL test cases
      const { results, passedCount, totalCount, overallStatus } =
        await runAgainstTestCases(language, code, allTests);

      // Map internal status to user-friendly label
      const statusLabel =
        overallStatus === 'accepted' ? 'Accepted' :
        overallStatus === 'wrong_answer' ? 'Wrong Answer' :
        overallStatus === 'runtime_error' ? 'Runtime Error' :
        overallStatus === 'compile_error' ? 'Compilation Error' :
        overallStatus === 'time_limit' ? 'Time Limit Exceeded' :
        'Error';

      // Save submission to DB
      const user = await resolveUser(req);
      if (user) {
        await Submission.create({
          userId: user._id,
          clerkUserId: user.clerkUserId || '',
          problemId: problem._id,
          language,
          code,
          status: overallStatus,
          passedTests: passedCount,
          totalTests: totalCount,
          runtime: results[0]?.time || '0',
          memory: '0',
          errorOutput:
            results.find((r) => r.stderr || r.compileOutput)?.stderr ||
            results.find((r) => r.compileOutput)?.compileOutput || '',
          isDraft: false
        });

        // Update problem stats atomically (same fix as codingController.js)
        const prevTotal = problem.totalSubmissions || 0;
        const prevAccepted = problem.totalAccepted || 0;
        const newTotal = prevTotal + 1;
        const newAccepted = prevAccepted + (overallStatus === 'accepted' ? 1 : 0);
        const newAcceptanceRate = newTotal > 0 ? Math.round((newAccepted / newTotal) * 100) : 0;

        await CodingProblem.findByIdAndUpdate(problem._id, {
          $inc: {
            totalSubmissions: 1,
            totalAccepted: overallStatus === 'accepted' ? 1 : 0
          },
          acceptanceRate: newAcceptanceRate
        });
      }

      // Return result — do NOT expose hidden test case inputs
      const safeResults = results.map((r, i) => {
        const isHidden = allTests[i]?.isHidden;
        return {
          passed: r.passed,
          status: r.status,
          time: r.time,
          ...(isHidden
            ? {}
            : {
                input: r.input,
                expectedOutput: r.expectedOutput,
                actualOutput: r.actualOutput
              }),
          stderr: r.stderr,
          compileOutput: r.compileOutput
        };
      });

      res.status(200).json({
        status: statusLabel,
        passedCount,
        totalCount,
        executionTime: results[0]?.time || '0',
        results: safeResults,
        // Also include fields the frontend expects from codingController
        result: {
          problemId: problem._id,
          language,
          status: overallStatus,
          passedTests: passedCount,
          totalTests: totalCount,
          runtime: results[0]?.time || '0',
          memory: '0',
          results: safeResults
        },
        message: overallStatus === 'accepted'
          ? 'All test cases passed!'
          : 'Some test cases failed'
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
