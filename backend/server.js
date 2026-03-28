require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./src/config/db');

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

const app = express();
let startupError = null;
let startupComplete = false;

// Connect to MongoDB & auto-seed admin
const User = require('./src/models/User');

const autoSeed = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      await User.create({
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        name: 'Administrator',
        phone: '',
        isActive: true
      });
      console.log('Auto-seeded admin account (admin / admin123)');
    }
  } catch (err) {
    console.error('Seed check error:', err.message);
  }
};

const bootstrapApp = async () => {
  try {
    await connectDB();
    await autoSeed();
    await ensureCatalogSeed();
    startupComplete = true;
  } catch (error) {
    startupError = error;
    console.error('Startup error:', error.message);
    throw error;
  }
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/lottery', lotteryRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/presence', presenceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const status = startupError ? 'error' : startupComplete ? 'ok' : 'starting';
  res.status(startupError ? 500 : startupComplete ? 200 : 503).json({
    status,
    startupComplete,
    ...(startupError && { startupError: startupError.message }),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

bootstrapApp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(() => {
    process.exit(1);
  });

module.exports = app;
