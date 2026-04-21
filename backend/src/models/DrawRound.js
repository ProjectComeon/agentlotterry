const mongoose = require('mongoose');
const { BET_TYPES } = require('../constants/betting');

const drawRoundSchema = new mongoose.Schema({
  lotteryTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LotteryType',
    required: true
  },
  code: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
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
  resultPublishedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['upcoming', 'open', 'closed', 'resulted'],
    default: 'upcoming'
  },
  bettingOverride: {
    type: String,
    enum: ['auto', 'open', 'closed'],
    default: 'auto'
  },
  isManualTiming: {
    type: Boolean,
    default: false
  },
  timingUpdatedAt: {
    type: Date,
    default: null
  },
  timingUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  closedBetTypes: [{
    type: String,
    enum: BET_TYPES
  }],
  notes: {
    type: String,
    default: '',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

drawRoundSchema.index({ lotteryTypeId: 1, code: 1 }, { unique: true });
drawRoundSchema.index({ closeAt: 1 });

module.exports = mongoose.model('DrawRound', drawRoundSchema);
