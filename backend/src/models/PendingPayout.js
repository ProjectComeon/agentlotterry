const mongoose = require('mongoose');

const pendingPayoutSchema = new mongoose.Schema({
  payoutId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  betSlipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BetSlip',
    required: true,
    index: true
  },
  betItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BetItem',
    required: true,
    index: true
  },
  roundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DrawRound',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  payoutAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled', 'failed'],
    default: 'pending',
    index: true
  },
  reason: {
    type: String,
    trim: true,
    default: 'agent_insufficient_credit'
  },
  paidAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: ''
  },
  ledgerGroupIds: [{
    type: String,
    trim: true
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

pendingPayoutSchema.index(
  { betItemId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'pending'
    }
  }
);
pendingPayoutSchema.index({ agentId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('PendingPayout', pendingPayoutSchema);