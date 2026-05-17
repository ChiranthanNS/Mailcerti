const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const College = require('../models/College');
const Event = require('../models/Event');
const PromotionEmail = require('../models/PromotionEmail');
const { sendEmail, sendBulkEmails } = require('../services/emailService');
const { promotionTemplate } = require('../services/emailTemplates');

// Multer for Excel uploads
const upload = multer({ dest: path.join(__dirname, '../uploads/temp') });

/**
 * GET /api/colleges - List all colleges
 */
router.get('/', async (req, res) => {
  try {
    const colleges = await College.find().sort({ addedAt: -1 });
    res.json(colleges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/colleges - Manually add a single college
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, contactPerson, phone, city, state, domain } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'name and email are required' });

    const existing = await College.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'College with this email already exists' });

    const college = await College.create({
      name, email: email.toLowerCase().trim(),
      contactPerson, phone, city, state, domain
    });
    res.status(201).json(college);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/colleges/:id - Delete a college
 */
router.delete('/:id', async (req, res) => {
  try {
    await College.findByIdAndDelete(req.params.id);
    res.json({ message: 'College deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/colleges/upload - Upload Excel of college emails
 * Parses the Excel and adds new colleges to DB (skips existing ones)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    const results = { added: 0, skipped: 0, errors: [] };
    const newColleges = [];

    for (const row of rows) {
      const email = (row.email || row.Email || row.EMAIL || '').trim().toLowerCase();
      const name = (row.name || row.Name || row.college || row.College || email).trim();
      const domain = (row.domain || row.Domain || '').trim();
      const city = (row.city || row.City || '').trim();
      const state = (row.state || row.State || '').trim();

      if (!email || !email.includes('@')) {
        results.errors.push({ row: name || email, reason: 'Invalid email' });
        continue;
      }

      try {
        const existing = await College.findOne({ email });
        if (existing) {
          results.skipped++;
          continue;
        }
        const college = await College.create({ name, email, domain, city, state });
        newColleges.push(college);
        results.added++;
      } catch (e) {
        results.errors.push({ row: email, reason: e.message });
      }
    }

    res.json({ message: 'Upload complete', ...results, newColleges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/colleges/send-promotion
 * Send promotion emails for an event.
 * Skips colleges that already received a promotion email for this event.
 * Body: { eventId, customMessage, subject, targetAll (bool) | collegeIds[] }
 */
router.post('/send-promotion', async (req, res) => {
  try {
    const { eventId, customMessage, subject, targetAll, collegeIds } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Find colleges that already got this event's promotion email
    const alreadySent = await PromotionEmail.find({ eventId }).select('collegeId');
    const alreadySentIds = new Set(alreadySent.map(p => p.collegeId.toString()));

    // Determine target colleges
    let colleges;
    if (targetAll) {
      colleges = await College.find();
    } else if (collegeIds && collegeIds.length > 0) {
      colleges = await College.find({ _id: { $in: collegeIds } });
    } else {
      return res.status(400).json({ error: 'Specify targetAll or collegeIds' });
    }

    // Filter out already-emailed colleges
    const toSend = colleges.filter(c => !alreadySentIds.has(c._id.toString()));

    if (toSend.length === 0) {
      return res.json({ message: 'No new colleges to send to — all already received this promotion', sent: 0 });
    }

    const emailDate = event.date ? new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' }) : 'TBA';
    const results = { sent: 0, failed: 0, errors: [] };

    for (const college of toSend) {
      const html = promotionTemplate({
        eventName: event.name,
        eventDate: emailDate,
        eventVenue: event.venue,
        eventDescription: event.description,
        collegeNam: college.name,
        customMessage
      });

      // Create a pending record first (prevents duplicate sends on retry)
      let promoRecord;
      try {
        promoRecord = await PromotionEmail.create({
          eventId,
          collegeId: college._id,
          email: college.email,
          status: 'pending'
        });
      } catch (dupErr) {
        // Already exists (race condition) — skip
        results.skipped = (results.skipped || 0) + 1;
        continue;
      }

      const result = await sendEmail({
        to: college.email,
        toName: college.name,
        subject: subject || `Invitation to ${event.name}`,
        html,
        type: 'promotion',
        eventId
      });

      if (result.success) {
        await PromotionEmail.findByIdAndUpdate(promoRecord._id, {
          status: 'sent',
          sentAt: new Date()
        });
        results.sent++;
      } else {
        await PromotionEmail.findByIdAndUpdate(promoRecord._id, {
          status: 'failed',
          errorMessage: result.error
        });
        results.failed++;
        results.errors.push({ email: college.email, error: result.error });
      }

      await new Promise(r => setTimeout(r, 150));
    }

    res.json({ message: 'Promotion emails processed', ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/colleges/promotion-status/:eventId
 * Shows which colleges received/didn't receive promotion for an event
 */
router.get('/promotion-status/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const sent = await PromotionEmail.find({ eventId }).populate('collegeId');
    const allColleges = await College.find();
    const sentIds = new Set(sent.map(p => p.collegeId?._id?.toString()));
    const unsent = allColleges.filter(c => !sentIds.has(c._id.toString()));
    res.json({ sent, unsent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
