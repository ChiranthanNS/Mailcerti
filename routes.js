const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const fsSync = require('fs');
const path = require('path');
const { College, EmailLog, Event, PromotionEmail, Registration, Settings } = require('./models');
const { generateCertificate, sendEmail, sendBulkEmails, transporter } = require('./services');
const { promotionTemplate, confirmationTemplate, shortlistedTemplate, rejectedTemplate, reminderTemplate, certificateEmailTemplate } = require('./services');
const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = {
  analyticsRouter: (() => {
    const fs = fsSync; // ensure local fs works
    
    const router = express.Router();
    
    
    
    
    
    /**
     * GET /api/analytics/dashboard
     * Returns overall analytics
     */
    router.get('/dashboard', async (req, res) => {
      try {
        const { eventId } = req.query;
        const filter = eventId ? { eventId } : {};
    
        // Email stats
        const totalEmails = await EmailLog.countDocuments(filter);
        const sentEmails = await EmailLog.countDocuments({ ...filter, status: 'sent' });
        const openedEmails = await EmailLog.countDocuments({ ...filter, opened: true });
        const failedEmails = await EmailLog.countDocuments({ ...filter, status: 'failed' });
    
        // By type
        const emailsByType = await EmailLog.aggregate([
          { $match: filter },
          { $group: { _id: '$type', count: { $sum: 1 }, sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } } } }
        ]);
    
        // Registration stats
        const regFilter = eventId ? { eventId } : {};
        const totalRegistered = await Registration.countDocuments(regFilter);
        const totalShortlisted = await Registration.countDocuments({ ...regFilter, status: 'shortlisted' });
        const totalRejected = await Registration.countDocuments({ ...regFilter, status: 'rejected' });
        const certDownloaded = await Registration.countDocuments({ ...regFilter, certificateDownloaded: true });
        const certEmailSent = await Registration.countDocuments({ ...regFilter, certificateEmailSent: true });
        const reminderSuccess = await Registration.countDocuments({ ...regFilter, reminderEmailSent: true });
    
        // Events overview
        const events = await Event.find().sort({ date: -1 }).limit(10);
    
        // Emails sent per day (last 14 days)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
        const emailsPerDay = await EmailLog.aggregate([
          { $match: { ...filter, sentAt: { $gte: fourteenDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);
    
        // Promotion stats
        const promotionSent = await PromotionEmail.countDocuments({ ...filter, status: 'sent' });
    
        res.json({
          emails: {
            total: totalEmails,
            sent: sentEmails,
            failed: failedEmails,
            opened: openedEmails,
            openRate: sentEmails > 0 ? ((openedEmails / sentEmails) * 100).toFixed(1) : 0,
            byType: emailsByType,
            perDay: emailsPerDay
          },
          registrations: {
            total: totalRegistered,
            shortlisted: totalShortlisted,
            rejected: totalRejected,
            certEmailSent,
            certDownloaded,
            reminderSuccess
          },
          promotion: {
            sent: promotionSent
          },
          events
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    /**
     * GET /api/analytics/event/:eventId - Per-event stats
     */
    router.get('/event/:eventId', async (req, res) => {
      try {
        const { eventId } = req.params;
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ error: 'Event not found' });
    
        const regs = await Registration.find({ eventId });
        const stats = {
          total: regs.length,
          shortlisted: regs.filter(r => r.status === 'shortlisted').length,
          rejected: regs.filter(r => r.status === 'rejected').length,
          confirmationSent: regs.filter(r => r.confirmationEmailSent).length,
          shortlistEmailSent: regs.filter(r => r.shortlistEmailSent).length,
          rejectionEmailSent: regs.filter(r => r.rejectionEmailSent).length,
          reminderSent: regs.filter(r => r.reminderEmailSent).length,
          certificateSent: regs.filter(r => r.certificateEmailSent).length,
          certificateDownloaded: regs.filter(r => r.certificateDownloaded).length
        };
    
        const promotions = await PromotionEmail.find({ eventId });
        const promotionStats = {
          total: promotions.length,
          sent: promotions.filter(p => p.status === 'sent').length,
          failed: promotions.filter(p => p.status === 'failed').length
        };
    
        res.json({ event, stats, promotionStats });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    /**
     * GET /api/analytics/track-open/:logId
     * Pixel tracking endpoint for email opens
     */
    router.get('/track-open/:logId', async (req, res) => {
      try {
        await EmailLog.findByIdAndUpdate(req.params.logId, { opened: true, openedAt: new Date() });
      } catch (_) {}
      // Return 1x1 transparent GIF
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.set('Content-Type', 'image/gif');
      res.send(pixel);
    });
    
    return router;
    
  })(),
  collegesRouter: (() => {
    const fs = fsSync; // ensure local fs works
    
    const router = express.Router();
    
    
    
    
    
    
    
    
    
    
    
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
    
    return router;
    
  })(),
  composeRouter: (() => {
    const fs = fsSync; // ensure local fs works
    
    const router = express.Router();
    
    
    
    
    
    
    
    
    // ── Gemini client — reads key from DB Settings first, then .env ──
    async function getGemini() {
      const settings = await Settings.getSettings();
      const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error('Gemini API key not configured. Go to ⚙️ Settings → AI Config and add your key from https://aistudio.google.com/apikey');
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
    
    
    /**
     * POST /api/compose/generate
     * Ask Gemini to generate an email subject + HTML body
     */
    router.post('/generate', async (req, res) => {
      try {
        const { emailType, eventName, eventDate, eventVenue, eventDescription, customNote, tone } = req.body;
    
        const typeDescriptions = {
          confirmation: 'a warm registration confirmation email telling the participant they are successfully registered',
          shortlisted:  'an exciting shortlist announcement email congratulating the participant on being selected',
          reminder:     'a friendly reminder email about the upcoming event happening tomorrow',
          rejection:    'a polite, empathetic rejection email letting the participant know they were not selected this time',
          promotion:    'a compelling promotional email inviting a college to participate in the event',
          custom:       'a professional event-related email'
        };
    
        const toneMap = {
          professional: 'professional and formal',
          friendly:     'friendly and warm',
          exciting:     'exciting and energetic',
          formal:       'very formal and corporate'
        };
    
        const prompt = `You are an expert email copywriter for college tech events and competitions.
    
    Write ${typeDescriptions[emailType] || typeDescriptions.custom} for:
    - Event Name: ${eventName}
    - Event Date: ${eventDate || 'To be announced'}
    - Venue: ${eventVenue || 'To be announced'}
    - Description: ${eventDescription || 'A premier college event'}
    - Tone: ${toneMap[tone] || 'professional and friendly'}
    ${customNote ? `- Additional instructions: ${customNote}` : ''}
    
    Requirements:
    1. Write a compelling subject line (no "Subject:" prefix, just the text)
    2. Write the full HTML email body (use inline CSS for styling, dark elegant theme with purple accents #7c3aed, include placeholders like {{name}} for recipient name, {{eventName}} for event name)
    3. Make it mobile-friendly with max-width 600px
    4. Include a clear call-to-action
    5. Add a professional email footer with the organization name placeholder {{orgName}}
    
    Return ONLY valid JSON in this exact format, no markdown:
    {"subject": "...", "html": "..."}`;
    
        const model = await getGemini();
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
    
        // Strip markdown code fences if present
        const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(clean);
    
        res.json({ subject: parsed.subject, html: parsed.html });
      } catch (err) {
        if (err.message.includes('GEMINI_API_KEY')) {
          return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'AI generation failed: ' + err.message });
      }
    });
    
    /**
     * POST /api/compose/send
     * Send a custom email (AI-generated or manual) to a target group
     * Body: { eventId, subject, html, targetGroup, emailType }
     * targetGroup: 'registered' | 'shortlisted' | 'all_registrations' | 'colleges' | 'rejected'
     */
    router.post('/send', async (req, res) => {
      try {
        const { eventId, subject, html, targetGroup, emailType } = req.body;
    
        if (!subject || !html || !targetGroup) {
          return res.status(400).json({ error: 'subject, html, and targetGroup are required' });
        }
    
        let recipients = [];
    
        if (targetGroup === 'colleges') {
          // Send to all colleges
          const colleges = await College.find();
          recipients = colleges.map(c => ({ email: c.email, name: c.name, id: c._id }));
        } else {
          // Send to registrants
          if (!eventId) return res.status(400).json({ error: 'eventId required for registrant emails' });
          const event = await Event.findById(eventId);
          if (!event) return res.status(404).json({ error: 'Event not found' });
    
          const statusFilter = {
            registered:         { status: 'registered' },
            shortlisted:        { status: 'shortlisted' },
            rejected:           { status: 'rejected' },
            all_registrations:  {}
          };
    
          const filter = { eventId, ...(statusFilter[targetGroup] || {}) };
          const regs = await Registration.find(filter);
          recipients = regs.map(r => ({ email: r.email, name: r.name, id: r._id }));
        }
    
        if (recipients.length === 0) {
          return res.status(400).json({ error: 'No recipients found for this group' });
        }
    
        // Fetch event for placeholder replacement
        let event = null;
        if (eventId) event = await Event.findById(eventId);
    
        const results = { sent: 0, failed: 0, errors: [] };
    
        for (const recipient of recipients) {
          // Replace placeholders with real values
          const personalizedHtml = html
            .replace(/\{\{name\}\}/g, recipient.name)
            .replace(/\{\{eventName\}\}/g, event?.name || '')
            .replace(/\{\{eventDate\}\}/g, event ? new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '')
            .replace(/\{\{eventVenue\}\}/g, event?.venue || '')
            .replace(/\{\{orgName\}\}/g, process.env.FROM_NAME || 'Event Team');
    
          const personalizedSubject = subject
            .replace(/\{\{name\}\}/g, recipient.name)
            .replace(/\{\{eventName\}\}/g, event?.name || '');
    
          const result = await sendEmail({
            to: recipient.email,
            toName: recipient.name,
            subject: personalizedSubject,
            html: personalizedHtml,
            type: emailType || 'custom',
            eventId: eventId || null
          });
    
          if (result.success) results.sent++;
          else {
            results.failed++;
            results.errors.push({ email: recipient.email, error: result.error });
          }
    
          await new Promise(r => setTimeout(r, 150)); // rate limit
        }
    
        res.json({ message: 'Emails processed', total: recipients.length, ...results });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    /**
     * GET /api/compose/recipients-count
     * Preview how many people will receive the email for a given group
     */
    router.get('/recipients-count', async (req, res) => {
      try {
        const { eventId, targetGroup } = req.query;
    
        if (targetGroup === 'colleges') {
          const count = await College.countDocuments();
          return res.json({ count, group: 'colleges' });
        }
    
        if (!eventId) return res.json({ count: 0 });
    
        const statusFilter = {
          registered:        { status: 'registered' },
          shortlisted:       { status: 'shortlisted' },
          rejected:          { status: 'rejected' },
          all_registrations: {}
        };
    
        const filter = { eventId, ...(statusFilter[targetGroup] || {}) };
        const count = await Registration.countDocuments(filter);
        res.json({ count, group: targetGroup });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    return router;
    
  })(),
  eventsRouter: (() => {
    const fs = fsSync; // ensure local fs works
    
    const router = express.Router();
    
    
    
    
    
    // Multer for certificate template uploads
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/templates');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `template_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });
    const upload = multer({ storage });
    
    // GET all events
    router.get('/', async (req, res) => {
      try {
        const events = await Event.find().sort({ createdAt: -1 });
        res.json(events);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // GET single event
    router.get('/:id', async (req, res) => {
      try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // POST create event
    router.post('/', upload.single('certificateTemplate'), async (req, res) => {
      try {
        const { name, description, date, venue, googleFormLink } = req.body;
        const event = new Event({
          name,
          description,
          date: new Date(date),
          venue,
          googleFormLink,
          certificateTemplate: req.file ? req.file.path : null
        });
        await event.save();
        res.status(201).json(event);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    // PUT update event
    router.put('/:id', upload.single('certificateTemplate'), async (req, res) => {
      try {
        const updates = { ...req.body };
        if (req.file) updates.certificateTemplate = req.file.path;
        if (updates.date) updates.date = new Date(updates.date);
        const event = await Event.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    // DELETE event
    router.delete('/:id', async (req, res) => {
      try {
        await Event.findByIdAndDelete(req.params.id);
        res.json({ message: 'Event deleted' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    return router;
    
  })(),
  registrationsRouter: (() => {
    const fs = fsSync; // ensure local fs works
    
    const router = express.Router();
    
    
    
    
    
    
    
    
    const { 
      confirmationTemplate, 
      shortlistedTemplate, 
      rejectedTemplate,
      reminderTemplate,
      certificateEmailTemplate
    } = require('./services');
    
    
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
    
    return router;
    
  })(),
  settingsRouter: (() => {
    const fs = fsSync; // ensure local fs works
    
    const router = express.Router();
    
    
    /**
     * GET /api/settings — Get current settings
     */
    router.get('/', async (req, res) => {
      try {
        const settings = await Settings.getSettings();
        res.json(settings);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    /**
     * PUT /api/settings — Update settings
     */
    router.put('/', async (req, res) => {
      try {
        const { fromName, fromEmail, orgName, replyTo } = req.body;
        if (!fromName || !fromEmail) {
          return res.status(400).json({ error: 'From Name and From Email are required' });
        }
    
        let settings = await Settings.findOne();
        if (!settings) {
          settings = await Settings.create({ fromName, fromEmail, orgName, replyTo });
        } else {
          settings.fromName  = fromName;
          settings.fromEmail = fromEmail;
          settings.orgName   = orgName  || '';
          settings.replyTo   = replyTo  || '';
          settings.updatedAt = new Date();
          await settings.save();
        }
    
        res.json({ message: 'Settings saved', settings });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    /**
     * POST /api/settings/test-email — Send a test email using current settings
     */
    router.post('/test-email', async (req, res) => {
      try {
        const { to } = req.body;
        if (!to) return res.status(400).json({ error: 'Recipient email required' });
    
        const settings = await Settings.getSettings();
        if (!settings.fromEmail) return res.status(400).json({ error: 'Configure From Email in settings first' });
    
        
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#0f0f1a;color:#fff;border-radius:16px;border:1px solid #7c3aed">
            <h2 style="color:#7c3aed">🧪 Test Email — MailCerti</h2>
            <p>This is a test email sent from your <strong>MailCerti</strong> settings.</p>
            <hr style="border-color:#333;margin:16px 0"/>
            <p><strong>From Name:</strong> ${settings.fromName}</p>
            <p><strong>From Email:</strong> ${settings.fromEmail}</p>
            ${settings.replyTo ? `<p><strong>Reply-To:</strong> ${settings.replyTo}</p>` : ''}
            ${settings.orgName ? `<p><strong>Organisation:</strong> ${settings.orgName}</p>` : ''}
            <hr style="border-color:#333;margin:16px 0"/>
            <p style="color:#888;font-size:12px">Sent at: ${new Date().toLocaleString('en-IN')}</p>
          </div>`;
    
        const result = await sendEmail({
          to,
          toName: 'Admin',
          subject: '🧪 MailCerti Test Email',
          html,
          type: 'test'
        });
    
        if (result.success) {
          res.json({ message: `Test email sent to ${to}` });
        } else {
          res.status(500).json({ error: result.error });
        }
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    return router;
    
  })()
};
