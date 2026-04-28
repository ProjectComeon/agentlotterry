require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const {
  autoSeedAdmin,
  autoSeedCatalog,
  autoRetentionCleanup,
  autoSyncResults,
  cronSyncToken,
  defaultAdminPassword,
  defaultAdminUsername,
  exposeHealthDetails,
  frontendUrl,
  isProduction,
  logFormat,
  retentionCleanupIntervalMs,
  retentionCleanupStartupDelayMs,
  retentionKeepPreviousMonths,
  resultSyncIntervalMs,
  resultSyncStartupDelayMs,
  trustProxy,
  validateEnv
} = require('./src/config/env');
const requestContext = require('./src/middleware/requestContext');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const agentRoutes = require('./src/routes/agentRoutes');
const catalogRoutes = require('./src/routes/catalogRoutes');
const lotteryRoutes = require('./src/routes/lotteryRoutes');
const memberRoutes = require('./src/routes/memberRoutes');
const resultsRoutes = require('./src/routes/resultsRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const presenceRoutes = require('./src/routes/presenceRoutes');
const { ensureCatalogSeed } = require('./src/services/catalogService');
const { startExternalResultAutoSync } = require('./src/services/externalResultFeedService');
const { startReadModelSnapshotAutoRefresh } = require('./src/services/readModelSnapshotService');
const { startRetentionAutoCleanup } = require('./src/services/retentionCleanupService');
const User = require('./src/models/User');

const app = express();
let startupError = null;
let startupComplete = false;
const requestLogFormat = logFormat === 'combined'
  ? ':request-id :remote-addr - :method :url :status :res[content-length] - :response-time ms'
  : ':request-id :method :url :status :response-time ms';

const getDbState = () => mongoose.connection.readyState;
const isReady = () => startupComplete && !startupError && getDbState() === 1;

const autoSeed = async () => {
  if (!autoSeedAdmin) {
    return;
  }

  const adminExists = await User.findOne({ role: 'admin' });
  if (adminExists) {
    return;
  }

  await User.create({
    username: defaultAdminUsername,
    password: defaultAdminPassword,
    role: 'admin',
    name: 'Administrator',
    phone: '',
    isActive: true
  });
  console.log(`Auto-seeded admin account (${defaultAdminUsername})`);
};

const bootstrapApp = async () => {
  try {
    validateEnv();
    await connectDB();
    await autoSeed();
    if (autoSeedCatalog) {
      await ensureCatalogSeed();
      console.log('Catalog auto-seed enabled on startup');
    } else if (isProduction) {
      console.log('Catalog auto-seed disabled on startup; run `npm run catalog:seed` during deploy');
    }
    startupComplete = true;
  } catch (error) {
    startupError = error;
    console.error('Startup error:', error.message);
    throw error;
  }
};

app.set('trust proxy', trustProxy);
app.set('etag', false);

morgan.token('request-id', (req) => req.requestId || '-');

app.use(requestContext);
app.use(helmet());
app.use(cors({
  origin: frontendUrl || '*',
  credentials: true
}));
app.use(morgan(requestLogFormat, {
  skip: (req) => req.path === '/api/health' && logFormat !== 'combined'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/lottery', lotteryRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/presence', presenceRoutes);

app.get('/api/health', (req, res) => {
  const status = startupError ? 'error' : startupComplete ? 'ok' : 'starting';

  res.status(startupError ? 500 : startupComplete ? 200 : 503).json({
    status,
    startupComplete,
    dbReadyState: getDbState(),
    requestId: req.requestId,
    ...(exposeHealthDetails && startupError ? { startupError: startupError.message } : {}),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/ready', (req, res) => {
  const ready = isReady();

  res.status(ready ? 200 : 503).json({
    ready,
    startupComplete,
    dbReadyState: getDbState(),
    requestId: req.requestId,
    ...(exposeHealthDetails && startupError ? { startupError: startupError.message } : {}),
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    requestId: req.requestId
  });
});

app.use((err, req, res, next) => {
  console.error(`[${req.requestId}] Error:`, err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

bootstrapApp()
  .then(() => {
    if (autoSyncResults) {
      startExternalResultAutoSync(resultSyncIntervalMs, {
        startupDelayMs: resultSyncStartupDelayMs
      });
      console.log(
        `External result auto-sync enabled (${resultSyncIntervalMs} ms; first run delayed ${resultSyncStartupDelayMs} ms)`
      );
    } else if (isProduction) {
      console.log(
        `External result auto-sync disabled on web startup; use POST /api/lottery/sync-latest/cron${cronSyncToken ? ' with configured token' : ''}`
      );
    }

    startReadModelSnapshotAutoRefresh();
    console.log('Read model snapshot auto-refresh enabled');

    if (autoRetentionCleanup) {
      startRetentionAutoCleanup({
        intervalMs: retentionCleanupIntervalMs,
        startupDelayMs: retentionCleanupStartupDelayMs,
        keepPreviousMonths: retentionKeepPreviousMonths
      });
      console.log(
        `Retention auto-cleanup enabled (keep current + ${retentionKeepPreviousMonths} previous month(s); interval ${retentionCleanupIntervalMs} ms)`
      );
    } else if (isProduction) {
      console.log('Retention auto-cleanup disabled; set AUTO_RETENTION_CLEANUP=true after validating npm run retention:cleanup:dry');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(() => {
    process.exit(1);
  });

module.exports = app;
