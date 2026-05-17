const mongoose = require('mongoose');

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

module.exports = mongoose.model('College', collegeSchema);
