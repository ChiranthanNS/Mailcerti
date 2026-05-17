const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

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

    const { sendEmail } = require('../services/emailService');
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

module.exports = router;
