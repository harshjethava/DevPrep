const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not set');
  }

  await mongoose.connect(mongoUri, {
    // ── Connection pool ───────────────────────────────────────────────────────
    // maxPoolSize: max simultaneous connections Mongoose keeps open to Atlas.
    // Default is 5; set to 20 to comfortably handle concurrent AI + DB traffic.
    maxPoolSize: 20,
    // minPoolSize: keep at least 2 connections warm to avoid cold-start latency.
    minPoolSize: 2,

    // ── Timeouts ──────────────────────────────────────────────────────────────
    // Fail fast if Atlas is unreachable at startup (rather than hanging 30s).
    serverSelectionTimeoutMS: 10000,
    // Close idle sockets after 45s to avoid Atlas's 60s idle disconnection.
    socketTimeoutMS: 45000,
    // How long to wait for a new connection to be established.
    connectTimeoutMS: 10000,
  });

  return mongoose.connection;
}

module.exports = { connectDB };
