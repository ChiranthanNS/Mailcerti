require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const app = express();

// ── Middleware ──
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  /\.onrender\.com$/   // allow any Render subdomain
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser requests (Postman, Apps Script)
    const allowed = allowedOrigins.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    callback(null, allowed);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure upload dirs exist
['uploads/temp', 'uploads/templates'].forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

// ── Routes ──
app.use('/api/events', require('./routes/events'));
app.use('/api/colleges', require('./routes/colleges'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── MongoDB ──
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mail_certi')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ── Cron Jobs ──
// Every day at 8:00 AM — auto-send reminders for events happening tomorrow
cron.schedule('0 8 * * *', async () => {
  console.log('🔔 Cron: Checking for events tomorrow...');
  const Event = require('./models/Event');
  const Registration = require('./models/Registration');
  const { sendEmail } = require('./services/emailService');
  const { reminderTemplate } = require('./services/emailTemplates');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(tomorrow.setHours(0, 0, 0, 0));
  const end = new Date(tomorrow.setHours(23, 59, 59, 999));

  const events = await Event.find({ date: { $gte: start, $lte: end } });
  for (const event of events) {
    const shortlisted = await Registration.find({
      eventId: event._id,
      status: 'shortlisted',
      reminderEmailSent: { $ne: true }
    });

    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    for (const reg of shortlisted) {
      const html = reminderTemplate({ name: reg.name, eventName: event.name, eventDate, eventVenue: event.venue });
      const result = await sendEmail({
        to: reg.email, toName: reg.name,
        subject: `⏰ Reminder: ${event.name} is Tomorrow!`,
        html, type: 'reminder', eventId: event._id
      });
      await Registration.findByIdAndUpdate(reg._id, {
        reminderEmailSent: result.success,
        reminderEmailSentAt: result.success ? new Date() : undefined
      });
      console.log(`  Reminder → ${reg.email}: ${result.success ? 'sent' : 'failed'}`);
      await new Promise(r => setTimeout(r, 200));
    }
  }
});

// ── Start Server ──
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
