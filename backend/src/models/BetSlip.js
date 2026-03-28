const mongoose = require('mongoose');

const betSlipSchema = new mongoose.Schema({
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
  slipNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  lotteryCode: {
    type: String,
    required: true,
    trim: true
  },
  lotteryName: {
    type: String,
    required: true,
    trim: true
  },
  roundCode: {
    type: String,
    required: true,
    trim: true
  },
  roundTitle: {
    type: String,
    required: true,
    trim: true
  },
  rateProfileName: {
    type: String,
    default: '',
    trim: true
  },
  openAt: {
    type: Date,
    required: true
  },
  closeAt: {
    type: Date,
    required: true
  },
  drawAt: {
    type: Date,
    required: true
  },
  sourceType: {
    type: String,
    enum: ['console', 'manual', 'legacy-import'],
    default: 'console'
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'cancelled'],
    default: 'draft'
  },
  memo: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  itemCount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  potentialPayout: {
    type: Number,
    default: 0
  },
  submittedAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledReason: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

betSlipSchema.index({ customerId: 1, status: 1, createdAt: -1 });
betSlipSchema.index({ drawRoundId: 1, status: 1 });

module.exports = mongoose.model('BetSlip', betSlipSchema);
