const mongoose = require('mongoose');
const { BET_TYPES } = require('../constants/betting');

const betItemSchema = new mongoose.Schema({
  slipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BetSlip',
    required: true
  },
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
  placedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  placedByRole: {
    type: String,
    enum: ['admin', 'agent', 'customer'],
    default: 'customer'
  },
  placedByName: {
    type: String,
    default: '',
    trim: true
  },
  lotteryTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LotteryType',
    required: true
  },
  drawRoundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DrawRound',
    required: true
  },
  rateProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RateProfile',
    default: null
  },
  migrationSourceType: {
    type: String,
    default: '',
    trim: true
  },
  migrationSourceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  sequence: {
    type: Number,
    default: 0
  },
  betType: {
    type: String,
    enum: BET_TYPES,
    required: true
  },
  number: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  payRate: {
    type: Number,
    required: true
  },
  potentialPayout: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'cancelled'],
    default: 'draft'
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
  payoutAppliedAmount: {
    type: Number,
    default: 0
  },
  payoutLedgerGroupId: {
    type: String,
    default: '',
    trim: true
  },
  payoutUpdatedAt: {
    type: Date,
    default: null
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  sourceFlags: {
    fromReverse: {
      type: Boolean,
      default: false
    },
    fromDoubleSet: {
      type: Boolean,
      default: false
    },
    fromRood: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

betItemSchema.index({ slipId: 1, status: 1, sequence: 1 });
betItemSchema.index({ customerId: 1, drawRoundId: 1 });
betItemSchema.index({ drawRoundId: 1, status: 1, isLocked: 1 });
betItemSchema.index({ migrationSourceType: 1, migrationSourceId: 1 });
betItemSchema.index({ status: 1, agentId: 1, customerId: 1, createdAt: -1 });
betItemSchema.index({ status: 1, customerId: 1, createdAt: -1 });
betItemSchema.index({ status: 1, agentId: 1, result: 1, createdAt: -1 });
betItemSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('BetItem', betItemSchema);
