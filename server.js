require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const multer = require('multer');
const XLSX = require('xlsx');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { v4: uuidv4 } = require('uuid');

// ==========================================
// 1. DATABASE MODELS
// ==========================================

const emailLogSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  recipientEmail: { type: String, required: true },
  recipientName: { type: String },
  type: {
    type: String,
    enum: ['promotion', 'confirmation', 'shortlisted', 'rejected', 'reminder', 'certificate', 'test', 'custom'],
    required: true
  },
  subject: { type: String },
  status: { type: String, enum: ['sent', 'failed'], required: true },
  opened: { type: Boolean, default: false },
  openedAt: { type: Date },
  errorMessage: { type: String },
  sentAt: { type: Date, default: Date.now }
});
const EmailLog = mongoose.model('EmailLog', emailLogSchema);

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
  venue: { type: String },
  status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' },
  googleFormLink: { type: String },
  participationType: { type: String, enum: ['individual', 'team'], default: 'individual' },
  teamEmailPolicy: { type: String, enum: ['leader_only', 'all_members'], default: 'leader_only' },
  certificateTemplate: { type: String },
  certNameX: { type: Number, default: 50 },
  certNameY: { type: Number, default: 50 },
  certFontSize: { type: Number, default: 48 },
  certFontColor: { type: String, default: '#000000' },
  confirmationSubject: { type: String, default: '' },
  confirmationBody: { type: String, default: '' },
  shortlistSubject: { type: String, default: '' },
  shortlistBody: { type: String, default: '' },
  rejectionSubject: { type: String, default: '' },
  rejectionBody: { type: String, default: '' },
  reminderSubject: { type: String, default: '' },
  reminderBody: { type: String, default: '' },
  certificateSubject: { type: String, default: '' },
  certificateBody: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.model('Event', eventSchema);

const registrationSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  teamName: { type: String },
  college: { type: String },
  phone: { type: String },
  isTeamLeader: { type: Boolean, default: true },
  teamId: { type: String },
  memberNames: [{ type: String }],
  memberEmails: [{ type: String }],
  source: { type: String, enum: ['manual', 'excel_import', 'google_form'], default: 'manual' },
  additionalData: { type: mongoose.Schema.Types.Mixed },
  status: {
    type: String,
    enum: ['registered', 'shortlisted', 'rejected', 'participated'],
    default: 'registered'
  },
  confirmationEmailSent: { type: Boolean, default: false },
  confirmationEmailSentAt: { type: Date },
  shortlistEmailSent: { type: Boolean, default: false },
  shortlistEmailSentAt: { type: Date },
  rejectionEmailSent: { type: Boolean, default: false },
  rejectionEmailSentAt: { type: Date },
  reminderEmailSent: { type: Boolean, default: false },
  reminderEmailSentAt: { type: Date },
  certificateEmailSent: { type: Boolean, default: false },
  certificateEmailSentAt: { type: Date },
  certificateDownloaded: { type: Boolean, default: false },
  certificateDownloadedAt: { type: Date },
  registeredAt: { type: Date, default: Date.now }
});
registrationSchema.index({ eventId: 1, email: 1 }, { unique: true });
const Registration = mongoose.model('Registration', registrationSchema);

const settingsSchema = new mongoose.Schema({
  fromName:     { type: String, default: 'Event Management Team' },
  fromEmail:    { type: String, default: '' },
  orgName:      { type: String, default: '' },
  replyTo:      { type: String, default: '' },
  geminiApiKey: { type: String, default: '' },
  allowedEmails: { type: [String], default: [] },
  updatedAt:    { type: Date, default: Date.now }
});
settingsSchema.statics.getSettings = async function () {
  let s = await this.findOne();
  if (!s) s = await this.create({});
  return s;
};
const Settings = mongoose.model('Settings', settingsSchema);

// ==========================================
// 2. EMAIL TEMPLATES
// ==========================================

