const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const Registration = require('../models/Registration');
const College = require('../models/College');
const Event = require('../models/Event');
const Settings = require('../models/Settings');
const { sendEmail } = require('../services/emailService');

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

module.exports = router;
