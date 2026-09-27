const express = require('express');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { resolveClerkUser } = require('../middleware/resolveClerkUser');
const {
  getOverview,
  getPerformance,
  getTopics,
  getCodingStats,
  getSubmissionActivity,
  getStreakData,
  getProfileInsights,
  getRecentActivity
} = require('../controllers/analyticsController');

const router = express.Router();

// All analytics routes now use Clerk auth (matching what the frontend sends)
const auth = [clerkAuthMiddleware(), resolveClerkUser];

// Interview analytics
router.get('/overview', ...auth, getOverview);
router.get('/performance', ...auth, getPerformance);
router.get('/topics', ...auth, getTopics);

// Coding / LeetCode-style analytics
router.get('/coding-stats', ...auth, getCodingStats);
router.get('/submission-activity', ...auth, getSubmissionActivity);
router.get('/streak', ...auth, getStreakData);

// Profile insights
router.get('/profile-insights', ...auth, getProfileInsights);
router.get('/recent-activity', ...auth, getRecentActivity);

module.exports = router;
