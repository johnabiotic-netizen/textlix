const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  if (!transporter) {
    logger.info(`[EMAIL] To: ${to} | Subject: ${subject}`);
    logger.info(`[EMAIL] ${html.replace(/<[^>]+>/g, '')}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@verifynow.com',
    to,
    subject,
    html,
  });
};

const sendVerificationEmail = async (email, token) => {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your VerifyNow email',
    html: `<p>Click the link to verify your email: <a href="${url}">${url}</a></p><p>Link expires in 24 hours.</p>`,
  });
};

const sendPasswordResetEmail = async (email, token) => {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your VerifyNow password',
    html: `<p>Click the link to reset your password: <a href="${url}">${url}</a></p><p>Link expires in 1 hour.</p>`,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
