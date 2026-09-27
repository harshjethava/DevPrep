const CodingProblem = require('../models/CodingProblem');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { runAgainstTestCases, executeCode } = require('../utils/judgeService');

/* ───────── helpers ───────── */

async function resolveUser(req) {
  // Clerk auth: req.auth.userId is the Clerk user ID
  if (req.auth && req.auth.userId) {
    const user = await User.findOne({ clerkUserId: req.auth.userId });
    return user;
  }
  // JWT auth fallback
  if (req.user) return req.user;
  return null;
}

/* ───────── GET /problems ───────── */

async function listProblems(req, res, next) {
  try {
    const {
      difficulty,
      category,
      tags,
      q,
      page = 1,
      limit = 20,
      sort = 'recent'
    } = req.query;

    const filter = {};
    if (difficulty) filter.difficulty = String(difficulty);
    if (category) filter.category = { $regex: `^${String(category)}$`, $options: 'i' };
    if (tags) {
      const tagList = String(tags).split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length) filter.tags = { $in: tagList };
    }
    if (q) {
      const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } }
      ];
    }

    // Sort options
    let sortObj = { createdAt: -1 };
    if (sort === 'difficulty') {
      sortObj = { difficulty: 1, createdAt: -1 };
    } else if (sort === 'popularity') {
      sortObj = { acceptanceRate: -1, createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [problems, total] = await Promise.all([
      CodingProblem.find(filter)
        .sort(sortObj)
        .select('title slug difficulty category tags acceptanceRate totalSubmissions createdAt source sourceId')
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CodingProblem.countDocuments(filter)
    ]);

    // Get user completion status for these problems
    const user = await resolveUser(req);
    let statusMap = {};
    if (user) {
      const problemIds = problems.map((p) => p._id);
      const submissions = await Submission.find({
        $or: [
          { userId: user._id, problemId: { $in: problemIds }, isDraft: false },
          { clerkUserId: user.clerkUserId || '___', problemId: { $in: problemIds }, isDraft: false }
        ]
      })
        .select('problemId status')
        .lean();

      for (const sub of submissions) {
        const pid = String(sub.problemId);
        if (sub.status === 'accepted') {
          statusMap[pid] = 'accepted';
        } else if (!statusMap[pid]) {
          statusMap[pid] = 'attempted';
        }
      }
    }

    const enriched = problems.map((p) => ({
      ...p,
      userStatus: statusMap[String(p._id)] || 'not_attempted'
    }));

    res.status(200).json({
      problems: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── GET /problems/:id ───────── */

async function getProblem(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id)
      .select('-solution')
      .lean();

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    // Filter out hidden test cases
    if (problem.testCases) {
      problem.testCases = problem.testCases.filter((tc) => !tc.isHidden);
    }

    // Get user's latest draft if exists
    const user = await resolveUser(req);
    let draft = null;
    if (user) {
      draft = await Submission.findOne({
        $or: [
          { userId: user._id, problemId: problem._id, isDraft: true },
          { clerkUserId: user.clerkUserId || '___', problemId: problem._id, isDraft: true }
        ]
      })
        .sort({ updatedAt: -1 })
        .select('code language updatedAt')
        .lean();
    }

    // Convert starterCode Map to plain object
    let starterCode = {};
    if (problem.starterCode) {
      if (problem.starterCode instanceof Map) {
        starterCode = Object.fromEntries(problem.starterCode);
      } else if (typeof problem.starterCode === 'object') {
        starterCode = problem.starterCode;
      }
    }

    res.status(200).json({
      problem: {
        ...problem,
        starterCode
      },
      draft
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── POST /problems/:id/run ───────── */

async function runCode(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id).lean();

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const { language = 'javascript', code = '', customInput } = req.body;

    // If custom input is provided, run with that single input
    if (customInput !== undefined && customInput !== null) {
      const result = await executeCode(language, code, String(customInput));
      return res.status(200).json({
        run: {
          problemId: problem._id,
          language,
          results: [
            {
              input: String(customInput),
              actualOutput: (result.stdout || '').trim(),
              expectedOutput: null,
              passed: null,
              status: result.status,
              time: result.time,
              memory: result.memory,
              stderr: result.stderr,
              compileOutput: result.compileOutput
            }
          ],
          passedCount: null,
          totalCount: 1
        }
      });
    }

    // Run against sample test cases only (non-hidden)
    const sampleTests = (problem.testCases || []).filter((tc) => !tc.isHidden);
    if (!sampleTests.length) {
      return res.status(200).json({
        run: {
          problemId: problem._id,
          language,
          results: [],
          passedCount: 0,
          totalCount: 0,
          message: 'No sample test cases available'
        }
      });
    }

    const { results, passedCount, totalCount } = await runAgainstTestCases(
      language,
      code,
      sampleTests
    );

    res.status(200).json({
      run: {
        problemId: problem._id,
        language,
        results,
        passedCount,
        totalCount
      }
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── POST /problems/:id/submit ───────── */

async function submitSolution(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id).lean();

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const user = await resolveUser(req);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    const { language = 'javascript', code = '' } = req.body;

    // Run against ALL test cases (including hidden)
    const allTests = problem.testCases || [];
    if (!allTests.length) {
      return res.status(200).json({
        message: 'No test cases available to judge',
        result: {
          problemId: problem._id,
          language,
          status: 'accepted',
          passedTests: 0,
          totalTests: 0
        }
      });
    }

    const { results, passedCount, totalCount, overallStatus } =
      await runAgainstTestCases(language, code, allTests);

    // Save submission
    const submission = await Submission.create({
      userId: user._id,
      clerkUserId: user.clerkUserId || '',
      problemId: problem._id,
      language,
      code,
      status: overallStatus,
      passedTests: passedCount,
      totalTests: totalCount,
      runtime: results[0]?.time || '0',
      memory: results[0]?.memory || '0',
      errorOutput: results.find((r) => r.stderr || r.compileOutput)?.stderr ||
        results.find((r) => r.compileOutput)?.compileOutput || '',
      isDraft: false
    });

    // Update problem stats atomically in one operation.
    // We already know: totalSubmissions (pre-update) and overallStatus.
    // Compute the new counts locally to derive acceptanceRate without a second DB round-trip.
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

    // Return result — do NOT expose hidden test case inputs/expected outputs
    const safeResults = results.map((r, i) => {
      const isHidden = allTests[i]?.isHidden;
      return {
        passed: r.passed,
        status: r.status,
        time: r.time,
        memory: r.memory,
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
      message: overallStatus === 'accepted' ? 'All test cases passed!' : 'Some test cases failed',
      result: {
        submissionId: submission._id,
        problemId: problem._id,
        language,
        status: overallStatus,
        passedTests: passedCount,
        totalTests: totalCount,
        runtime: results[0]?.time || '0',
        memory: results[0]?.memory || '0',
        results: safeResults
      }
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── POST /problems/:id/save-draft ───────── */

async function saveDraft(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id).select('_id').lean();

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const user = await resolveUser(req);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    const { language = 'javascript', code = '' } = req.body;

    const draft = await Submission.findOneAndUpdate(
      {
        userId: user._id,
        problemId: problem._id,
        isDraft: true
      },
      {
        userId: user._id,
        clerkUserId: user.clerkUserId || '',
        problemId: problem._id,
        language,
        code,
        status: 'draft',
        isDraft: true
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: 'Draft saved',
      draft: {
        _id: draft._id,
        language: draft.language,
        updatedAt: draft.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── GET /problems/:id/status ───────── */

async function getUserStatus(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    const submissions = await Submission.find({
      userId: user._id,
      problemId: req.params.id,
      isDraft: false
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('language status passedTests totalTests runtime memory createdAt')
      .lean();

    const hasAccepted = submissions.some((s) => s.status === 'accepted');

    res.status(200).json({
      status: hasAccepted ? 'accepted' : submissions.length ? 'attempted' : 'not_attempted',
      submissions
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProblems,
  getProblem,
  submitSolution,
  runCode,
  saveDraft,
  getUserStatus
};
