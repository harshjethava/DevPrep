const mongoose = require('mongoose');

const MockInterviewSession = require('../models/MockInterviewSession');
const SavedQuestion = require('../models/SavedQuestion');
const Resume = require('../models/Resume');
const Submission = require('../models/Submission');
const CodingProblem = require('../models/CodingProblem');

/* ─────────────────────────────────────────
   Interview analytics (existing endpoints)
───────────────────────────────────────── */

async function getOverview(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // FIX: Use MockInterviewSession (active model) instead of the dead InterviewSession model.
    // MockInterviewSession stores evaluation scores in evaluation.overallScore.
    const total = await MockInterviewSession.countDocuments({ userId });
    const completed = await MockInterviewSession.countDocuments({ userId, status: 'completed' });

    const avgAgg = await MockInterviewSession.aggregate([
      { $match: { userId, status: 'completed', 'evaluation.overallScore': { $ne: null } } },
      { $group: { _id: null, averageScore: { $avg: '$evaluation.overallScore' } } }
    ]);

    const averageScore = avgAgg.length ? Math.round(avgAgg[0].averageScore * 10) / 10 : null;

    const byType = await MockInterviewSession.aggregate([
      { $match: { userId } },
      { $group: { _id: '$interviewType', count: { $sum: 1 } } },
      { $project: { _id: 0, type: '$_id', count: 1 } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      overview: { totalInterviews: total, completedInterviews: completed, averageScore, byType }
    });
  } catch (err) {
    next(err);
  }
}

async function getPerformance(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // FIX: Query MockInterviewSession and read from evaluation.overallScore.
    const points = await MockInterviewSession.aggregate([
      { $match: { userId, status: 'completed', 'evaluation.overallScore': { $ne: null } } },
      { $sort: { createdAt: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          overallScore: '$evaluation.overallScore',
          type: '$interviewType'
        }
      },
      {
        $group: {
          _id: '$date',
          averageScore: { $avg: '$overallScore' },
          sessions: { $sum: 1 }
        }
      },
      { $project: { _id: 0, date: '$_id', averageScore: { $round: ['$averageScore', 1] }, sessions: 1 } },
      { $sort: { date: 1 } },
      { $limit: 365 }
    ]);

    res.status(200).json({ performance: { points } });
  } catch (err) {
    next(err);
  }
}

