const mongoose = require('mongoose');

const lotteryResultSchema = new mongoose.Schema({
  roundDate: {
    type: String,
    required: true,
    unique: true
  },
  firstPrize: {
    type: String,
    default: ''
  },
  threeTopList: [{
    type: String
  }],
  threeBotList: [{
    type: String
  }],
  twoBottom: {
    type: String,
    default: ''
  },
  runTop: [{
    type: String
  }],
  runBottom: [{
    type: String
  }],
  isCalculated: {
    type: Boolean,
    default: false
  },
  fetchedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LotteryResult', lotteryResultSchema);
