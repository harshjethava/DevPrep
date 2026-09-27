const express = require('express');
const { query } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { resolveClerkUser } = require('../middleware/resolveClerkUser');
const { adminOnly } = require('../middleware/admin');
const { validateRequest } = require('../middleware/validateRequest');
const { getUsers, getStats, getAnalytics } = require('../controllers/adminController');

const router = express.Router();

// Admin routes use Clerk auth + MongoDB user resolution + role check.
// Clerk users with role === 'admin' in the User model can access these endpoints.
router.use(clerkAuthMiddleware(), resolveClerkUser, adminOnly);

router.get(
  '/users',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
    query('search').optional().isString().withMessage('Invalid search')
  ],
  validateRequest,
  getUsers
);

router.get('/stats', getStats);
router.get('/analytics', getAnalytics);

module.exports = router;
