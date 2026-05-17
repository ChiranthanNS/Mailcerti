const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  teamName: { type: String },
  college: { type: String },
  phone: { type: String },
  source: { type: String, enum: ['manual', 'excel_import', 'google_form'], default: 'manual' },
  additionalData: { type: mongoose.Schema.Types.Mixed }, // extra form fields
  status: {
    type: String,
    enum: ['registered', 'shortlisted', 'rejected', 'participated'],
    default: 'registered'
  },
  // Email tracking
  confirmationEmailSent: { type: Boolean, default: false },
  confirmationEmailSentAt: { type: Date },
  shortlistEmailSent: { type: Boolean, default: false },
  shortlistEmailSentAt: { type: Date },
  rejectionEmailSent: { type: Boolean, default: false },
  rejectionEmailSentAt: { type: Date },
  reminderEmailSent: { type: Boolean, default: false },
  reminderEmailSentAt: { type: Date },
  certificateEmailSent: { type: Boolean, default: false },
  certificateEmailSentAt: { type: Date },
  certificateDownloaded: { type: Boolean, default: false },
  certificateDownloadedAt: { type: Date },
  registeredAt: { type: Date, default: Date.now }
});

// Prevent duplicate registrations per event + email
registrationSchema.index({ eventId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
