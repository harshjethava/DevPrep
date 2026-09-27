const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const webhookRoutes = require('./routes/webhookRoutes');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const questionRoutes = require('./routes/questionRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const codingRoutes = require('./routes/codingRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const clerkRoutes = require('./routes/clerkRoutes');
const mockInterviewRoutes = require('./routes/mockInterviewRoutes');
const executeRoutes = require('./routes/executeRoutes');

const app = express();

app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Only allow requests from the configured frontend origin.
// Set FRONTEND_URL in .env for local dev and on Render for production.
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
];

// Allow additional comma-separated origins via EXTRA_ORIGINS env var
if (process.env.EXTRA_ORIGINS) {
  process.env.EXTRA_ORIGINS.split(',').forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) ALLOWED_ORIGINS.push(trimmed);
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (e.g. curl, Postman, same-origin)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Webhooks must be mounted BEFORE express.json so we can verify raw payload signatures
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/coding', codingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clerk', clerkRoutes);
app.use('/api/mock-interviews', mockInterviewRoutes);
app.use('/api/execute', executeRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
