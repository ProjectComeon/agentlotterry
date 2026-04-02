const mongoose = require('mongoose');

const bettingDraftSessionSchema = new mongoose.Schema({
  actorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actorRole: {
    type: String,
    enum: ['admin', 'agent'],
    required: true
  },
  customerId: {
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
  composer: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  savedEntries: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  lastTouchedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

bettingDraftSessionSchema.index(
  {
    actorUserId: 1,
    actorRole: 1,
    customerId: 1,
    lotteryTypeId: 1,
    drawRoundId: 1,
    rateProfileId: 1
  },
  { unique: true, name: 'actor_customer_scope_unique' }
);

bettingDraftSessionSchema.index({ customerId: 1, updatedAt: -1 });
bettingDraftSessionSchema.index({ actorUserId: 1, updatedAt: -1 });

module.exports = mongoose.model('BettingDraftSession', bettingDraftSessionSchema);