async function getTopics(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // FIX: Query MockInterviewSession using selectedTopics array (replaces dead 'topics' field).
    const topics = await MockInterviewSession.aggregate([
      {
        $match: {
          userId,
          status: 'completed',
          'evaluation.overallScore': { $ne: null },
          selectedTopics: { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$selectedTopics' },
      {
        $group: {
          _id: '$selectedTopics',
          averageScore: { $avg: '$evaluation.overallScore' },
          sessions: { $sum: 1 }
        }
      },
      { $project: { _id: 0, topic: '$_id', averageScore: { $round: ['$averageScore', 1] }, sessions: 1 } },
      { $sort: { averageScore: 1 } },
      { $limit: 50 }
    ]);

    res.status(200).json({ topics });
  } catch (err) {
    next(err);
  }
}

/* ─────────────────────────────────────────
   Coding analytics (new LeetCode-style)
───────────────────────────────────────── */

/**
 * GET /api/analytics/coding-stats
 * Returns: totalSolved, easySolved, mediumSolved, hardSolved,
 *          totalProblems (of each difficulty), acceptanceRate
 */
async function getCodingStats(req, res, next) {
  try {
    const clerkUserId = req.user.clerkUserId;
    const userId = req.user._id;

    // Match field: prefer clerkUserId if set, otherwise userId
    const matchUser = clerkUserId
      ? { $or: [{ clerkUserId }, { userId: new mongoose.Types.ObjectId(userId) }] }
      : { userId: new mongoose.Types.ObjectId(userId) };

    // Accepted submissions per problem (deduplicated by problem)
    const solvedAgg = await Submission.aggregate([
      { $match: { ...matchUser, status: 'accepted', isDraft: false } },
      { $group: { _id: '$problemId' } }, // unique problems solved
      {
        $lookup: {
          from: 'codingproblems',
          localField: '_id',
          foreignField: '_id',
          as: 'problem'
        }
      },
      { $unwind: '$problem' },
      { $group: { _id: '$problem.difficulty', count: { $sum: 1 } } }
    ]);

    // Total submissions vs accepted (for acceptance rate)
    const totalSubAgg = await Submission.aggregate([
      { $match: { ...matchUser, isDraft: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          accepted: {
            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
          }
        }
      }
    ]);

    // Total problems in DB per difficulty
    const totalProblemsAgg = await CodingProblem.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);

    // Build difficulty map
    const solvedMap = { easy: 0, medium: 0, hard: 0 };
    solvedAgg.forEach(({ _id, count }) => {
      const k = typeof _id === 'string' ? _id.toLowerCase() : _id;
      if (k in solvedMap) solvedMap[k] = count;
    });

    const totalMap = { easy: 0, medium: 0, hard: 0 };
    totalProblemsAgg.forEach(({ _id, count }) => {
      const k = typeof _id === 'string' ? _id.toLowerCase() : _id;
      if (k in totalMap) totalMap[k] = count;
    });

    const totalSolved = solvedMap.easy + solvedMap.medium + solvedMap.hard;
    const totalProblems = totalMap.easy + totalMap.medium + totalMap.hard;

    const subStats = totalSubAgg[0] || { total: 0, accepted: 0 };
    const acceptanceRate =
      subStats.total > 0
        ? Math.round((subStats.accepted / subStats.total) * 100)
        : 0;

    res.status(200).json({
      codingStats: {
        totalSolved,
        totalProblems,
        easySolved: solvedMap.easy,
        mediumSolved: solvedMap.medium,
        hardSolved: solvedMap.hard,
        totalEasy: totalMap.easy,
        totalMedium: totalMap.medium,
        totalHard: totalMap.hard,
        totalSubmissions: subStats.total,
        acceptedSubmissions: subStats.accepted,
        acceptanceRate
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/profile-insights
 * Returns aggregated profile analytics for charts on the profile page.
 */
async function getProfileInsights(req, res, next) {
  try {
    const clerkUserId = req.user.clerkUserId;
    const userId = req.user._id;

    const matchUser = clerkUserId
      ? { $or: [{ clerkUserId }, { userId: new mongoose.Types.ObjectId(userId) }] }
      : { userId: new mongoose.Types.ObjectId(userId) };

    const [
      languageUsage,
      solvedCategories,
      mockByType,
      mockScoreAgg,
      totalMockSessions,
      totalResumeInterviews,
      totalSolvedCoding,
      resumeCount,
      savedByDifficulty,
      savedByRole,
      questionGeneratorStats
    ] = await Promise.all([
      Submission.aggregate([
        { $match: { ...matchUser, isDraft: false } },
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $project: { _id: 0, language: '$_id', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Submission.aggregate([
        { $match: { ...matchUser, status: 'accepted', isDraft: false } },
        { $group: { _id: '$problemId' } },
        {
          $lookup: {
            from: 'codingproblems',
            localField: '_id',
            foreignField: '_id',
            as: 'problem'
          }
        },
        { $unwind: '$problem' },
        { $group: { _id: '$problem.category', count: { $sum: 1 } } },
        { $project: { _id: 0, category: '$_id', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      MockInterviewSession.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $project: { interviewType: { $toLower: '$interviewType' } } },
        { $group: { _id: '$interviewType', count: { $sum: 1 } } },
        { $project: { _id: 0, type: '$_id', count: 1 } },
        { $sort: { count: -1 } }
      ]),
      MockInterviewSession.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: 'completed',
            'evaluation.overallScore': { $ne: null }
          }
        },
        { $group: { _id: null, averageScore: { $avg: '$evaluation.overallScore' } } }
      ]),
      MockInterviewSession.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
      MockInterviewSession.countDocuments({ userId: new mongoose.Types.ObjectId(userId), interviewType: 'resume-based' }),
      Submission.distinct('problemId', { ...matchUser, status: 'accepted', isDraft: false }).then(ids => ids.length),
      Resume.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
      Submission.aggregate([
        { $match: { ...matchUser, isDraft: false } },
        { $group: { _id: '$problemId' } },
        {
          $lookup: {
            from: 'codingproblems',
            localField: '_id',
            foreignField: '_id',
            as: 'problem'
          }
        },
        { $unwind: '$problem' },
        { $project: { difficulty: { $toLower: '$problem.difficulty' } } },
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
        { $project: { _id: 0, difficulty: '$_id', count: 1 } },
        { $sort: { count: -1 } }
      ]),
      SavedQuestion.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $project: { role: { $toLower: '$role' } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $project: { _id: 0, role: '$_id', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      SavedQuestion.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $unwind: { path: '$topics', preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $toLower: '$topics' }, count: { $sum: 1 } } },
        { $project: { _id: 0, topic: '$_id', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const averageMockScore = mockScoreAgg.length ? mockScoreAgg[0].averageScore : null;

    res.status(200).json({
      insights: {
        languageUsage,
        solvedCategories,
        questionGeneratorStats,
        mock: {
          totalSessions: totalMockSessions,
          resumeInterviews: totalResumeInterviews,
          byType: mockByType,
          averageScore: averageMockScore
        },
        coding: {
          totalSolved: totalSolvedCoding
        },
        resume: {
          uploadedCount: resumeCount
        },
        savedQuestions: {
          byDifficulty: savedByDifficulty,
          byRole: savedByRole
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/submission-activity
 * Returns: array of { date: 'YYYY-MM-DD', count: N } for last 365 days
 */
async function getSubmissionActivity(req, res, next) {
  try {
    const clerkUserId = req.user.clerkUserId;
    const userId = req.user._id;

    const matchUser = clerkUserId
      ? { $or: [{ clerkUserId }, { userId: new mongoose.Types.ObjectId(userId) }] }
      : { userId: new mongoose.Types.ObjectId(userId) };

    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const activity = await Submission.aggregate([
      {
        $match: {
          ...matchUser,
          isDraft: false,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } }
    ]);

    res.status(200).json({ activity });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/streak
 * Returns: { currentStreak, longestStreak, lastActiveDate }
 */
async function getStreakData(req, res, next) {
  try {
    const clerkUserId = req.user.clerkUserId;
    const userId = req.user._id;

    const matchUser = clerkUserId
      ? { $or: [{ clerkUserId }, { userId: new mongoose.Types.ObjectId(userId) }] }
      : { userId: new mongoose.Types.ObjectId(userId) };

    // Get all unique active days (any submission)
    const days = await Submission.aggregate([
      { $match: { ...matchUser, isDraft: false } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dateStrings = days.map((d) => d._id);

    if (!dateStrings.length) {
      return res.status(200).json({ streak: { currentStreak: 0, longestStreak: 0, lastActiveDate: null } });
    }

    // Calculate streaks
    let longestStreak = 1;
    let currentRun = 1;

    for (let i = 1; i < dateStrings.length; i++) {
      const prev = new Date(dateStrings[i - 1]);
      const curr = new Date(dateStrings[i]);
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentRun++;
        longestStreak = Math.max(longestStreak, currentRun);
      } else {
        currentRun = 1;
      }
    }

    // Current streak: check if last active day is today or yesterday
    const lastDate = new Date(dateStrings[dateStrings.length - 1]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffFromToday = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));

    let currentStreak = 0;
    if (diffFromToday <= 1) {
      // Walk backwards to count current streak
      currentStreak = 1;
      for (let i = dateStrings.length - 2; i >= 0; i--) {
        const prev = new Date(dateStrings[i]);
        const curr = new Date(dateStrings[i + 1]);
        const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    res.status(200).json({
      streak: {
        currentStreak,
        longestStreak,
        lastActiveDate: dateStrings[dateStrings.length - 1]
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getRecentActivity(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Quizzes (Saved Questions grouped by quiz configuration)
    // We'll just fetch latest 10 saved questions and group them, or just fetch the raw SavedQuestions.
    // Actually, each SavedQuestion is a single question. A user saves a whole quiz at once.
    // So if we group by topic/difficulty/role:
    const quizzes = await mongoose.model('SavedQuestion').aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: { role: '$role', difficulty: '$difficulty', topic: { $arrayElemAt: ['$topics', 0] } },
          lastSavedAt: { $max: '$updatedAt' }
        }
      },
      { $sort: { lastSavedAt: -1 } },
      { $limit: 10 }
    ]);
    
    const quizActivity = quizzes.map(q => ({
      type: 'quiz',
      title: `Quiz: ${q._id.topic || 'General'}`,
      meta: `${q._id.role || 'Role'}${q._id.difficulty ? ` • ${q._id.difficulty}` : ''}`,
      timestamp: q.lastSavedAt
    }));

    // 2. Mock / Resume Interviews
    const interviews = await mongoose.model('MockInterviewSession').find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
      
    const interviewActivity = interviews.map(i => ({
      type: i.interviewType === 'resume' ? 'resume' : 'mock',
      title: i.interviewType === 'resume' ? 'Resume Interview' : 'Mock Interview',
      meta: `${i.jobRole || 'Role'}${i.jobExperience ? ` • ${i.jobExperience}` : ''}`,
      timestamp: i.createdAt
    }));

    // 3. Coding Submissions
    const submissions = await mongoose.model('Submission').aggregate([
      { $match: { userId, isDraft: false } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$problemId', // latest submission per problem
          doc: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'codingproblems',
          localField: 'problemId',
          foreignField: '_id',
          as: 'problem'
        }
      },
      { $unwind: '$problem' }
    ]);

    const codingActivity = submissions.map(s => ({
      type: 'coding',
      title: `Coding: ${s.problem.title}`,
      meta: `${s.status === 'accepted' ? 'Solved' : 'Attempted'} • ${s.problem.difficulty}`,
      timestamp: s.createdAt
    }));

    // Combine and sort
    const combined = [...quizActivity, ...interviewActivity, ...codingActivity]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 15);

    res.status(200).json({ activity: combined });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
  getPerformance,
  getTopics,
  getCodingStats,
  getSubmissionActivity,
  getStreakData,
  getProfileInsights,
  getRecentActivity
};
