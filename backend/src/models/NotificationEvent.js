const mongoose = require('mongoose');

const notificationEventSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  recipientRole: {
    type: String,
    enum: ['admin', 'agent'],
    required: true,
    index: true
  },
  recipientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  title: {
    type: String,
    trim: true,
    default: ''
  },
  message: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['unread', 'read'],
    default: 'unread',
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

notificationEventSchema.index({ recipientRole: 1, status: 1, createdAt: -1 });
notificationEventSchema.index({ agentId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationEvent', notificationEventSchema);