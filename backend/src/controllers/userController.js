const mongoose = require('mongoose');
const User = require('../models/User');
const MockInterviewSession = require('../models/MockInterviewSession');
const Submission = require('../models/Submission');
const CodingProblem = require('../models/CodingProblem');

/* ─────────────── Existing profile endpoints ─────────────── */

async function getProfile(req, res, next) {
  try {
    const user = req.user;
    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        skills: user.skills,
        targetRole: user.targetRole,
        experienceLevel: user.experienceLevel,
        bio: user.bio,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const user = req.user;
    const allowed = ['name', 'username', 'skills', 'targetRole', 'experienceLevel', 'bio', 'avatar'];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        user[key] = req.body[key];
      }
    }

    await user.save();

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        skills: user.skills,
        targetRole: user.targetRole,
        experienceLevel: user.experienceLevel,
        bio: user.bio,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const userId = req.user._id;

    const totalInterviews = await MockInterviewSession.countDocuments({ userId });
    const completedInterviews = await MockInterviewSession.countDocuments({ userId, status: 'completed' });

    const agg = await MockInterviewSession.aggregate([
      { $match: { userId, status: 'completed', overallScore: { $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: '$overallScore' } } }
    ]);

    const averageScore = agg.length ? agg[0].avgScore : null;

    res.status(200).json({ stats: { totalInterviews, completedInterviews, averageScore } });
  } catch (err) {
    next(err);
  }
}

/* ─────────────── New: User search (public, no auth) ─────────────── */

/**
 * GET /api/users/search?q=<query>
 * Searches users by name or username prefix (case-insensitive)
 * Returns up to 8 public user snippets
 */
async function searchUsers(req, res, next) {
  try {
    const q = (req.query.q || '').trim();

    if (q.length < 2) {
      return res.status(200).json({ users: [] });
    }

    const regex = new RegExp(q, 'i');

    const users = await User.find({
      $or: [{ name: regex }, { username: regex }]
    })
      .select('name username avatar experienceLevel')
      .limit(8)
      .lean();

    res.status(200).json({
      users: users.map((u) => ({
        id: u._id,
        name: u.name,
        username: u.username || '',
        avatar: u.avatar || '',
        experienceLevel: u.experienceLevel || 'Beginner'
      }))
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/public/:username
 * Returns a public profile + basic coding/interview stats
 */
async function getPublicProfile(req, res, next) {
  try {
    const { username } = req.params;

    // Try to find by username field first, then by name as fallback
    const user = await User.findOne({
      $or: [{ username: username }, { name: username }]
    })
      .select('name username avatar bio skills targetRole experienceLevel createdAt clerkUserId')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Grab basic coding stats for public display
    const matchUser = user.clerkUserId
      ? { $or: [{ clerkUserId: user.clerkUserId }, { userId: user._id }] }
      : { userId: user._id };

    const [solvedCount, totalInterviews] = await Promise.all([
      Submission.distinct('problemId', { ...matchUser, status: 'accepted', isDraft: false }).then(
        (ids) => ids.length
      ),
      MockInterviewSession.countDocuments({ ...matchUser, status: 'completed' })
    ]);
    console.log('getPublicProfile matchUser:', JSON.stringify(matchUser));
    console.log('getPublicProfile totalInterviews count:', totalInterviews);

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username || user.name,
        avatar: user.avatar || '',
        bio: user.bio || '',
        skills: user.skills || [],
        targetRole: user.targetRole || '',
        experienceLevel: user.experienceLevel || 'Beginner',
        memberSince: user.createdAt
      },
      stats: {
        problemsSolved: solvedCount,
        interviewsCompleted: totalInterviews
      }
    });
  } catch (err) {
    next(err);
  }
}
/**
 * GET /api/users/public/:username/analytics
 * Returns public coding analytics for a user (no auth required)
 */
async function getPublicAnalytics(req, res, next) {
  try {
    const { username } = req.params;

    const user = await User.findOne({
      $or: [{ username }, { name: username }]
    })
      .select('_id clerkUserId')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const matchUser = user.clerkUserId
      ? { $or: [{ clerkUserId: user.clerkUserId }, { userId: new mongoose.Types.ObjectId(user._id) }] }
      : { userId: new mongoose.Types.ObjectId(user._id) };

    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    // Run all DB queries in parallel — single round-trip per query, no redundant fetches.
    const [solvedAgg, totalSubAgg, totalProblemsAgg, activity, days] = await Promise.all([
      // Unique problems solved, grouped by difficulty
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
        { $group: { _id: '$problem.difficulty', count: { $sum: 1 } } }
      ]),

      // Total vs accepted submissions (for acceptance rate)
      Submission.aggregate([
        { $match: { ...matchUser, isDraft: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } }
          }
        }
      ]),

      // Total problems in DB per difficulty
      CodingProblem.aggregate([
        { $group: { _id: '$difficulty', count: { $sum: 1 } } }
      ]),

      // Submission activity heatmap (last 365 days)
      Submission.aggregate([
        { $match: { ...matchUser, isDraft: false, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
        { $sort: { date: 1 } }
      ]),

      // Unique active days (for streak calculation)
      Submission.aggregate([
        { $match: { ...matchUser, isDraft: false } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Build difficulty maps
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

    const subStats = totalSubAgg[0] || { total: 0, accepted: 0 };
    const acceptanceRate = subStats.total > 0 ? Math.round((subStats.accepted / subStats.total) * 100) : 0;

    // Calculate streak from unique active days
    const dateStrings = days.map((d) => d._id);
    let currentStreak = 0;
    let longestStreak = 0;
    let lastActiveDate = null;

    if (dateStrings.length > 0) {
      longestStreak = 1;
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

      lastActiveDate = dateStrings[dateStrings.length - 1];
      const lastDate = new Date(lastActiveDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffFromToday = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));

      if (diffFromToday <= 1) {
        currentStreak = 1;
        for (let i = dateStrings.length - 2; i >= 0; i--) {
          const prev = new Date(dateStrings[i]);
          const curr = new Date(dateStrings[i + 1]);
          const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
          if (diff === 1) currentStreak++;
          else break;
        }
      }
    }

    res.status(200).json({
      codingStats: {
        totalSolved: solvedMap.easy + solvedMap.medium + solvedMap.hard,
        totalProblems: totalMap.easy + totalMap.medium + totalMap.hard,
        easySolved: solvedMap.easy,
        mediumSolved: solvedMap.medium,
        hardSolved: solvedMap.hard,
        totalEasy: totalMap.easy,
        totalMedium: totalMap.medium,
        totalHard: totalMap.hard,
        totalSubmissions: subStats.total,
        acceptedSubmissions: subStats.accepted,
        acceptanceRate
      },
      activity,
      streak: { currentStreak, longestStreak, lastActiveDate }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, getStats, searchUsers, getPublicProfile, getPublicAnalytics };
