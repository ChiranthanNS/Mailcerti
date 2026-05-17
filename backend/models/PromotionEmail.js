const mongoose = require('mongoose');

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

module.exports = mongoose.model('PromotionEmail', promotionEmailSchema);
