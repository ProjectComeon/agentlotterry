const mongoose = require('mongoose');

const resultRecordSchema = new mongoose.Schema({
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
  headline: {
    type: String,
    default: '',
    trim: true
  },
  firstPrize: {
    type: String,
    default: '',
    trim: true
  },
  twoTop: {
    type: String,
    default: '',
    trim: true
  },
  twoBottom: {
    type: String,
    default: '',
    trim: true
  },
  threeTop: {
    type: String,
    default: '',
    trim: true
  },
  threeBottom: {
    type: String,
    default: '',
    trim: true
  },
  runTop: [{
    type: String
  }],
  runBottom: [{
    type: String
  }],
  sourceType: {
    type: String,
    enum: ['manual', 'legacy', 'api'],
    default: 'manual'
  },
  sourceUrl: {
    type: String,
    default: '',
    trim: true
  },
  isPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

resultRecordSchema.index({ drawRoundId: 1 }, { unique: true });

module.exports = mongoose.model('ResultRecord', resultRecordSchema);
