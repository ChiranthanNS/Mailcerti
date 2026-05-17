const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  recipientEmail: { type: String, required: true },
  recipientName: { type: String },
  type: {
    type: String,
    enum: ['promotion', 'confirmation', 'shortlisted', 'rejected', 'reminder', 'certificate', 'test', 'custom'],
    required: true
  },
  subject: { type: String },
  status: { 
    type: String, 
    enum: ['sent', 'failed'], 
    required: true 
  },
  opened: { type: Boolean, default: false },
  openedAt: { type: Date },
  errorMessage: { type: String },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
