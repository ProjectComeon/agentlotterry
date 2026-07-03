const mongoose = require('mongoose');

const retentionCleanupLeaseSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: 'global'
  },
  runId: {
    type: String,
    required: true,
    index: true
  },
  acquiredAt: {
    type: Date,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model('RetentionCleanupLease', retentionCleanupLeaseSchema);
