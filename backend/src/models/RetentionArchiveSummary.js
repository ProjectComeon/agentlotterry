const mongoose = require('mongoose');

const retentionArchiveSummarySchema = new mongoose.Schema({
  scope: {
    type: String,
    enum: [
      'global',
      'agent',
      'customer',
      'lottery',
      'agent_customer',
      'agent_lottery',
      'customer_lottery',
      'wallet_global',
      'wallet_user'
    ],
    required: true,
    index: true
  },
  scopeKey: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  lotteryTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LotteryType',
    default: null,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  archivedBefore: {
    type: Date,
    default: null
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  totalWon: {
    type: Number,
    default: 0
  },
  netProfit: {
    type: Number,
    default: 0
  },
  totalBets: {
    type: Number,
    default: 0
  },
  totalSlips: {
    type: Number,
    default: 0
  },
  wonBets: {
    type: Number,
    default: 0
  },
  lostBets: {
    type: Number,
    default: 0
  },
  pendingBets: {
    type: Number,
    default: 0
  },
  ledgerCredit: {
    type: Number,
    default: 0
  },
  ledgerDebit: {
    type: Number,
    default: 0
  },
  ledgerNet: {
    type: Number,
    default: 0
  },
  ledgerCount: {
    type: Number,
    default: 0
  },
  lastRunId: {
    type: String,
    default: '',
    trim: true
  },
  lastArchivedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

retentionArchiveSummarySchema.index({ scope: 1, scopeKey: 1 }, { unique: true });
retentionArchiveSummarySchema.index({ archivedBefore: 1 });

module.exports = mongoose.model('RetentionArchiveSummary', retentionArchiveSummarySchema);
