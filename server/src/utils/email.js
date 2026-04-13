const { Resend } = require('resend');
const logger = require('../config/logger');

const getClient = () => {
  if (process.env.SMTP_PASS) return new Resend(process.env.SMTP_PASS);
  return null;
};

const sendEmail = async ({ to, subject, html }) => {
  const client = getClient();
  if (!client) {
    logger.info(`[EMAIL] To: ${to} | Subject: ${subject}`);
    return;
  }
  const { error } = await client.emails.send({
    from: process.env.EMAIL_FROM || 'noreply@textlix.com',
    to,
    subject,
    html,
  });
  if (error) logger.error('Email send error:', error);
};

const sendVerificationEmail = async (email, token) => {
  const serverUrl = (process.env.SERVER_URL || '').trim();
  const url = `${serverUrl}/api/v1/auth/verify-email/${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your TextLix email',
    html: `<p>Click the link to verify your email: <a href="${url}">${url}</a></p><p>Link expires in 24 hours.</p>`,
  });
};

const sendPasswordResetEmail = async (email, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || '').trim();
  const url = `${frontendUrl}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your TextLix password',
    html: `<p>Click the link to reset your password: <a href="${url}">${url}</a></p><p>Link expires in 1 hour.</p>`,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
