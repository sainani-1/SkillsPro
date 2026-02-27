// Email reminder utility functions
// These are stubs - integrate with SendGrid, AWS SES, or your email service

export const sendSessionReminder = async (userEmail, userName, sessionTitle, sessionTime, joinLink) => {
  console.log('📧 [EMAIL STUB] Sending session reminder...');
  console.log({
    to: userEmail,
    subject: `Reminder: ${sessionTitle} starts in 20 minutes`,
    body: `Hi ${userName},\n\nYour session "${sessionTitle}" starts at ${sessionTime}.\n\nJoin here: ${joinLink}\n\nSee you soon!\n- SkillPro Team`
  });
  
  // TODO: Integrate with actual email service
  // Example with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: userEmail,
  //   from: 'noreply@skillpro.com',
  //   subject: `Reminder: ${sessionTitle} starts in 20 minutes`,
  //   html: `<p>Hi ${userName},</p><p>Your session starts soon!</p>`
  // });
  
  return { success: true, stub: true };
};

export const sendPremiumExpiryReminder = async (userEmail, userName, expiryDate) => {
  console.log('📧 [EMAIL STUB] Sending premium expiry reminder...');
  console.log({
    to: userEmail,
    subject: 'Your Premium Access Expires in 5 Days',
    body: `Hi ${userName},\n\nYour premium access expires on ${expiryDate}.\n\nRenew now: https://skillpro.com/app/payment\n\n- SkillPro Team`
  });
  
  // TODO: Integrate with actual email service
  return { success: true, stub: true };
};

export const sendWelcomeEmail = async (userEmail, userName) => {
  console.log('📧 [EMAIL STUB] Sending welcome email...');
  console.log({
    to: userEmail,
    subject: 'Welcome to SkillPro!',
    body: `Hi ${userName},\n\nWelcome to SkillPro! Start your learning journey today.\n\n- SkillPro Team`
  });
  
  return { success: true, stub: true };
};

export const sendTeacherAssignmentEmail = async (userEmail, userName, teacherName) => {
  console.log('📧 [EMAIL STUB] Sending teacher assignment notification...');
  console.log({
    to: userEmail,
    subject: `You've been assigned to ${teacherName}`,
    body: `Hi ${userName},\n\nGreat news! ${teacherName} is now your assigned teacher.\n\nYou can start chatting and attending live classes.\n\n- SkillPro Team`
  });
  
  return { success: true, stub: true };
};

export const sendCertificateEmail = async (userEmail, userName, courseTitle, certificateId) => {
  console.log('📧 [EMAIL STUB] Sending certificate notification...');
  console.log({
    to: userEmail,
    subject: `Congratulations! You earned a certificate`,
    body: `Hi ${userName},\n\nCongratulations on completing ${courseTitle}!\n\nView your certificate: https://skillpro.com/verify/${certificateId}\n\n- SkillPro Team`
  });
  
  return { success: true, stub: true };
};

// Cron job function to check and send reminders
// This should run every 5 minutes
export const checkAndSendReminders = async () => {
  console.log('🔔 [CRON STUB] Checking for pending reminders...');
  
  // TODO: Query renewal_reminders table
  // TODO: Send emails for due reminders
  // TODO: Mark reminders as sent
  
  /*
  const { data: reminders } = await supabase
    .from('renewal_reminders')
    .select('*')
    .lte('scheduled_for', new Date().toISOString())
    .is('sent_at', null);
  
  for (const reminder of reminders) {
    if (reminder.reminder_type === 'premium_expiry') {
      await sendPremiumExpiryReminder(reminder.user_email, reminder.user_name, reminder.expiry_date);
    } else if (reminder.reminder_type === 'session_reminder') {
      await sendSessionReminder(reminder.user_email, reminder.user_name, reminder.session_title, reminder.session_time, reminder.join_link);
    }
    
    // Mark as sent
    await supabase
      .from('renewal_reminders')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', reminder.id);
  }
  */
  
  return { checked: 0, sent: 0, stub: true };
};

export default {
  sendSessionReminder,
  sendPremiumExpiryReminder,
  sendWelcomeEmail,
  sendTeacherAssignmentEmail,
  sendCertificateEmail,
  checkAndSendReminders
};
