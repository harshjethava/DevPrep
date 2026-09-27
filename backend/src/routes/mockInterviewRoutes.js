const express = require('express');
const { body, param } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { mockInterviewStartLimiter, mockInterviewMessageLimiter } = require('../middleware/rateLimiters');
const {
  startSession,
  getSession,
  sendMessage,
  endSession,
  getHistory
} = require('../controllers/mockInterviewController');

const router = express.Router();

// All routes require Clerk authentication
router.use(clerkAuthMiddleware());

router.post(
  '/start',
  mockInterviewStartLimiter,
  [
    body('interviewType')
      .isIn(['technical', 'hr', 'mixed', 'resume-based'])
      .withMessage('Interview type must be technical, hr, mixed, or resume-based'),
    body('role').optional().isString().trim().isLength({ max: 100 })
      .withMessage('Role must be a string (max 100 chars)'),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard'])
      .withMessage('Difficulty must be easy, medium, or hard'),
    body('duration').optional().isInt().isIn([15, 30, 45, 60])
      .withMessage('Duration must be 15, 30, 45, or 60'),
    body('selectedTopics').optional().isArray()
      .withMessage('Selected topics must be an array'),
    body('resumeId').optional().isMongoId()
      .withMessage('Resume ID must be a valid ID')
  ],
  validateRequest,
  startSession
);

router.get('/history', getHistory);

router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid session id')],
  validateRequest,
  getSession
);

router.post(
  '/:id/message',
  mockInterviewMessageLimiter,
  [
    param('id').isMongoId().withMessage('Invalid session id'),
    body('content').trim().notEmpty().withMessage('Message content is required')
      .isLength({ max: 20000 }).withMessage('Message too long')
  ],
  validateRequest,
  sendMessage
);

router.post(
  '/:id/end',
  [
    param('id').isMongoId().withMessage('Invalid session id'),
    body('status').optional().isIn(['completed', 'abandoned'])
      .withMessage('Status must be completed or abandoned')
  ],
  validateRequest,
  endSession
);

module.exports = router;
