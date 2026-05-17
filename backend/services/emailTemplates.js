/**
 * Email Templates
 */

function promotionTemplate({ eventName, eventDate, eventVenue, eventDescription, collegeNam, customMessage }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 28px; letter-spacing: 1px; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 35px 30px; }
    .event-card { background: #f8f9ff; border-left: 4px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .event-card h2 { color: #333; margin: 0 0 10px; font-size: 20px; }
    .detail { display: flex; align-items: center; margin: 8px 0; color: #555; font-size: 14px; }
    .detail span { font-weight: bold; min-width: 80px; color: #444; }
    .cta-btn { display: block; width: fit-content; margin: 25px auto; padding: 14px 35px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; text-decoration: none; border-radius: 30px; font-size: 15px; font-weight: bold; text-align: center; }
    .footer { background: #f4f6f9; padding: 20px 30px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 You're Invited!</h1>
      <p>An exciting event awaits your college</p>
    </div>
    <div class="body">
      <p>Dear <strong>${collegeNam || 'Team'}</strong>,</p>
      <p>We are thrilled to invite your college to participate in our upcoming event!</p>
      
      <div class="event-card">
        <h2>📅 ${eventName}</h2>
        <div class="detail"><span>Date:</span> ${eventDate}</div>
        <div class="detail"><span>Venue:</span> ${eventVenue || 'To be announced'}</div>
        ${eventDescription ? `<p style="color:#555;margin-top:10px;">${eventDescription}</p>` : ''}
      </div>

      ${customMessage ? `<p style="color:#444;line-height:1.7;">${customMessage}</p>` : ''}
      
      <p>We look forward to your enthusiastic participation!</p>
    </div>
    <div class="footer">
      <p>This is a promotional email. If you have questions, please reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

function confirmationTemplate({ name, eventName, eventDate, eventVenue }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #11998e, #38ef7d); padding: 40px 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 26px; }
    .body { padding: 35px 30px; color: #444; line-height: 1.7; }
    .badge { background: #e8fff2; border: 2px solid #38ef7d; border-radius: 50px; padding: 10px 25px; display: inline-block; margin: 15px 0; color: #11998e; font-weight: bold; font-size: 15px; }
    .info-box { background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .footer { background: #f4f6f9; padding: 20px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Registration Confirmed!</h1>
    </div>
    <div class="body">
      <p>Dear <strong>${name}</strong>,</p>
      <div class="badge">🎊 You're Registered!</div>
      <p>Your registration for <strong>${eventName}</strong> has been successfully received.</p>
      <div class="info-box">
        <p><strong>📅 Event Date:</strong> ${eventDate}</p>
        <p><strong>📍 Venue:</strong> ${eventVenue || 'To be announced'}</p>
      </div>
      <p><strong>⏳ Next Steps:</strong> Our team will review registrations and notify you about your shortlisting status shortly. Please wait for further communication.</p>
      <p>Thank you for registering! We'll keep you updated.</p>
    </div>
    <div class="footer"><p>Sent by Event Management System</p></div>
  </div>
</body>
</html>`;
}

function shortlistedTemplate({ name, eventName, eventDate, eventVenue, instructions }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f7971e, #ffd200); padding: 40px 30px; text-align: center; }
    .header h1 { color: #333; margin: 0; font-size: 26px; }
    .body { padding: 35px 30px; color: #444; line-height: 1.7; }
    .star-badge { font-size: 50px; text-align: center; margin: 10px 0; }
    .info-box { background: #fffbe6; border-left: 4px solid #ffd200; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .footer { background: #f4f6f9; padding: 20px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌟 Congratulations! You're Shortlisted!</h1>
    </div>
    <div class="body">
      <p>Dear <strong>${name}</strong>,</p>
      <div class="star-badge">🏆</div>
      <p>We are delighted to inform you that you have been <strong>shortlisted</strong> to participate in <strong>${eventName}</strong>!</p>
      <div class="info-box">
        <p><strong>📅 Event Date:</strong> ${eventDate}</p>
        <p><strong>📍 Venue:</strong> ${eventVenue || 'To be announced'}</p>
      </div>
      ${instructions ? `<p><strong>📌 Instructions:</strong><br>${instructions}</p>` : ''}
      <p>Please be prepared and on time. A reminder email will be sent before the event.</p>
      <p>All the best! 💪</p>
    </div>
    <div class="footer"><p>Sent by Event Management System</p></div>
  </div>
</body>
</html>`;
}

function rejectedTemplate({ name, eventName }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #636363, #a2a2a2); padding: 40px 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; }
    .body { padding: 35px 30px; color: #444; line-height: 1.7; }
    .footer { background: #f4f6f9; padding: 20px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank You for Participating</h1>
    </div>
    <div class="body">
      <p>Dear <strong>${name}</strong>,</p>
      <p>Thank you for registering for <strong>${eventName}</strong>.</p>
      <p>We regret to inform you that you have not been shortlisted for this event. We had many talented participants and the selection was very competitive.</p>
      <p>Please don't be disheartened. We encourage you to participate in our future events. Your enthusiasm means a lot to us!</p>
      <p>Thank you for your interest. Keep going! 💙</p>
    </div>
    <div class="footer"><p>Sent by Event Management System</p></div>
  </div>
</body>
</html>`;
}

function reminderTemplate({ name, eventName, eventDate, eventVenue }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #fc466b, #3f5efb); padding: 40px 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 26px; }
    .body { padding: 35px 30px; color: #444; line-height: 1.7; }
    .countdown { background: linear-gradient(135deg, #fc466b, #3f5efb); color: #fff; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; font-size: 22px; font-weight: bold; }
    .checklist { background: #f8f9ff; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .checklist li { margin: 8px 0; color: #555; }
    .footer { background: #f4f6f9; padding: 20px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Event Tomorrow — Don't Miss It!</h1>
    </div>
    <div class="body">
      <p>Dear <strong>${name}</strong>,</p>
      <div class="countdown">🚀 ${eventName} is TOMORROW!</div>
      <p><strong>📅 Date:</strong> ${eventDate}<br><strong>📍 Venue:</strong> ${eventVenue || 'To be announced'}</p>
      <div class="checklist">
        <p><strong>✅ Pre-Event Checklist:</strong></p>
        <ul>
          <li>Confirm your attendance and team members</li>
          <li>Carry your ID card and registration confirmation</li>
          <li>Reach the venue 15 minutes early</li>
          <li>Bring any required materials</li>
        </ul>
      </div>
      <p>We are excited to see you tomorrow! Good luck! 🎉</p>
    </div>
    <div class="footer"><p>Sent by Event Management System</p></div>
  </div>
</body>
</html>`;
}

function certificateEmailTemplate({ name, eventName }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f093fb, #f5576c); padding: 40px 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 26px; }
    .body { padding: 35px 30px; color: #444; line-height: 1.7; }
    .cert-badge { background: linear-gradient(135deg, #f093fb20, #f5576c20); border: 2px solid #f5576c; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
    .footer { background: #f4f6f9; padding: 20px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏅 Your Certificate of Participation</h1>
    </div>
    <div class="body">
      <p>Dear <strong>${name}</strong>,</p>
      <div class="cert-badge">
        <p style="font-size:40px;margin:0">🎓</p>
        <p style="font-weight:bold;color:#f5576c;margin:5px 0">Certificate Attached!</p>
      </div>
      <p>Congratulations on successfully participating in <strong>${eventName}</strong>!</p>
      <p>Please find your <strong>Certificate of Participation</strong> attached to this email. This certificate recognizes your dedication and contribution to the event.</p>
      <p>We hope to see you at more of our events in the future. Keep up the great work!</p>
      <p>Best regards,<br><strong>Event Management Team</strong></p>
    </div>
    <div class="footer"><p>Sent by Event Management System | Certificate attached as PDF</p></div>
  </div>
</body>
</html>`;
}

module.exports = {
  promotionTemplate,
  confirmationTemplate,
  shortlistedTemplate,
  rejectedTemplate,
  reminderTemplate,
  certificateEmailTemplate
};
