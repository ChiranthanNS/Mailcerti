require('dotenv').config();
const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');
const Settings = require('../models/Settings');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send a single email and log it.
 * fromName/fromEmail are loaded from DB Settings (admin-configured).
 */
async function sendEmail({ to, toName, subject, html, type, eventId, attachments = [] }) {
  // Load admin-configured sender details from DB, fallback to .env
  const settings = await Settings.getSettings();
  const fromName  = settings.fromName  || process.env.FROM_NAME  || 'Event Team';
  const fromEmail = settings.fromEmail || process.env.FROM_EMAIL || process.env.SMTP_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    attachments,
    ...(settings.replyTo ? { replyTo: settings.replyTo } : {})
  };

  try {
    await transporter.sendMail(mailOptions);

    await EmailLog.create({
      eventId,
      recipientEmail: to,
      recipientName: toName,
      type,
      subject,
      status: 'sent'
    });

    return { success: true };
  } catch (err) {
    await EmailLog.create({
      eventId,
      recipientEmail: to,
      recipientName: toName,
      type,
      subject,
      status: 'failed',
      errorMessage: err.message
    });

    return { success: false, error: err.message };
  }
}


/**
 * Send bulk emails with duplicate/failure handling
 */
async function sendBulkEmails(emailList) {
  const results = { sent: 0, failed: 0, errors: [] };

  for (const emailData of emailList) {
    const result = await sendEmail(emailData);
    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push({ email: emailData.to, error: result.error });
    }
    // Small delay to avoid rate limiting
    await new Promise(res => setTimeout(res, 150));
  }

  return results;
}

module.exports = { sendEmail, sendBulkEmails, transporter };
