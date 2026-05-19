const mongoose = require('mongoose');

// --- College.js ---
const collegeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contactPerson: { type: String },
  phone: { type: String },
  domain: { type: String },
  city: { type: String },
  state: { type: String },
  addedAt: { type: Date, default: Date.now }
});

const College = mongoose.model('College', collegeSchema);

// --- EmailLog.js ---
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

const EmailLog = mongoose.model('EmailLog', emailLogSchema);

// --- Event.js ---
const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
  venue: { type: String },
  status: { 
    type: String, 
    enum: ['upcoming', 'ongoing', 'completed'], 
    default: 'upcoming' 
  },
  certificateTemplate: { type: String }, // path to uploaded template
  googleFormLink: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Event = mongoose.model('Event', eventSchema);

// --- PromotionEmail.js ---
const promotionEmailSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  email: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['sent', 'failed', 'pending'], 
    default: 'pending' 
  },
  opened: { type: Boolean, default: false },
  openedAt: { type: Date },
  sentAt: { type: Date },
  errorMessage: { type: String }
});

// Prevent duplicate promotion emails per event + college
promotionEmailSchema.index({ eventId: 1, collegeId: 1 }, { unique: true });

const PromotionEmail = mongoose.model('PromotionEmail', promotionEmailSchema);

// --- Registration.js ---
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

const Registration = mongoose.model('Registration', registrationSchema);

// --- Settings.js ---
// Singleton settings document — only one record ever exists
const settingsSchema = new mongoose.Schema({
  fromName:     { type: String, default: 'Event Management Team' },
  fromEmail:    { type: String, default: '' },
  orgName:      { type: String, default: '' },
  replyTo:      { type: String, default: '' },
  geminiApiKey: { type: String, default: '' },
  updatedAt:    { type: Date,   default: Date.now }
});

settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = { College, EmailLog, Event, PromotionEmail, Registration, Settings };