function wrapHtmlEmail({ subject, body, orgName }) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;color:#334155}
  .container{max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.05);border:1px solid rgba(20,184,166,.15)}
  .header{background:linear-gradient(135deg,#14B8A6 0%,#0F766E 100%);padding:32px 28px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px;font-weight:700}
  .body{padding:35px 30px;font-size:15px;line-height:1.7;color:#334155}
  .footer{background:#f8fafc;padding:20px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid rgba(20,184,166,.08)}
</style></head><body>
<div class="container">
  <div class="header"><h1>${subject}</h1></div>
  <div class="body">${body.replace(/\n/g, '<br>')}</div>
  <div class="footer"><p>Sent by ${orgName || 'Event Management Team'}</p></div>
</div></body></html>`;
}

function confirmationTemplate({ name, eventName, eventDate, eventVenue, teamName, memberNames, isTeam }) {
  const teamSection = isTeam && teamName ? `
    <div style="background:#f0fdf4;border-left:4px solid #14B8A6;border-radius:8px;padding:16px;margin:16px 0">
      <strong>Team:</strong> ${teamName}<br>
      ${memberNames && memberNames.length > 0 ? `<strong>Members:</strong> ${memberNames.join(', ')}` : ''}
    </div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .container{max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#14B8A6,#0F766E);padding:40px 30px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:26px}
  .body{padding:35px 30px;color:#444;line-height:1.7}
  .badge{background:#e8fff2;border:2px solid #14B8A6;border-radius:50px;padding:10px 25px;display:inline-block;margin:15px 0;color:#0F766E;font-weight:bold;font-size:15px}
  .info-box{background:#f0fdf4;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #bbf7d0}
  .footer{background:#f4f6f9;padding:20px;text-align:center;font-size:12px;color:#888}
</style></head><body>
<div class="container">
  <div class="header"><h1>&#x2705; Registration Confirmed!</h1></div>
  <div class="body">
    <p>Dear <strong>${name}</strong>,</p>
    <div class="badge">&#x1F38A; You're Registered!</div>
    <p>Your registration for <strong>${eventName}</strong> has been successfully received.</p>
    ${teamSection}
    <div class="info-box">
      <p><strong>&#x1F4C5; Event Date:</strong> ${eventDate}</p>
      <p><strong>&#x1F4CD; Venue:</strong> ${eventVenue || 'To be announced'}</p>
    </div>
    <p>Our team will review registrations and notify you about your shortlisting status. Thank you for registering!</p>
  </div>
  <div class="footer"><p>Sent by Event Management System</p></div>
</div></body></html>`;
}

function shortlistedTemplate({ name, eventName, eventDate, eventVenue, customBody }) {
  if (customBody) return customBody;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .container{max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#f7971e,#ffd200);padding:40px 30px;text-align:center}
  .header h1{color:#333;margin:0;font-size:26px}
  .body{padding:35px 30px;color:#444;line-height:1.7}
  .info-box{background:#fffbe6;border-left:4px solid #ffd200;border-radius:8px;padding:20px;margin:20px 0}
  .footer{background:#f4f6f9;padding:20px;text-align:center;font-size:12px;color:#888}
</style></head><body>
<div class="container">
  <div class="header"><h1>&#x1F31F; Congratulations! You're Shortlisted!</h1></div>
  <div class="body">
    <p>Dear <strong>${name}</strong>,</p>
    <p>We are delighted to inform you that you have been <strong>shortlisted</strong> for <strong>${eventName}</strong>!</p>
    <div class="info-box">
      <p><strong>&#x1F4C5; Event Date:</strong> ${eventDate}</p>
      <p><strong>&#x1F4CD; Venue:</strong> ${eventVenue || 'To be announced'}</p>
    </div>
    <p>Please be prepared and on time. A reminder will be sent before the event. All the best! &#x1F4AA;</p>
  </div>
  <div class="footer"><p>Sent by Event Management System</p></div>
</div></body></html>`;
}

function rejectedTemplate({ name, eventName, customBody }) {
  if (customBody) return customBody;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .container{max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#636363,#a2a2a2);padding:40px 30px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:24px}
  .body{padding:35px 30px;color:#444;line-height:1.7}
  .footer{background:#f4f6f9;padding:20px;text-align:center;font-size:12px;color:#888}
</style></head><body>
<div class="container">
  <div class="header"><h1>Thank You for Participating</h1></div>
  <div class="body">
    <p>Dear <strong>${name}</strong>,</p>
    <p>Thank you for registering for <strong>${eventName}</strong>.</p>
    <p>We regret to inform you that you have not been shortlisted for this event. We had many talented participants and the selection was very competitive.</p>
    <p>Please don't be disheartened. We encourage you to participate in our future events. Keep going! &#x1F499;</p>
  </div>
  <div class="footer"><p>Sent by Event Management System</p></div>
</div></body></html>`;
}

function reminderTemplate({ name, eventName, eventDate, eventVenue, customBody }) {
  if (customBody) return customBody;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .container{max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#fc466b,#3f5efb);padding:40px 30px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:26px}
  .body{padding:35px 30px;color:#444;line-height:1.7}
  .countdown{background:linear-gradient(135deg,#fc466b,#3f5efb);color:#fff;border-radius:10px;padding:20px;text-align:center;margin:20px 0;font-size:22px;font-weight:bold}
  .footer{background:#f4f6f9;padding:20px;text-align:center;font-size:12px;color:#888}
</style></head><body>
<div class="container">
  <div class="header"><h1>&#x23F0; Event Reminder &mdash; Don't Miss It!</h1></div>
  <div class="body">
    <p>Dear <strong>${name}</strong>,</p>
    <div class="countdown">&#x1F680; ${eventName} is TOMORROW!</div>
    <p><strong>&#x1F4C5; Date:</strong> ${eventDate}<br><strong>&#x1F4CD; Venue:</strong> ${eventVenue || 'To be announced'}</p>
    <p>Please carry your ID card, arrive 15 minutes early, and bring any required materials. We're excited to see you! &#x1F389;</p>
  </div>
  <div class="footer"><p>Sent by Event Management System</p></div>
</div></body></html>`;
}

function certificateEmailTemplate({ name, eventName, customBody }) {
  if (customBody) return customBody;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .container{max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#f093fb,#f5576c);padding:40px 30px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:26px}
  .body{padding:35px 30px;color:#444;line-height:1.7}
  .cert-badge{background:linear-gradient(135deg,#f093fb20,#f5576c20);border:2px solid #f5576c;border-radius:10px;padding:20px;text-align:center;margin:20px 0}
  .footer{background:#f4f6f9;padding:20px;text-align:center;font-size:12px;color:#888}
</style></head><body>
<div class="container">
  <div class="header"><h1>&#x1F3C5; Your Certificate of Participation</h1></div>
  <div class="body">
    <p>Dear <strong>${name}</strong>,</p>
    <div class="cert-badge">
      <p style="font-size:40px;margin:0">&#x1F393;</p>
      <p style="font-weight:bold;color:#f5576c;margin:5px 0">Certificate Attached!</p>
    </div>
    <p>Congratulations on successfully participating in <strong>${eventName}</strong>!</p>
    <p>Please find your <strong>Certificate of Participation</strong> attached to this email. This certificate recognizes your dedication and contribution.</p>
    <p>We hope to see you at more of our events in the future. Keep up the great work!</p>
  </div>
  <div class="footer"><p>Sent by Event Management System | Certificate attached as PDF</p></div>
</div></body></html>`;
}

function promotionTemplate({ eventName, eventDate, eventVenue, eventDescription, collegeNam, customMessage }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .container{max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#667eea,#764ba2);padding:40px 30px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:28px}
  .body{padding:35px 30px;color:#444;line-height:1.7}
  .event-card{background:#f8f9ff;border-left:4px solid #667eea;border-radius:8px;padding:20px;margin:20px 0}
  .footer{background:#f4f6f9;padding:20px;text-align:center;font-size:12px;color:#888}
</style></head><body>
<div class="container">
  <div class="header"><h1>&#x1F389; You're Invited!</h1></div>
  <div class="body">
    <p>Dear <strong>${collegeNam || 'Team'}</strong>,</p>
    <p>We are thrilled to invite your college to our upcoming event!</p>
    <div class="event-card">
      <h2>&#x1F4C5; ${eventName}</h2>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p><strong>Venue:</strong> ${eventVenue || 'To be announced'}</p>
      ${eventDescription ? `<p>${eventDescription}</p>` : ''}
    </div>
    ${customMessage ? `<p>${customMessage}</p>` : ''}
    <p>We look forward to your enthusiastic participation!</p>
  </div>
  <div class="footer"><p>If you have questions, please reply to this email.</p></div>
</div></body></html>`;
}

// ==========================================
// 3. CERTIFICATE GENERATION (pdfkit)
// ==========================================

async function generateCertificate({ name, eventName, date, templatePath, certNameX, certNameY, certFontSize, certFontColor }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;

    if (templatePath && fs.existsSync(templatePath)) {
      try {
        doc.image(templatePath, 0, 0, { width: W, height: H });
      } catch (_) {
        doc.rect(0, 0, W, H).fill('#1a1a2e');
      }
    } else {
      doc.rect(0, 0, W, H).fill('#1a1a2e');
      doc.rect(15, 15, W - 30, H - 30).strokeColor('#c9a227').lineWidth(3).stroke();
      doc.rect(22, 22, W - 44, H - 44).strokeColor('#e8c56f').lineWidth(1).stroke();
      doc.rect(40, 40, W - 80, H - 80).fill('#16213e');
      [[50,50],[W-50,50],[50,H-50],[W-50,H-50]].forEach(([x,y]) =>
        doc.circle(x, y, 8).fillColor('#e8c56f').fill());
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#e8c56f')
        .text('CERTIFICATE OF PARTICIPATION', 0, 65, { align: 'center' });
      doc.moveTo(W/2-160,88).lineTo(W/2+160,88).strokeColor('#e8c56f').lineWidth(1.5).stroke();
      doc.font('Helvetica').fontSize(13).fillColor('#ccc')
        .text('This is to certify that', 0, 140, { align: 'center' });
      doc.font('Helvetica').fontSize(13).fillColor('#ccc')
        .text('has successfully participated in', 0, 232, { align: 'center' });
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#e8c56f')
        .text(eventName, 0, 254, { align: 'center' });
      doc.font('Helvetica').fontSize(12).fillColor('#aaa')
        .text(`Held on ${date}`, 0, 288, { align: 'center' });
      doc.font('Helvetica').fontSize(10).fillColor('#aaa')
        .text('_________________________', 100, 345)
        .text('Organizer Signature', 100, 362)
        .text('_________________________', W - 280, 345)
        .text('Event Coordinator', W - 280, 362);
    }

    const xPct = certNameX != null ? certNameX : 50;
    const yPct = certNameY != null ? certNameY : 50;
    const nameX = (xPct / 100) * W;
    const nameY = (yPct / 100) * H;
    const fontSize = certFontSize || 48;
    const color = certFontColor || '#1a1a2e';

    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color)
      .text(name, 0, nameY - fontSize / 2, { align: 'center', width: W });

    doc.end();
  });
}

// ==========================================
// 4. EMAIL SENDING UTILITIES
// ==========================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function sendEmail({ to, toName, subject, html, type, eventId, attachments = [] }) {
  const settings = await Settings.getSettings();
  const fromName  = settings.fromName  || process.env.FROM_NAME  || 'Event Team';
  const fromEmail = settings.fromEmail || process.env.FROM_EMAIL || process.env.SMTP_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to, subject, html, attachments,
    ...(settings.replyTo ? { replyTo: settings.replyTo } : {})
  };

  try {
    await transporter.sendMail(mailOptions);
    await EmailLog.create({ eventId, recipientEmail: to, recipientName: toName, type, subject, status: 'sent' });
    return { success: true };
  } catch (err) {
    await EmailLog.create({ eventId, recipientEmail: to, recipientName: toName, type, subject, status: 'failed', errorMessage: err.message });
    return { success: false, error: err.message };
  }
}

function personalizeMail(text, { name, eventName, eventDate, eventVenue, orgName, teamName }) {
  return (text || '')
    .replace(/\{\{name\}\}/g, name || '')
    .replace(/\{\{eventName\}\}/g, eventName || '')
    .replace(/\{\{eventDate\}\}/g, eventDate || '')
    .replace(/\{\{eventVenue\}\}/g, eventVenue || '')
    .replace(/\{\{orgName\}\}/g, orgName || '')
    .replace(/\{\{teamName\}\}/g, teamName || '');
}

function safeParseJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned.trim());
}

async function generateContentWithFallback(prompt, generationConfig = {}) {
  const settings = await Settings.getSettings();
  const key = (settings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('GEMINI_API_KEY not configured. Add it in Settings.');

  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.0-flash-lite'
  ];

  let lastError = null;
  const ai = new GoogleGenerativeAI(key);

  for (const modelName of candidateModels) {
    try {
      console.log(`Attempting generation with model: ${modelName}`);
      const model = ai.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });
      console.log(`Successfully generated content using model: ${modelName}`);
      return result;
    } catch (err) {
      console.error(`Failed with model ${modelName}:`, err.message);
      lastError = err;
      if (err.message.includes('API_KEY_INVALID') || err.message.includes('key not valid')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All generative models failed');
}

// ==========================================
// 5. EXPRESS ROUTERS
// ==========================================

// Auth Router
const authRouter = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function authenticateToken(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No session token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'mailcerti_default_secret_key_2025');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

authRouter.get('/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

authRouter.post('/dev-login', async (req, res) => {
  try {
    const token = jwt.sign(
      { email: 'dev-admin@vvce.ac.in', name: 'Dev Admin' },
      process.env.JWT_SECRET || 'mailcerti_default_secret_key_2025',
      { expiresIn: '7d' }
    );
    res.json({ token, user: { email: 'dev-admin@vvce.ac.in', name: 'Dev Admin', picture: '' } });
  } catch (err) {
    res.status(500).json({ error: 'Dev authentication failed: ' + err.message });
  }
});

authRouter.post('/google-login', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Credential token required' });
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google OAuth not configured' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { email, name, picture } = ticket.getPayload();
    if (!email) return res.status(400).json({ error: 'Email not in Google credentials' });

    const emailLower = email.toLowerCase().trim();
    if (!emailLower.endsWith('@vvce.ac.in'))
      return res.status(403).json({ error: 'Only @vvce.ac.in accounts are permitted.' });

    const settings = await Settings.getSettings();
    if (settings.allowedEmails && settings.allowedEmails.length > 0) {
      const isAllowed = settings.allowedEmails.some(
        allowed => allowed.toLowerCase().trim() === emailLower
      );
      if (!isAllowed) {
        return res.status(403).json({ error: 'Your email is not whitelisted to access this console.' });
      }
    }

    const token = jwt.sign({ email: emailLower, name }, process.env.JWT_SECRET || 'mailcerti_default_secret_key_2025', { expiresIn: '7d' });
    res.json({ token, user: { email: emailLower, name, picture } });
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed: ' + err.message });
  }
});

// Events Router
const eventsRouter = express.Router();
const eventsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads/templates');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `template_${Date.now()}${path.extname(file.originalname)}`)
});
const eventsUpload = multer({ storage: eventsStorage });

eventsRouter.get('/', async (req, res) => {
  try { res.json(await Event.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

eventsRouter.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

eventsRouter.post('/', eventsUpload.single('certificateTemplate'), async (req, res) => {
  try {
    const body = req.body;
    const event = await Event.create({
      name: body.name,
      description: body.description,
      date: new Date(body.date),
      venue: body.venue,
      googleFormLink: body.googleFormLink,
      participationType: body.participationType || 'individual',
      teamEmailPolicy: body.teamEmailPolicy || 'leader_only',
      status: body.status || 'upcoming',
      confirmationSubject: body.confirmationSubject || '',
      confirmationBody: body.confirmationBody || '',
      certificateTemplate: req.file ? req.file.path : null
    });
    res.status(201).json(event);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

eventsRouter.put('/:id', eventsUpload.single('certificateTemplate'), async (req, res) => {
  try {
    const updates = { ...req.body };
    if (req.file) updates.certificateTemplate = req.file.path;
    if (updates.date) updates.date = new Date(updates.date);
    const event = await Event.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

eventsRouter.delete('/:id', async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

eventsRouter.get('/:id/excel-template', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    let headers;
    if (event.participationType === 'team') {
      headers = [['team_name','leader_name','leader_email','member1_name','member1_email','member2_name','member2_email','member3_name','member3_email','college','phone']];
    } else {
      headers = [['name','email','college','phone']];
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    if (event.participationType === 'team') {
      XLSX.utils.sheet_add_aoa(ws, [['TeamAlpha','Alice','alice@example.com','Bob','bob@example.com','Carol','carol@example.com','','','XYZ College','9876543210']], { origin: 'A2' });
    } else {
      XLSX.utils.sheet_add_aoa(ws, [['Alice Smith','alice@example.com','XYZ College','9876543210']], { origin: 'A2' });
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template_${event.participationType}_${event.name.replace(/\s+/g,'_')}.xlsx"`
    });
    res.send(buf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

eventsRouter.put('/:id/cert-settings', eventsUpload.single('certificateTemplate'), async (req, res) => {
  try {
    const updates = {};
    if (req.file) updates.certificateTemplate = req.file.path;
    if (req.body.certNameX != null) updates.certNameX = parseFloat(req.body.certNameX);
    if (req.body.certNameY != null) updates.certNameY = parseFloat(req.body.certNameY);
    if (req.body.certFontSize != null) updates.certFontSize = parseInt(req.body.certFontSize);
    if (req.body.certFontColor) updates.certFontColor = req.body.certFontColor;
    if (req.body.certificateSubject) updates.certificateSubject = req.body.certificateSubject;
    if (req.body.certificateBody) updates.certificateBody = req.body.certificateBody;
    const event = await Event.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

eventsRouter.post('/:id/preview-certificate', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { sampleName, certNameX, certNameY, certFontSize, certFontColor } = req.body;

    const certBuffer = await generateCertificate({
      name: sampleName || 'Sample Participant',
      eventName: event.name,
      date: new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' }),
      templatePath: event.certificateTemplate,
      certNameX: certNameX != null ? parseFloat(certNameX) : event.certNameX,
      certNameY: certNameY != null ? parseFloat(certNameY) : event.certNameY,
      certFontSize: certFontSize != null ? parseInt(certFontSize) : event.certFontSize,
      certFontColor: certFontColor || event.certFontColor
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="certificate_preview.pdf"'
    });
    res.send(certBuffer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Registrations Router
const registrationsRouter = express.Router();
const regUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads/temp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `upload_${Date.now()}${path.extname(file.originalname)}`)
});
const regUpload = multer({ storage: regUploadStorage });

registrationsRouter.get('/', async (req, res) => {
  try {
    const { eventId, status } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (status) filter.status = status;
    res.json(await Registration.find(filter).sort({ registeredAt: -1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

registrationsRouter.post('/', async (req, res) => {
  try {
    const { eventId, name, email, teamName, college, phone, memberNames, memberEmails } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const existing = await Registration.findOne({ eventId, email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Email already registered for this event' });

    const isTeam = event.participationType === 'team';
    const teamId = isTeam ? uuidv4() : undefined;

    const reg = await Registration.create({
      eventId, name, email: email.toLowerCase().trim(),
      teamName, college, phone, source: 'manual',
      isTeamLeader: true, teamId,
      memberNames: isTeam ? (memberNames || []) : [],
      memberEmails: isTeam ? (memberEmails || []) : []
    });

    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    const settings = await Settings.getSettings();
    const orgName = settings.orgName || 'Event Team';

    let subject, html;
    if (event.confirmationSubject && event.confirmationBody) {
      subject = personalizeMail(event.confirmationSubject, { name, eventName: event.name, eventDate, eventVenue: event.venue, orgName, teamName });
      const bodyText = personalizeMail(event.confirmationBody, { name, eventName: event.name, eventDate, eventVenue: event.venue, orgName, teamName });
      html = wrapHtmlEmail({ subject, body: bodyText, orgName });
    } else {
      subject = `Registration Confirmed — ${event.name}`;
      html = confirmationTemplate({ name, eventName: event.name, eventDate, eventVenue: event.venue, teamName, memberNames: memberNames || [], isTeam });
    }

    const emailTargets = [{ name, email: email.toLowerCase().trim() }];
    if (isTeam && event.teamEmailPolicy === 'all_members' && memberEmails && memberEmails.length > 0) {
      memberEmails.forEach((me, i) => {
        if (me && me.includes('@')) emailTargets.push({ name: (memberNames || [])[i] || name, email: me.toLowerCase().trim() });
      });
    }

    let overallSuccess = false;
    for (const target of emailTargets) {
      const personalizedSubject = personalizeMail(subject, { name: target.name, eventName: event.name, eventDate, eventVenue: event.venue, orgName, teamName });
      const personalizedHtml = html.replace(/\{\{name\}\}/g, target.name);
      const result = await sendEmail({ to: target.email, toName: target.name, subject: personalizedSubject, html: personalizedHtml, type: 'confirmation', eventId });
      if (result.success) overallSuccess = true;
      await new Promise(r => setTimeout(r, 100));
    }

    await Registration.findByIdAndUpdate(reg._id, {
      confirmationEmailSent: overallSuccess,
      confirmationEmailSentAt: overallSuccess ? new Date() : undefined
    });

    res.status(201).json({ registration: reg, confirmationEmailSent: overallSuccess });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

registrationsRouter.patch('/:id', async (req, res) => {
  try {
    const reg = await Registration.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    res.json(reg);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

registrationsRouter.delete('/:id', async (req, res) => {
  try {
    await Registration.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

registrationsRouter.post('/import', async (req, res) => {
  try {
    const { eventId, participationType, teamEmailPolicy, confirmSubject, confirmBody, registrations } = req.body;
    if (!registrations || !Array.isArray(registrations)) {
      return res.status(400).json({ error: 'No registrations provided' });
    }

    let event = null;
    if (eventId) {
      event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
    }

    const results = { added: 0, skipped: 0, errors: [], emailsSent: 0 };
    const isTeam = event ? (event.participationType === 'team') : (participationType === 'team');
    const policy = event ? event.teamEmailPolicy : (teamEmailPolicy || 'leader_only');
    const eventName = event ? event.name : '';
    const eventVenue = event ? event.venue : '';
    const eventDate = event ? new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '';
    
    const settings = await Settings.getSettings();
    const orgName = settings.orgName || 'Event Team';

    for (const row of registrations) {
      try {
        if (isTeam) {
          const teamName = (row.teamName || '').trim();
          const leaderName = (row.name || '').trim();
          const leaderEmail = (row.email || '').trim().toLowerCase();

          if (!leaderEmail || !leaderEmail.includes('@')) {
            results.errors.push({ row: leaderName || teamName, reason: 'Invalid leader email' }); continue;
          }

          const memberNames = Array.isArray(row.memberNames) ? row.memberNames.map(n => (n || '').trim()).filter(Boolean) : [];
          const memberEmails = Array.isArray(row.memberEmails) ? row.memberEmails.map(e => (e || '').trim().toLowerCase()).filter(e => e && e.includes('@')) : [];

          if (event) {
            const existing = await Registration.findOne({ eventId, email: leaderEmail });
            if (existing) { results.skipped++; continue; }

            const teamId = uuidv4();
            const reg = await Registration.create({
              eventId, name: leaderName, email: leaderEmail, teamName, college: (row.college || '').trim(),
              phone: (row.phone || '').toString().trim(),
              isTeamLeader: true, teamId, memberNames, memberEmails, source: 'excel_import'
            });

            let subject = event.confirmationSubject && event.confirmationBody
              ? personalizeMail(event.confirmationSubject, { name: leaderName, eventName, eventDate, eventVenue, orgName, teamName })
              : `Registration Confirmed — ${eventName}`;
            const html = event.confirmationSubject && event.confirmationBody
              ? wrapHtmlEmail({ subject, body: personalizeMail(event.confirmationBody, { name: leaderName, eventName, eventDate, eventVenue, orgName, teamName }), orgName })
              : confirmationTemplate({ name: leaderName, eventName, eventDate, eventVenue, teamName, memberNames, isTeam: true });

            const emailTargets = [{ name: leaderName, email: leaderEmail }];
            if (policy === 'all_members') {
              memberEmails.forEach((me, i) => emailTargets.push({ name: memberNames[i] || leaderName, email: me }));
            }

            let sent = false;
            for (const t of emailTargets) {
              const r = await sendEmail({ to: t.email, toName: t.name, subject, html: html.replace(/\{\{name\}\}/g, t.name), type: 'confirmation', eventId });
              if (r.success) { sent = true; results.emailsSent++; }
              await new Promise(res => setTimeout(res, 120));
            }
            await Registration.findByIdAndUpdate(reg._id, { confirmationEmailSent: sent, confirmationEmailSentAt: sent ? new Date() : undefined });
            results.added++;
          } else {
            let subject = confirmSubject
              ? personalizeMail(confirmSubject, { name: leaderName, eventName: '', eventDate: '', eventVenue: '', orgName, teamName })
              : `Registration Confirmed`;
            const html = confirmSubject && confirmBody
              ? wrapHtmlEmail({ subject, body: personalizeMail(confirmBody, { name: leaderName, eventName: '', eventDate: '', eventVenue: '', orgName, teamName }), orgName })
              : confirmationTemplate({ name: leaderName, eventName: 'Event', eventDate: 'TBA', eventVenue: 'TBA', teamName, memberNames, isTeam: true });

            const emailTargets = [{ name: leaderName, email: leaderEmail }];
            if (policy === 'all_members') {
              memberEmails.forEach((me, i) => emailTargets.push({ name: memberNames[i] || leaderName, email: me }));
            }

            for (const t of emailTargets) {
              const r = await sendEmail({ to: t.email, toName: t.name, subject, html: html.replace(/\{\{name\}\}/g, t.name), type: 'confirmation', eventId: null });
              if (r.success) { results.emailsSent++; }
              await new Promise(res => setTimeout(res, 120));
            }
            results.added++;
          }
        } else {
          const name = (row.name || '').trim();
          const email = (row.email || '').trim().toLowerCase();
          const college = (row.college || '').trim();
          const phone = (row.phone || '').toString().trim();

          if (!email || !email.includes('@')) {
            results.errors.push({ row: name || email, reason: 'Invalid email' }); continue;
          }

          if (event) {
            const existing = await Registration.findOne({ eventId, email });
            if (existing) { results.skipped++; continue; }

            const reg = await Registration.create({ eventId, name, email, college, phone, source: 'excel_import' });

            let subject, html;
            if (event.confirmationSubject && event.confirmationBody) {
              subject = personalizeMail(event.confirmationSubject, { name, eventName, eventDate, eventVenue, orgName });
              html = wrapHtmlEmail({ subject, body: personalizeMail(event.confirmationBody, { name, eventName, eventDate, eventVenue, orgName }), orgName });
            } else {
              subject = `Registration Confirmed — ${eventName}`;
              html = confirmationTemplate({ name, eventName, eventDate, eventVenue, isTeam: false });
            }

            const result = await sendEmail({ to: email, toName: name, subject, html, type: 'confirmation', eventId });
            await Registration.findByIdAndUpdate(reg._id, { confirmationEmailSent: result.success, confirmationEmailSentAt: result.success ? new Date() : undefined });
            if (result.success) results.emailsSent++;
            results.added++;
          } else {
            let subject = confirmSubject
              ? personalizeMail(confirmSubject, { name, eventName: '', eventDate: '', eventVenue: '', orgName })
              : `Registration Confirmed`;
            const html = confirmSubject && confirmBody
              ? wrapHtmlEmail({ subject, body: personalizeMail(confirmBody, { name, eventName: '', eventDate: '', eventVenue: '', orgName }), orgName })
              : confirmationTemplate({ name, eventName: 'Event', eventDate: 'TBA', eventVenue: 'TBA', isTeam: false });

            const result = await sendEmail({ to: email, toName: name, subject, html, type: 'confirmation', eventId: null });
            if (result.success) results.emailsSent++;
            results.added++;
          }
          await new Promise(r => setTimeout(r, 120));
        }
      } catch (e) {
        results.errors.push({ row: JSON.stringify(row).slice(0, 80), reason: e.message });
      }
    }

    res.json({ message: 'Import complete', ...results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

registrationsRouter.post('/send-targeted', async (req, res) => {
  try {
    const { eventId, mailType, subject, body, recipients: recipientsInput } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'subject and body required' });
    if (!mailType) return res.status(400).json({ error: 'mailType required' });

    let event = null;
    if (eventId) {
      event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
    }

    const settings = await Settings.getSettings();
    const orgName = settings.orgName || 'Event Team';
    const eventName = event ? event.name : '';
    const eventVenue = event ? event.venue : '';
    const eventDate = event ? new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '';

    let recipients = [];

    if (recipientsInput && Array.isArray(recipientsInput)) {
      for (const rec of recipientsInput) {
        const email = (rec.email || '').trim().toLowerCase();
        const name = (rec.name || email).trim();
        if (email && email.includes('@')) recipients.push({ email, name });
      }
    } else if (eventId) {
      const statusMap = {
        shortlisted: { status: 'shortlisted' },
        not_shortlisted: { status: 'rejected' },
        reminder: { status: 'shortlisted' },
        confirmation: { status: 'registered' },
        custom: {}
      };
      const filter = { eventId, ...(statusMap[mailType] || {}) };
      const regs = await Registration.find(filter);
      recipients = regs.map(r => ({ email: r.email, name: r.name }));
    }

    if (recipients.length === 0) return res.status(400).json({ error: 'No recipients found' });

    const results = { sent: 0, failed: 0, errors: [], total: recipients.length };

    for (const rec of recipients) {
      const personalizedSubject = personalizeMail(subject, { name: rec.name, eventName, eventDate, eventVenue, orgName });
      const personalizedBody = personalizeMail(body, { name: rec.name, eventName, eventDate, eventVenue, orgName });

      const finalHtml = personalizedBody.includes('<html') || personalizedBody.includes('<div')
        ? personalizedBody
        : wrapHtmlEmail({ subject: personalizedSubject, body: personalizedBody, orgName });

      const emailTypeMap = { shortlisted: 'shortlisted', not_shortlisted: 'rejected', reminder: 'reminder', confirmation: 'confirmation', custom: 'custom' };
      const result = await sendEmail({ to: rec.email, toName: rec.name, subject: personalizedSubject, html: finalHtml, type: emailTypeMap[mailType] || 'custom', eventId: eventId || null });

      if (result.success) {
        results.sent++;
        if (eventId) {
          const flagMap = {
            shortlisted: { shortlistEmailSent: true, shortlistEmailSentAt: new Date(), status: 'shortlisted' },
            not_shortlisted: { rejectionEmailSent: true, rejectionEmailSentAt: new Date(), status: 'rejected' },
            reminder: { reminderEmailSent: true, reminderEmailSentAt: new Date() },
            confirmation: { confirmationEmailSent: true, confirmationEmailSentAt: new Date() }
          };
          if (flagMap[mailType]) {
            await Registration.findOneAndUpdate({ eventId, email: rec.email }, flagMap[mailType]);
          }
        }
      } else {
        results.failed++;
        results.errors.push({ email: rec.email, error: result.error });
      }
      await new Promise(r => setTimeout(r, 150));
    }

    res.json({ message: 'Targeted emails processed', ...results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

registrationsRouter.post('/preview-certificate-standalone', eventsUpload.single('certificateTemplate'), async (req, res) => {
  try {
    const { sampleName, eventName, date, certNameX, certNameY, certFontSize, certFontColor } = req.body;
    const templatePath = req.file ? req.file.path : null;

    const certBuffer = await generateCertificate({
      name: sampleName || 'Sample Participant',
      eventName: eventName || 'Sample Event',
      date: date || '15 January 2026',
      templatePath,
      certNameX: certNameX != null ? parseFloat(certNameX) : 50,
      certNameY: certNameY != null ? parseFloat(certNameY) : 50,
      certFontSize: certFontSize != null ? parseInt(certFontSize) : 48,
      certFontColor: certFontColor || '#000000'
    });

    if (templatePath) {
      try { fs.unlinkSync(templatePath); } catch (_) {}
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="certificate_preview.pdf"'
    });
    res.send(certBuffer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

registrationsRouter.post('/send-certificates', regUpload.fields([
  { name: 'certificateTemplate', maxCount: 1 }
]), async (req, res) => {
  try {
    const { eventId, participants: participantsJson } = req.body;
    let event = null;
    let templatePath = null;
    let eventName = 'Event';
    let eventDate = 'TBA';
    let eventVenue = 'TBA';

    const settings = await Settings.getSettings();
    const orgName = settings.orgName || 'Event Team';

    const templateUpload = req.files && req.files.certificateTemplate ? req.files.certificateTemplate[0] : null;

    if (eventId) {
      event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      
      eventName = event.name;
      eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
      eventVenue = event.venue || '';

      if (templateUpload) {
        const newPath = path.join(__dirname, 'uploads/templates', `template_${Date.now()}${path.extname(templateUpload.originalname)}`);
        fs.renameSync(templateUpload.path, newPath);
        await Event.findByIdAndUpdate(eventId, { certificateTemplate: newPath });
        event.certificateTemplate = newPath;
      }
      templatePath = event.certificateTemplate;
    } else {
      if (!participantsJson) return res.status(400).json({ error: 'Participants data required for standalone certificates' });
      if (!templateUpload) return res.status(400).json({ error: 'Certificate template required for standalone certificates' });
      templatePath = templateUpload.path;
    }

    const certNameX = req.body.certNameX != null ? parseFloat(req.body.certNameX) : (event ? event.certNameX : 50);
    const certNameY = req.body.certNameY != null ? parseFloat(req.body.certNameY) : (event ? event.certNameY : 50);
    const certFontSize = req.body.certFontSize != null ? parseInt(req.body.certFontSize) : (event ? event.certFontSize : 48);
    const certFontColor = req.body.certFontColor || (event ? event.certFontColor : '#000000');
    const certSubject = req.body.certificateSubject || (event ? event.certificateSubject : `🎓 Your Certificate`);
    const certBody = req.body.certificateBody || (event ? event.certificateBody : '');

    let participants = [];
    if (participantsJson) {
      try {
        participants = JSON.parse(participantsJson);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid participants JSON format' });
      }
    } else if (event) {
      const regs = await Registration.find({
        eventId,
        status: { $in: ['shortlisted', 'participated'] },
        certificateEmailSent: { $ne: true }
      });
      participants = regs.map(r => ({ name: r.name, email: r.email, regId: r._id.toString() }));
    }

    if (participants.length === 0) {
      if (!eventId && templatePath) {
        try { fs.unlinkSync(templatePath); } catch(_) {}
      }
      return res.json({ message: 'No participants to send certificates to', sent: 0, failed: 0, total: 0 });
    }

    const results = { sent: 0, failed: 0, errors: [], total: participants.length };

    for (const participant of participants) {
      if (participant.regId) {
        const reg = await Registration.findById(participant.regId);
        if (reg && reg.certificateEmailSent) { results.total--; continue; }
      }

      try {
        const certBuffer = await generateCertificate({
          name: participant.name,
          eventName,
          date: eventDate,
          templatePath,
          certNameX, certNameY, certFontSize, certFontColor
        });

        const personalizedSubject = personalizeMail(certSubject, { name: participant.name, eventName, eventDate, eventVenue, orgName });
        const emailHtml = certBody
          ? wrapHtmlEmail({ subject: personalizedSubject, body: personalizeMail(certBody, { name: participant.name, eventName, eventDate, eventVenue, orgName }), orgName })
          : certificateEmailTemplate({ name: participant.name, eventName });

        const safeName = participant.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const safeEventName = eventName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const filename = `${safeName}_${safeEventName}_Certificate.pdf`;

        const result = await sendEmail({
          to: participant.email,
          toName: participant.name,
          subject: personalizedSubject,
          html: emailHtml,
          type: 'certificate',
          eventId: eventId || null,
          attachments: [{ filename, content: certBuffer, contentType: 'application/pdf' }]
        });

        if (result.success) {
          results.sent++;
          if (participant.regId) {
            await Registration.findByIdAndUpdate(participant.regId, {
              certificateEmailSent: true,
              certificateEmailSentAt: new Date()
            });
          }
        } else {
          results.failed++;
          results.errors.push({ email: participant.email, name: participant.name, error: result.error });
        }
      } catch (certErr) {
        results.failed++;
        results.errors.push({ email: participant.email, name: participant.name, error: certErr.message });
      }
      await new Promise(r => setTimeout(r, 250));
    }

    if (!eventId && templatePath) {
      try { fs.unlinkSync(templatePath); } catch(_) {}
    }

    res.json({ message: 'Certificate dispatch complete', ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

registrationsRouter.post('/retry-certificate/:regId', async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.regId).populate('eventId');
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.certificateEmailSent) return res.status(400).json({ error: 'Certificate already sent to this participant' });

    const event = await Event.findById(reg.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    const certBuffer = await generateCertificate({
      name: reg.name, eventName: event.name, date: eventDate,
      templatePath: event.certificateTemplate,
      certNameX: event.certNameX, certNameY: event.certNameY,
      certFontSize: event.certFontSize, certFontColor: event.certFontColor
    });

    const safeName = reg.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const safeEvent = event.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const filename = `${safeName}_${safeEvent}_Certificate.pdf`;
    const subject = `🎓 Your Certificate — ${event.name}`;
    const html = certificateEmailTemplate({ name: reg.name, eventName: event.name });

    const result = await sendEmail({
      to: reg.email, toName: reg.name, subject, html,
      type: 'certificate', eventId: event._id,
      attachments: [{ filename, content: certBuffer, contentType: 'application/pdf' }]
    });

    if (result.success) {
      await Registration.findByIdAndUpdate(reg._id, { certificateEmailSent: true, certificateEmailSentAt: new Date() });
      res.json({ message: 'Certificate resent successfully' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

registrationsRouter.post('/webhook/:eventId', async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== (process.env.WEBHOOK_SECRET || 'mailcerti_wh_secret_2025'))
      return res.status(401).json({ error: 'Unauthorized' });

    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const body = req.body;
    const name = (body.name || body.Name || body['Full Name'] || body['Participant Name'] || '').trim();
    const email = (body.email || body.Email || body['Email Address'] || body['Email ID'] || '').trim().toLowerCase();
    const college = (body.college || body.College || body['College Name'] || body.Institution || '').trim();
    const teamName = (body.teamName || body['Team Name'] || body.team || '').trim();
    const phone = (body.phone || body.Phone || body.Mobile || '').toString().trim();
    const memberNames = body.memberNames ? (Array.isArray(body.memberNames) ? body.memberNames : body.memberNames.split(',').map(s => s.trim())) : [];
    const memberEmails = body.memberEmails ? (Array.isArray(body.memberEmails) ? body.memberEmails : body.memberEmails.split(',').map(s => s.trim().toLowerCase())) : [];

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    if (!name) return res.status(400).json({ error: 'Name required' });

    const existing = await Registration.findOne({ eventId, email });
    if (existing) return res.status(200).json({ status: 'skipped', message: 'Already registered' });

    const isTeam = event.participationType === 'team';
    const reg = await Registration.create({
      eventId, name, email, teamName, college, phone, source: 'google_form',
      isTeamLeader: true, teamId: isTeam ? uuidv4() : undefined,
      memberNames: isTeam ? memberNames : [],
      memberEmails: isTeam ? memberEmails : []
    });

    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    const settings = await Settings.getSettings();
    const orgName = settings.orgName || 'Event Team';

    let subject, html;
    if (event.confirmationSubject && event.confirmationBody) {
      subject = personalizeMail(event.confirmationSubject, { name, eventName: event.name, eventDate, eventVenue: event.venue, orgName, teamName });
      html = wrapHtmlEmail({ subject, body: personalizeMail(event.confirmationBody, { name, eventName: event.name, eventDate, eventVenue: event.venue, orgName, teamName }), orgName });
    } else {
      subject = `Registration Confirmed — ${event.name}`;
      html = confirmationTemplate({ name, eventName: event.name, eventDate, eventVenue: event.venue, teamName, memberNames, isTeam });
    }

    const emailTargets = [{ name, email }];
    if (isTeam && event.teamEmailPolicy === 'all_members') {
      memberEmails.forEach((me, i) => { if (me && me.includes('@')) emailTargets.push({ name: memberNames[i] || name, email: me }); });
    }

    let sent = false;
    for (const t of emailTargets) {
      const r = await sendEmail({ to: t.email, toName: t.name, subject, html: html.replace(/\{\{name\}\}/g, t.name), type: 'confirmation', eventId });
      if (r.success) sent = true;
      await new Promise(res => setTimeout(res, 100));
    }
    await Registration.findByIdAndUpdate(reg._id, { confirmationEmailSent: sent, confirmationEmailSentAt: sent ? new Date() : undefined });

    res.status(201).json({ status: 'registered', confirmationEmailSent: sent, registrationId: reg._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Analytics Router
const analyticsRouter = express.Router();

analyticsRouter.get('/dashboard', async (req, res) => {
  try {
    const { eventId } = req.query;
    const filter = eventId ? { eventId } : {};
    const regFilter = eventId ? { eventId } : {};

    const [totalEmails, sentEmails, openedEmails, failedEmails] = await Promise.all([
      EmailLog.countDocuments(filter),
      EmailLog.countDocuments({ ...filter, status: 'sent' }),
      EmailLog.countDocuments({ ...filter, opened: true }),
      EmailLog.countDocuments({ ...filter, status: 'failed' })
    ]);

    const [totalRegistered, totalShortlisted, totalRejected, certSent] = await Promise.all([
      Registration.countDocuments(regFilter),
      Registration.countDocuments({ ...regFilter, status: 'shortlisted' }),
      Registration.countDocuments({ ...regFilter, status: 'rejected' }),
      Registration.countDocuments({ ...regFilter, certificateEmailSent: true })
    ]);

    const events = await Event.find().sort({ date: -1 }).limit(10);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const emailsPerDay = await EmailLog.aggregate([
      { $match: { ...filter, sentAt: { $gte: fourteenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      emails: { total: totalEmails, sent: sentEmails, failed: failedEmails, opened: openedEmails, openRate: sentEmails > 0 ? ((openedEmails/sentEmails)*100).toFixed(1) : 0, perDay: emailsPerDay },
      registrations: { total: totalRegistered, shortlisted: totalShortlisted, rejected: totalRejected, certSent },
      events
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

analyticsRouter.get('/event/:eventId', async (req, res) => {
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
      certificateSent: regs.filter(r => r.certificateEmailSent).length
    };
    res.json({ event, stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

analyticsRouter.get('/track-open/:logId', async (req, res) => {
  try { await EmailLog.findByIdAndUpdate(req.params.logId, { opened: true, openedAt: new Date() }); } catch(_) {}
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set('Content-Type', 'image/gif');
  res.send(pixel);
});

// Compose / AI Router
const composeRouter = express.Router();

composeRouter.post('/generate', async (req, res) => {
  try {
    const { emailType, eventName, eventDate, eventVenue, eventDescription, customNote, tone } = req.body;
    const typeDescriptions = {
      confirmation: 'a warm registration confirmation email',
      shortlisted:  'an exciting shortlist announcement email',
      reminder:     'a friendly reminder email about the event tomorrow',
      rejection:    'a polite, empathetic rejection email',
      not_shortlisted: 'a polite, empathetic not-shortlisted email',
      promotion:    'a compelling promotional email inviting a college',
      custom:       'a professional event-related email'
    };
    const toneMap = { professional: 'professional and formal', friendly: 'friendly and warm', exciting: 'exciting and energetic', formal: 'very formal' };

    const prompt = `You are an expert email copywriter for college tech events.
Write ${typeDescriptions[emailType] || typeDescriptions.custom} for:
- Event Name: ${eventName || 'Upcoming Event'}
- Event Date: ${eventDate || 'TBA'}
- Venue: ${eventVenue || 'TBA'}
- Description: ${eventDescription || 'A premier college event'}
- Tone: ${toneMap[tone] || 'professional and friendly'}
${customNote ? `- Additional: ${customNote}` : ''}

Requirements:
1. Subject line only (no "Subject:" prefix)
2. Email body text only (no HTML, just plain text with newlines)
3. Use placeholders: {{name}}, {{eventName}}, {{eventDate}}, {{eventVenue}}, {{orgName}}, {{teamName}}
4. Keep it concise and impactful

Return ONLY valid JSON: {"subject": "...", "body": "..."}`;

    const result = await generateContentWithFallback(prompt, { responseMimeType: 'application/json' });
    const text = result.response.text().trim();
    const parsed = safeParseJSON(text);
    res.json({ subject: parsed.subject, body: parsed.body || parsed.html || '' });
  } catch (err) {
    console.error('Gemini error:', err);
    if (err.message.includes('GEMINI_API_KEY')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'AI generation failed: ' + err.message });
  }
});

composeRouter.post('/test-send', async (req, res) => {
  try {
    const { to, subject, body, eventId } = req.body;
    if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, body required' });
    const settings = await Settings.getSettings();
    const orgName = settings.orgName || 'Event Team';
    const html = body.includes('<html') || body.includes('<div') ? body : wrapHtmlEmail({ subject, body, orgName });
    const result = await sendEmail({ to, toName: 'Test', subject: `[TEST] ${subject}`, html, type: 'test', eventId: eventId || null });
    if (result.success) res.json({ message: `Test email sent to ${to}` });
    else res.status(500).json({ error: result.error });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Settings Router
const settingsRouter = express.Router();

settingsRouter.get('/', async (req, res) => {
  try { res.json(await Settings.getSettings()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

settingsRouter.put('/', async (req, res) => {
  try {
    const { fromName, fromEmail, orgName, replyTo, geminiApiKey, allowedEmails } = req.body;
    if (!fromName || !fromEmail) return res.status(400).json({ error: 'From Name and From Email required' });
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ fromName, fromEmail, orgName, replyTo, geminiApiKey, allowedEmails });
    else {
      Object.assign(settings, { fromName, fromEmail, orgName: orgName || '', replyTo: replyTo || '', geminiApiKey: geminiApiKey || '', allowedEmails: allowedEmails || [], updatedAt: new Date() });
      await settings.save();
    }
    res.json({ message: 'Settings saved', settings });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

settingsRouter.post('/test-email', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient required' });
    const settings = await Settings.getSettings();
    if (!settings.fromEmail) return res.status(400).json({ error: 'Configure From Email first' });
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#0f0f1a;color:#fff;border-radius:16px;border:1px solid #14B8A6">
      <h2 style="color:#14B8A6">&#x1F9EA; Test Email &mdash; MailCerti</h2>
      <p>SMTP is working correctly!</p>
      <p><strong>From:</strong> ${settings.fromName} &lt;${settings.fromEmail}&gt;</p>
      <p><strong>Org:</strong> ${settings.orgName || 'Not set'}</p>
      <p style="color:#888;font-size:12px">Sent at: ${new Date().toLocaleString('en-IN')}</p>
    </div>`;
    const result = await sendEmail({ to, toName: 'Admin', subject: '&#x1F9EA; MailCerti Test Email', html, type: 'test' });
    if (result.success) res.json({ message: `Test email sent to ${to}` });
    else res.status(500).json({ error: result.error });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 6. APP STARTUP
// ==========================================

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  /\.onrender\.com$/
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    callback(null, allowedOrigins.some(o => typeof o === 'string' ? o === origin : o.test(origin)));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

['uploads/temp', 'uploads/templates'].forEach(dir => {
  if (!fs.existsSync(path.join(__dirname, dir)))
    fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

// Wire routes
app.use('/api/auth', authRouter);
app.use('/api/events', authenticateToken, eventsRouter);
app.use('/api/registrations', (req, res, next) => {
  if (req.originalUrl.includes('/webhook') && req.method === 'POST') return next();
  return authenticateToken(req, res, next);
}, registrationsRouter);
app.use('/api/analytics', (req, res, next) => {
  if (req.originalUrl.includes('/track-open') && req.method === 'GET') return next();
  return authenticateToken(req, res, next);
}, analyticsRouter);
app.use('/api/settings', authenticateToken, settingsRouter);
app.use('/api/compose', authenticateToken, composeRouter);
app.get('/api/excel-template', authenticateToken, async (req, res) => {
  try {
    const type = req.query.type || 'individual';
    let headers;
    if (type === 'team') {
      headers = [['team_name','leader_name','leader_email','member1_name','member1_email','member2_name','member2_email','member3_name','member3_email','college','phone']];
    } else {
      headers = [['name','email','college','phone']];
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    if (type === 'team') {
      XLSX.utils.sheet_add_aoa(ws, [['TeamAlpha','Alice','alice@example.com','Bob','bob@example.com','Carol','carol@example.com','','','XYZ College','9876543210']], { origin: 'A2' });
    } else {
      XLSX.utils.sheet_add_aoa(ws, [['Alice Smith','alice@example.com','XYZ College','9876543210']], { origin: 'A2' });
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template_${type}.xlsx"`
    });
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/analyze-headers', authenticateToken, async (req, res) => {
  try {
    const { headers, taskType } = req.body;
    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({ error: 'headers array is required' });
    }

    const isTeam = taskType === 'team';
    const targetFieldsDesc = isTeam
      ? `- teamName: The name of the team
- leaderName: The name of the team leader
- leaderEmail: The email of the team leader
- member1Name: The name of the first team member (optional)
- member1Email: The email of the first team member (optional)
- member2Name: The name of the second team member (optional)
- member2Email: The email of the second team member (optional)
- member3Name: The name of the third team member (optional)
- member3Email: The email of the third team member (optional)
- college: The college name (optional)
- phone: The contact phone number (optional)`
      : `- name: The participant name
- email: The participant email
- college: The college name (optional)
- phone: The contact phone number (optional)`;

    const prompt = `You are an AI data mapper.
Analyze the following list of Excel column headers and map them to the target fields.
Excel Headers: ${JSON.stringify(headers)}

Target Fields:
${targetFieldsDesc}

Requirements:
1. Map each target field to exactly one Excel header from the provided list, or null if there is no clear match.
2. Return ONLY a valid JSON object mapping the target field names to the corresponding Excel header strings (exactly as they appear in the list).
3. Do not include markdown formatting like \`\`\`json. Return only the raw JSON.

Return format: {"fieldName1": "ExcelHeaderA", "fieldName2": "ExcelHeaderB", ...}`;

    const result = await generateContentWithFallback(prompt, { responseMimeType: 'application/json' });
    const text = result.response.text().trim();
    const parsed = safeParseJSON(text);
    res.json(parsed);
  } catch (err) {
    console.error('Header analysis error:', err);
    res.status(500).json({ error: 'Header analysis failed: ' + err.message });
  }
});
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/api/list-models', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const key = (settings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) return res.status(400).json({ error: 'API key not configured' });
    const https = require('https');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => {
        try {
          res.json(JSON.parse(data));
        } catch (e) {
          res.send(data);
        }
      });
    }).on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mail_certi')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Daily reminder cron (8am)
cron.schedule('0 8 * * *', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(new Date(tomorrow).setHours(0,0,0,0));
  const end = new Date(new Date(tomorrow).setHours(23,59,59,999));
  const events = await Event.find({ date: { $gte: start, $lte: end } });
  for (const event of events) {
    const shortlisted = await Registration.find({ eventId: event._id, status: 'shortlisted', reminderEmailSent: { $ne: true } });
    const eventDate = new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
    for (const reg of shortlisted) {
      const html = reminderTemplate({ name: reg.name, eventName: event.name, eventDate, eventVenue: event.venue });
      const result = await sendEmail({ to: reg.email, toName: reg.name, subject: `⏰ Reminder: ${event.name} is Tomorrow!`, html, type: 'reminder', eventId: event._id });
      await Registration.findByIdAndUpdate(reg._id, { reminderEmailSent: result.success, reminderEmailSentAt: result.success ? new Date() : undefined });
      await new Promise(r => setTimeout(r, 200));
    }
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
