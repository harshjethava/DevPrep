function normalizeTopics(topics) {
  if (!Array.isArray(topics)) return [];
  return topics
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .slice(0, 10);
}

const { generateInterviewQuestions } = require('../utils/questionGeneration');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const SavedQuestion = require('../models/SavedQuestion');
const User = require('../models/User');
const { getClerkUserIdFromAuth, upsertUserFromClerkApi } = require('./clerkSyncController');

function normalizeQuestionKey(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ?.,-]/g, '')
    .trim();
}

async function getOrCreateUserFromClerk(req) {
  const clerkUserId = getClerkUserIdFromAuth(req);
  if (!clerkUserId) return null;

  let user = await User.findOne({ clerkUserId });
  if (!user) {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    user = await upsertUserFromClerkApi(clerkUser);
  }
  return user;
}

async function generateQuestions(req, res, next) {
  try {
    const { role = 'Software Engineer', difficulty = 'Medium', topics = [], count = 10, excludeQuestions = [] } = req.body;

    const safeCount = Math.max(1, Math.min(Number(count) || 10, 20));
    const safeTopics = normalizeTopics(topics);

    const user = await getOrCreateUserFromClerk(req);
    const topicKey = safeTopics.length ? safeTopics[0] : '';
    const savedExcludes = user
      ? (
          await SavedQuestion.find({
            userId: user._id,
            role: String(role || '').trim(),
            difficulty: String(difficulty || '').trim(),
            ...(topicKey ? { topics: topicKey } : {})
          })
            .sort({ createdAt: -1 })
            .limit(200)
        ).map((q) => q.question)
      : [];

    const clientExcludes = Array.isArray(excludeQuestions)
      ? excludeQuestions
          .map((q) => (typeof q === 'string' ? q.trim() : ''))
          .filter(Boolean)
          .slice(0, 200)
      : [];

    const mergedExcludes = [...clientExcludes, ...savedExcludes];

    const items = await generateInterviewQuestions({
      role,
      difficulty,
      topics: safeTopics,
      count: safeCount,
      excludeQuestions: mergedExcludes
    });

    const questions = items.map((q) => ({
      text: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      topic: q.topic,
      explanation: q.explanation
    }));

    res.status(200).json({ questions });
  } catch (err) {
    next(err);
  }
}

async function saveQuestions(req, res, next) {
  try {
    const user = await getOrCreateUserFromClerk(req);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { role = '', difficulty = '', topics = [], questions = [] } = req.body;
    const safeTopics = normalizeTopics(topics);
    const safeRole = String(role || '').trim();
    const safeDifficulty = String(difficulty || '').trim();

    const items = Array.isArray(questions) ? questions : [];
    let saved = 0;
    let skipped = 0;

    for (const q of items) {
      const text = q && typeof q.text === 'string' ? q.text.trim() : '';
      if (!text) {
        skipped += 1;
        continue;
      }

      const questionKey = normalizeQuestionKey(text);
      if (!questionKey) {
        skipped += 1;
        continue;
      }

      try {
        await SavedQuestion.updateOne(
          { userId: user._id, questionKey },
          {
            $set: { updatedAt: new Date() },
            $setOnInsert: {
              userId: user._id,
              role: safeRole,
              difficulty: safeDifficulty,
              topics: safeTopics,
              question: text,
              questionKey,
              options: Array.isArray(q.options) ? q.options : [],
              correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
              topic: typeof q.topic === 'string' ? q.topic.trim() : '',
              explanation: typeof q.explanation === 'string' ? q.explanation.trim() : ''
            }
          },
          { upsert: true }
        );
        saved += 1;
      } catch (_) {
        skipped += 1;
      }
    }

    return res.status(200).json({ saved, skipped });
  } catch (err) {
    return next(err);
  }
}

async function getSavedStats(req, res, next) {
  try {
    const user = await getOrCreateUserFromClerk(req);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const totalSaved = await SavedQuestion.countDocuments({ userId: user._id });

    // Group saved questions into "quiz sessions" by role + difficulty + topic
    const recentQuizzes = await SavedQuestion.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: {
            role: '$role',
            difficulty: '$difficulty',
            topic: { $arrayElemAt: ['$topics', 0] }
          },
          count: { $sum: 1 },
          lastSavedAt: { $max: '$updatedAt' }
        }
      },
      { $sort: { lastSavedAt: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          role: '$_id.role',
          difficulty: '$_id.difficulty',
          topic: '$_id.topic',
          count: 1,
          lastSavedAt: 1
        }
      }
    ]);

    return res.status(200).json({
      totalSaved,
      recentQuizzes
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { generateQuestions, saveQuestions, getSavedStats };
