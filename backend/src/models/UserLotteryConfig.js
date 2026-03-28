const mongoose = require('mongoose');

const BET_TYPES = ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'];

const userLotteryConfigSchema = new mongoose.Schema({
  userId: {
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
  isEnabled: {
    type: Boolean,
    default: true
  },
  rateProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RateProfile',
    default: null
  },
  enabledBetTypes: [{
    type: String,
    enum: BET_TYPES
  }],
  minimumBet: {
    type: Number,
    default: 1,
    min: 0
  },
  maximumBet: {
    type: Number,
    default: 10000,
    min: 0
  },
  maximumPerNumber: {
    type: Number,
    default: 10000,
    min: 0
  },
  stockPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  ownerPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  keepPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  commissionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  useCustomRates: {
    type: Boolean,
    default: false
  },
  customRates: {
    '3top': { type: Number, default: 0, min: 0 },
    '3tod': { type: Number, default: 0, min: 0 },
    '2top': { type: Number, default: 0, min: 0 },
    '2bottom': { type: Number, default: 0, min: 0 },
    'run_top': { type: Number, default: 0, min: 0 },
    'run_bottom': { type: Number, default: 0, min: 0 }
  },
  keepMode: {
    type: String,
    enum: ['off', 'cap'],
    default: 'off'
  },
  keepCapAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  blockedNumbers: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

userLotteryConfigSchema.index({ userId: 1, lotteryTypeId: 1 }, { unique: true });
userLotteryConfigSchema.index({ agentId: 1, userId: 1 });

module.exports = mongoose.model('UserLotteryConfig', userLotteryConfigSchema);
