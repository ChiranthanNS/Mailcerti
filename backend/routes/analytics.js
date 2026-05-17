const express = require('express');
const router = express.Router();
const EmailLog = require('../models/EmailLog');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const PromotionEmail = require('../models/PromotionEmail');

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

module.exports = router;
