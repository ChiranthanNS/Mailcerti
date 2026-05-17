const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { sendEmail } = require('../services/emailService');
const { 
  confirmationTemplate, 
  shortlistedTemplate, 
  rejectedTemplate,
  reminderTemplate,
  certificateEmailTemplate
} = require('../services/emailTemplates');
const { generateCertificate } = require('../services/certificateService');

const upload = multer({ dest: path.join(__dirname, '../uploads/temp') });

/**
 * GET /api/registrations?eventId=xxx
 */
router.get('/', async (req, res) => {
  try {
    const { eventId, status } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (status) filter.status = status;
    const regs = await Registration.find(filter).sort({ registeredAt: -1 });
    res.json(regs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/registrations - Manual registration (or from webhook)
 * Body: { eventId, name, email, teamName, college, phone, ...additionalData }
 */
router.post('/', async (req, res) => {
  try {
    const { eventId, name, email, teamName, college, phone, ...additionalData } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check for existing registration
    const existing = await Registration.findOne({ eventId, email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered for this event' });
    }

    const reg = await Registration.create({
      eventId,
      name,
      email: email.toLowerCase().trim(),
      teamName,
      college,
      phone,
      additionalData: Object.keys(additionalData).length ? additionalData : undefined
    });

    // Send confirmation email immediately
    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    const html = confirmationTemplate({ name, eventName: event.name, eventDate, eventVenue: event.venue });
    
    const emailResult = await sendEmail({
      to: reg.email,
      toName: name,
      subject: `Registration Confirmed — ${event.name}`,
      html,
      type: 'confirmation',
      eventId
    });

    await Registration.findByIdAndUpdate(reg._id, {
      confirmationEmailSent: emailResult.success,
      confirmationEmailSentAt: emailResult.success ? new Date() : undefined
    });

    res.status(201).json({ registration: reg, confirmationEmailSent: emailResult.success });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/registrations/import - Upload Google Form responses (Excel/CSV)
 * Sends confirmation emails to new registrants only
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    fs.unlinkSync(req.file.path);

    const results = { added: 0, skipped: 0, errors: [] };
    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });

    for (const row of rows) {
      const email = (row.email || row.Email || row['Email Address'] || '').trim().toLowerCase();
      const name = (row.name || row.Name || row['Full Name'] || email).trim();
      const teamName = (row.teamName || row['Team Name'] || row.team || '').trim();
      const college = (row.college || row.College || row['College Name'] || '').trim();
      const phone = (row.phone || row.Phone || row.Mobile || '').toString().trim();

      if (!email || !email.includes('@')) {
        results.errors.push({ row: name, reason: 'Invalid email' });
        continue;
      }

      // Skip if already registered
      const existing = await Registration.findOne({ eventId, email });
      if (existing) { results.skipped++; continue; }

      try {
        const reg = await Registration.create({ eventId, name, email, teamName, college, phone });

        // Send confirmation email
        const html = confirmationTemplate({ name, eventName: event.name, eventDate, eventVenue: event.venue });
        const emailResult = await sendEmail({
          to: email,
          toName: name,
          subject: `Registration Confirmed — ${event.name}`,
          html,
          type: 'confirmation',
          eventId
        });

        await Registration.findByIdAndUpdate(reg._id, {
          confirmationEmailSent: emailResult.success,
          confirmationEmailSentAt: emailResult.success ? new Date() : undefined
        });

        results.added++;
        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        results.errors.push({ row: email, reason: e.message });
      }
    }

    res.json({ message: 'Import complete', ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/registrations/upload-shortlist
 * Upload shortlisted registrant emails (Excel)
 * Sends shortlisted email to those in list, rejected email to the rest
 */
router.post('/upload-shortlist', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { eventId, instructions } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    fs.unlinkSync(req.file.path);

    const shortlistedEmails = new Set(
      rows.map(r => (r.email || r.Email || '').trim().toLowerCase()).filter(Boolean)
    );

    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    const results = { shortlisted: 0, rejected: 0, errors: [] };

    // Update shortlisted registrants
    for (const email of shortlistedEmails) {
      const reg = await Registration.findOne({ eventId, email });
      if (!reg) continue;

      await Registration.findByIdAndUpdate(reg._id, { status: 'shortlisted' });

      if (!reg.shortlistEmailSent) {
        const html = shortlistedTemplate({ name: reg.name, eventName: event.name, eventDate, eventVenue: event.venue, instructions });
        const result = await sendEmail({
          to: reg.email, toName: reg.name,
          subject: `🌟 You're Shortlisted for ${event.name}!`,
          html, type: 'shortlisted', eventId
        });
        await Registration.findByIdAndUpdate(reg._id, {
          shortlistEmailSent: result.success,
          shortlistEmailSentAt: result.success ? new Date() : undefined
        });
        if (result.success) results.shortlisted++;
        else results.errors.push({ email, error: result.error });
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // Reject & email remaining registered students
    const notShortlisted = await Registration.find({
      eventId,
      status: 'registered',
      rejectionEmailSent: { $ne: true }
    });

    for (const reg of notShortlisted) {
      if (shortlistedEmails.has(reg.email)) continue;
      await Registration.findByIdAndUpdate(reg._id, { status: 'rejected' });

      const html = rejectedTemplate({ name: reg.name, eventName: event.name });
      const result = await sendEmail({
        to: reg.email, toName: reg.name,
        subject: `Update on your registration for ${event.name}`,
        html, type: 'rejected', eventId
      });
      await Registration.findByIdAndUpdate(reg._id, {
        rejectionEmailSent: result.success,
        rejectionEmailSentAt: result.success ? new Date() : undefined
      });
      if (result.success) results.rejected++;
      else results.errors.push({ email: reg.email, error: result.error });
      await new Promise(r => setTimeout(r, 150));
    }

    res.json({ message: 'Shortlisting complete', ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/registrations/send-reminders/:eventId
 * Send reminder emails to all shortlisted registrants (once only)
 */
router.post('/send-reminders/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const shortlisted = await Registration.find({
      eventId,
      status: 'shortlisted',
      reminderEmailSent: { $ne: true }
    });

    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    const results = { sent: 0, failed: 0, errors: [] };

    for (const reg of shortlisted) {
      const html = reminderTemplate({ name: reg.name, eventName: event.name, eventDate, eventVenue: event.venue });
      const result = await sendEmail({
        to: reg.email, toName: reg.name,
        subject: `⏰ Reminder: ${event.name} is Tomorrow!`,
        html, type: 'reminder', eventId
      });
      await Registration.findByIdAndUpdate(reg._id, {
        reminderEmailSent: result.success,
        reminderEmailSentAt: result.success ? new Date() : undefined
      });
      if (result.success) results.sent++;
      else { results.failed++; results.errors.push({ email: reg.email, error: result.error }); }
      await new Promise(r => setTimeout(r, 150));
    }

    res.json({ message: 'Reminders processed', ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/registrations/send-certificates/:eventId
 * Generate and email certificates to shortlisted/participated registrants
 */
router.post('/send-certificates/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const participants = await Registration.find({
      eventId,
      status: { $in: ['shortlisted', 'participated'] },
      certificateEmailSent: { $ne: true }
    });

    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    const results = { sent: 0, failed: 0, errors: [] };

    for (const reg of participants) {
      try {
        // Generate certificate PDF
        const certBuffer = await generateCertificate({
          name: reg.name,
          eventName: event.name,
          date: eventDate,
          templatePath: event.certificateTemplate
        });

        const html = certificateEmailTemplate({ name: reg.name, eventName: event.name });
        const result = await sendEmail({
          to: reg.email, toName: reg.name,
          subject: `🎓 Your Certificate of Participation — ${event.name}`,
          html, type: 'certificate', eventId,
          attachments: [{
            filename: `Certificate_${reg.name.replace(/\s+/g, '_')}.pdf`,
            content: certBuffer,
            contentType: 'application/pdf'
          }]
        });

        await Registration.findByIdAndUpdate(reg._id, {
          certificateEmailSent: result.success,
          certificateEmailSentAt: result.success ? new Date() : undefined
        });
        if (result.success) results.sent++;
        else { results.failed++; results.errors.push({ email: reg.email, error: result.error }); }
      } catch (certErr) {
        results.failed++;
        results.errors.push({ email: reg.email, error: certErr.message });
      }
      await new Promise(r => setTimeout(r, 200));
    }

    res.json({ message: 'Certificates processed', ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/registrations/send-invites-previous
 * Send promotional emails to all registrants from previous events
 */
router.post('/send-invites-previous', async (req, res) => {
  try {
    const { newEventId, previousEventIds, customMessage, subject } = req.body;
    
    const newEvent = await Event.findById(newEventId);
    if (!newEvent) return res.status(404).json({ error: 'New event not found' });

    // Get unique emails from previous events
    const prevRegs = await Registration.find({ eventId: { $in: previousEventIds } });
    const uniqueEmails = new Map();
    for (const reg of prevRegs) {
      if (!uniqueEmails.has(reg.email)) {
        uniqueEmails.set(reg.email, { email: reg.email, name: reg.name, college: reg.college });
      }
    }

    const eventDate = new Date(newEvent.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    const results = { sent: 0, failed: 0, errors: [] };

    const { promotionTemplate } = require('../services/emailTemplates');
    for (const [email, data] of uniqueEmails) {
      const html = promotionTemplate({
        eventName: newEvent.name,
        eventDate,
        eventVenue: newEvent.venue,
        eventDescription: newEvent.description,
        collegeNam: data.college || data.name,
        customMessage
      });

      const result = await sendEmail({
        to: email, toName: data.name,
        subject: subject || `Join us for ${newEvent.name}!`,
        html, type: 'promotion', eventId: newEventId
      });

      if (result.success) results.sent++;
      else { results.failed++; results.errors.push({ email, error: result.error }); }
      await new Promise(r => setTimeout(r, 150));
    }

    res.json({ message: 'Invites sent to previous participants', ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/registrations/webhook/:eventId?key=WEBHOOK_SECRET
 * Called automatically by Google Apps Script when a participant submits the Google Form.
 * Accepts flexible field names, deduplicates, saves registration, sends confirmation email.
 */
router.post('/webhook/:eventId', async (req, res) => {
  try {
    // ── Security: validate webhook key ──
    const { key } = req.query;
    if (key !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const body = req.body;

    // ── Flexible field mapping (handles various Google Form column names) ──
    const name = (
      body.name || body.Name || body['Full Name'] || body['full_name'] ||
      body['Student Name'] || body['Participant Name'] || ''
    ).trim();

    const email = (
      body.email || body.Email || body['Email Address'] || body['email_address'] ||
      body['Email ID'] || ''
    ).trim().toLowerCase();

    const college = (
      body.college || body.College || body['College Name'] || body['Institution'] ||
      body['University'] || body['School'] || ''
    ).trim();

    const teamName = (
      body.teamName || body['Team Name'] || body['team_name'] || body.team || ''
    ).trim();

    const phone = (
      body.phone || body.Phone || body['Phone Number'] || body['Mobile'] ||
      body['Contact Number'] || ''
    ).toString().trim();

    // ── Validate required fields ──
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // ── Deduplicate: skip if already registered ──
    const existing = await Registration.findOne({ eventId, email });
    if (existing) {
      return res.status(200).json({
        status: 'skipped',
        message: `${email} is already registered for this event`
      });
    }

    // ── Save registration ──
    const reg = await Registration.create({
      eventId,
      name,
      email,
      teamName,
      college,
      phone,
      source: 'google_form'
    });

    // ── Send confirmation email ──
    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    const html = confirmationTemplate({
      name,
      eventName: event.name,
      eventDate,
      eventVenue: event.venue
    });

    const emailResult = await sendEmail({
      to: email,
      toName: name,
      subject: `Registration Confirmed — ${event.name}`,
      html,
      type: 'confirmation',
      eventId
    });

    await Registration.findByIdAndUpdate(reg._id, {
      confirmationEmailSent: emailResult.success,
      confirmationEmailSentAt: emailResult.success ? new Date() : undefined
    });

    res.status(201).json({
      status: 'registered',
      message: `${name} registered successfully`,
      confirmationEmailSent: emailResult.success,
      registrationId: reg._id
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
