const mongoose = require('mongoose');

const rateProfileSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  rates: {
    '3top': { type: Number, default: 0 },
    '3tod': { type: Number, default: 0 },
    '2top': { type: Number, default: 0 },
    '2bottom': { type: Number, default: 0 },
    'run_top': { type: Number, default: 0 },
    'run_bottom': { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

rateProfileSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('RateProfile', rateProfileSchema);
