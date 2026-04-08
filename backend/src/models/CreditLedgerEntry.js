const mongoose = require('mongoose');

const creditLedgerEntrySchema = new mongoose.Schema({
  groupId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  entryType: {
    type: String,
    enum: ['transfer', 'adjustment', 'settlement'],
    required: true
  },
  direction: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  counterpartyUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  performedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  performedByRole: {
    type: String,
    enum: ['admin', 'agent', 'customer', 'system'],
    default: 'system'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  reasonCode: {
    type: String,
    trim: true,
    default: ''
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

creditLedgerEntrySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('CreditLedgerEntry', creditLedgerEntrySchema);
