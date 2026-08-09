const { Resend } = require('resend');
const logger = require('../config/logger');

const getClient = () => {
  if (process.env.RESEND_API_KEY) return new Resend(process.env.RESEND_API_KEY);
  return null;
};

const sendEmail = async ({ to, subject, html }) => {
  const client = getClient();
  if (!client) {
    logger.warn(`[EMAIL SKIPPED - no RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
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

// HTML-escape interpolated user / provider content to prevent injection in emails.
// SMS bodies arrive from third-party providers and are attacker-controlled.
const escHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const sendSmsNotificationEmail = async (email, { phoneNumber, smsCode, smsContent }) => {
  const dashboardUrl = `${(process.env.FRONTEND_URL || '').trim()}/numbers/active`;
  const safePhone = escHtml(phoneNumber);
  const safeCode = escHtml(smsCode);
  const safeContent = escHtml(smsContent);
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Your verification code arrived</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      An SMS was received on <strong style="color:#111827;">${safePhone}</strong>.
    </p>

    ${smsCode ? `
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;padding:28px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.8);letter-spacing:1px;text-transform:uppercase;">Verification Code</p>
      <p style="margin:0;font-size:42px;font-weight:800;color:#fff;letter-spacing:8px;">${safeCode}</p>
    </div>
    ` : ''}

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0;font-size:12px;color:#6b7280;font-family:monospace;word-break:break-word;">${safeContent}</p>
    </div>

    <div style="text-align:center;">
      <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;">
        View in Dashboard
      </a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#d1d5db;text-align:center;">To stop receiving these emails, turn off SMS notifications in your account settings.</p>
  `;
  await sendEmail({
    to: email,
    subject: smsCode ? `Your code: ${smsCode} — TextLix` : 'SMS received — TextLix',
    html: baseTemplate('SMS Received — TextLix', body),
  });
};

const sendPaymentConfirmedEmail = async (email, { credits, amountUSD, newBalance, name }) => {
  const dashboardUrl = `${(process.env.FRONTEND_URL || '').trim()}/dashboard`;
  const greeting = name ? `Hi ${escHtml(name)},` : 'Hi there,';
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Payment confirmed — credits added</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
      ${greeting} we've confirmed your payment${amountUSD ? ` of <strong style="color:#111827;">$${escHtml(amountUSD)}</strong>` : ''} and added your credits.
      Sorry for the delay in crediting your account — it's all sorted now.
    </p>

    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;padding:28px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.8);letter-spacing:1px;text-transform:uppercase;">Credits added</p>
      <p style="margin:0;font-size:42px;font-weight:800;color:#fff;">+${escHtml(credits)}</p>
      ${newBalance != null ? `<p style="margin:10px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">New balance: ${escHtml(newBalance)} credits</p>` : ''}
    </div>

    <div style="text-align:center;">
      <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;">
        Go to Dashboard
      </a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      Thank you for using TextLix. If you have any questions about this payment, just reply to this email.
    </p>
  `;
  await sendEmail({
    to: email,
    subject: `Payment confirmed — ${credits} credits added to your TextLix account`,
    html: baseTemplate('Payment confirmed — TextLix', body),
  });
};

const sendGoodwillCreditEmail = async (email, { credits, newBalance, name }) => {
  const dashboardUrl = `${(process.env.FRONTEND_URL || '').trim()}/dashboard`;
  const greeting = name ? `Hi ${escHtml(name)},` : 'Hi there,';
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">A little something for the trouble</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
      ${greeting} earlier your payment took longer than it should have to reflect in your account.
      That's on us — thanks for your patience. We've added some bonus credits as a small thank-you.
    </p>

    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;padding:28px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.8);letter-spacing:1px;text-transform:uppercase;">Bonus credits</p>
      <p style="margin:0;font-size:42px;font-weight:800;color:#fff;">+${escHtml(credits)}</p>
      ${newBalance != null ? `<p style="margin:10px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">New balance: ${escHtml(newBalance)} credits</p>` : ''}
    </div>

    <div style="text-align:center;">
      <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;">
        Go to Dashboard
      </a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      Thanks for sticking with TextLix. If there's anything else we can help with, just reply to this email.
    </p>
  `;
  await sendEmail({
    to: email,
    subject: `We added ${credits} bonus credits to your TextLix account`,
    html: baseTemplate('Bonus credits — TextLix', body),
  });
};

