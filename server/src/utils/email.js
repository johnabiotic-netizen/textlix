const { Resend } = require('resend');
const logger = require('../config/logger');

const getClient = () => {
  if (process.env.SMTP_PASS) return new Resend(process.env.SMTP_PASS);
  return null;
};

const sendEmail = async ({ to, subject, html }) => {
  const client = getClient();
  if (!client) {
    logger.warn(`[EMAIL SKIPPED - no SMTP_PASS] To: ${to} | Subject: ${subject}`);
    return;
  }
  const from = process.env.EMAIL_FROM || 'TextLix <noreply@textlix.com>';
  const { data, error } = await client.emails.send({ from, to, subject, html });
  if (error) {
    logger.error('[EMAIL FAILED]', { to, subject, error });
    throw new Error(`Email delivery failed: ${error.message}`);
  }
  logger.info('[EMAIL SENT]', { to, subject, id: data?.id });
};

const baseTemplate = (title, bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <span style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-1px;">TextLix</span>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Virtual Phone Numbers &amp; SMS Verification</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          ${bodyHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} TextLix · <a href="https://textlix.com" style="color:#6366f1;text-decoration:none;">textlix.com</a></p>
          <p style="margin:8px 0 0;font-size:11px;color:#d1d5db;">You received this email because an account action was performed on TextLix.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const sendVerificationEmail = async (email, token) => {
  const serverUrl = (process.env.SERVER_URL || '').trim();
  const url = `${serverUrl}/api/v1/auth/verify-email/${token}`;
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Verify your email</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      Thanks for signing up for TextLix! Click the button below to verify your email address and activate your account.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;">
        Verify Email Address
      </a>
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
      Or copy this link into your browser:<br>
      <a href="${url}" style="color:#6366f1;word-break:break-all;font-size:12px;">${url}</a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#d1d5db;text-align:center;">This link expires in 24 hours. If you didn't create a TextLix account, you can safely ignore this email.</p>
  `;
  await sendEmail({
    to: email,
    subject: 'Verify your TextLix email address',
    html: baseTemplate('Verify your email — TextLix', body),
  });
};

const sendPasswordResetEmail = async (email, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || '').trim();
  const url = `${frontendUrl}/reset-password?token=${token}`;
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      We received a request to reset the password for your TextLix account. Click the button below to choose a new password.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;">
        Reset Password
      </a>
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
      Or copy this link into your browser:<br>
      <a href="${url}" style="color:#6366f1;word-break:break-all;font-size:12px;">${url}</a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#d1d5db;text-align:center;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
  `;
  await sendEmail({
    to: email,
    subject: 'Reset your TextLix password',
    html: baseTemplate('Reset your password — TextLix', body),
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
