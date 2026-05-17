const mongoose = require('mongoose');

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

module.exports = mongoose.model('Settings', settingsSchema);
