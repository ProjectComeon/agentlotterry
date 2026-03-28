const mongoose = require('mongoose');

const announcementReadSchema = new mongoose.Schema({
  announcementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

announcementReadSchema.index({ announcementId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('AnnouncementRead', announcementReadSchema);
