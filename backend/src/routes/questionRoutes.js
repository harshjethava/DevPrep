const express = require('express');
const { body } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { questionGenerationLimiter } = require('../middleware/rateLimiters');
const { generateQuestions, saveQuestions, getSavedStats } = require('../controllers/questionController');

const router = express.Router();

router.post(
  '/generate',
  clerkAuthMiddleware(),
  questionGenerationLimiter,
  [
    body('role').optional().isString().withMessage('Role must be a string'),
    body('difficulty').optional().isString().withMessage('Difficulty must be a string'),
    body('topics').optional().isArray().withMessage('Topics must be an array'),
    body('count').optional().isInt({ min: 1, max: 20 }).withMessage('Count must be 1-20'),
    body('excludeQuestions').optional().isArray().withMessage('excludeQuestions must be an array')
  ],
  validateRequest,
  generateQuestions
);

router.post(
  '/save',
  clerkAuthMiddleware(),
  [
    body('role').optional().isString().withMessage('Role must be a string'),
    body('difficulty').optional().isString().withMessage('Difficulty must be a string'),
    body('topics').optional().isArray().withMessage('Topics must be an array'),
    body('questions').isArray().withMessage('questions must be an array')
  ],
  validateRequest,
  saveQuestions
);

router.get('/saved/stats', clerkAuthMiddleware(), getSavedStats);

module.exports = router;