// Internal alert to the support inbox when a chat is escalated to a human.
const sendSupportEscalationEmail = async (to, { conversationId, preview, reason }) => {
  const adminUrl = `${(process.env.FRONTEND_URL || 'https://www.textlix.com').trim()}/admin/support`;
  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">A support chat needs a human</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
      The AI assistant handed off a conversation. ${reason ? `Reason: <strong>${escHtml(reason)}</strong>.` : ''}
    </p>
    ${preview ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 20px;font-size:13px;color:#374151;">“${escHtml(preview)}”</div>` : ''}
    <div style="text-align:center;">
      <a href="${adminUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;">
        Open Support Console
      </a>
    </div>
    <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;text-align:center;">Conversation ID: ${escHtml(conversationId || '')}</p>
  `;
  await sendEmail({
    to,
    subject: 'Support chat escalated — a customer is waiting',
    html: baseTemplate('Support escalation — TextLix', body),
  });
};

// Abandoned-checkout recovery nudge — "you started a top-up, finish it".
// Angle: no new discount, just spotlight the EXISTING pack bonuses + risk-free.
const sendRecoveryNudgeEmail = async (email, firstName) => {
  const name = firstName || 'there';
  const creditsUrl = 'https://textlix.com/credits';
  const packs = [
    { usd: '$5', total: 550, bonus: 50 },
    { usd: '$10', total: 1150, bonus: 150, popular: true },
    { usd: '$25', total: 3000, bonus: 500 },
    { usd: '$50', total: 6500, bonus: 1500 },
  ];
  const rows = packs.map((p) => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #eef2f7;font-weight:700;color:#111827;">${p.usd}${p.popular ? ' <span style="font-size:10px;font-weight:700;color:#6366f1;background:#eef2ff;padding:2px 6px;border-radius:6px;">POPULAR</span>' : ''}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #eef2f7;color:#111827;">${p.total.toLocaleString()} credits</td>
      <td style="padding:9px 12px;border-bottom:1px solid #eef2f7;color:#059669;font-weight:700;">+${p.bonus.toLocaleString()} free</td>
    </tr>`).join('');
  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Hey ${name}, you're almost there 👋</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      You started adding credits to your TextLix wallet but didn't finish checkout. No wahala — your account is ready, and picking up where you left off takes about <strong>30 seconds</strong>. Once you top up, grab a number and start receiving codes right away.
    </p>
    <div style="text-align:center;margin:26px 0;">
      <a href="${creditsUrl}" style="display:inline-block;background:#6366f1;color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:10px;">Finish my top-up →</a>
    </div>
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111827;">Load more, get more — free credits on every pack:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f7;border-radius:10px;overflow:hidden;font-size:13px;">
      <tr style="background:#f9fafb;"><td style="padding:8px 12px;font-weight:700;color:#6b7280;">Top up</td><td style="padding:8px 12px;font-weight:700;color:#6b7280;">You get</td><td style="padding:8px 12px;font-weight:700;color:#6b7280;">Bonus</td></tr>
      ${rows}
    </table>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;margin-top:18px;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#166534;"><strong>Risk-free:</strong> if a number doesn't receive your code in the wait window, you're automatically refunded in credits. You only pay for codes that land.</p>
    </div>`;
  await sendEmail({
    to: email,
    subject: `${name}, you're one step from your credits`,
    html: baseTemplate('Finish your TextLix top-up', body),
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendSmsNotificationEmail, sendPaymentConfirmedEmail, sendGoodwillCreditEmail, sendSupportEscalationEmail, sendRecoveryNudgeEmail };
