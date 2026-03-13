const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roundDate: {
    type: String,
    required: [true, 'Round date is required']
  },
  betType: {
    type: String,
    enum: ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'],
    required: true
  },
  number: {
    type: String,
    required: [true, 'Bet number is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be at least 1']
  },
  payRate: {
    type: Number,
    required: true
  },
  result: {
    type: String,
    enum: ['pending', 'won', 'lost'],
    default: 'pending'
  },
  wonAmount: {
    type: Number,
    default: 0
  },
  isLocked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Prevent editing locked bets
betSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew && this.isLocked) {
    const err = new Error('Cannot modify a locked bet');
    err.status = 403;
    return next(err);
  }
  next();
});

// Default pay rates by bet type
betSchema.statics.getPayRate = function(betType) {
  const rates = {
    '3top': 500,
    '3tod': 100,
    '2top': 70,
    '2bottom': 70,
    'run_top': 3,
    'run_bottom': 2
  };
  return rates[betType] || 0;
};

module.exports = mongoose.model('Bet', betSchema);
