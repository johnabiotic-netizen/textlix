// Canonicalise an email so common provider-side aliases collapse to the same
// string. Used by the welcome-bonus service to detect "one human, many
// throwaway addresses" sign-up attempts.
//
// Rules applied:
// - Lowercase + trim.
// - Drop everything from the first `+` in the local part (works on
//   Gmail, Outlook/Hotmail, FastMail, Proton, iCloud and most modern
//   providers that support plus-aliasing).
// - For Gmail / Googlemail specifically, also strip dots from the local
//   part — Google explicitly ignores them.
// - Treat googlemail.com as gmail.com.
//
// Anything we don't recognise we still lowercase + plus-strip, so unknown
// providers get the cheap pass too.

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.toLowerCase().trim();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  // Drop +alias on every provider
  const plus = local.indexOf('+');
  if (plus !== -1) local = local.slice(0, plus);

  // Google: collapse googlemail.com → gmail.com, ignore dots in local
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');

  return `${local}@${domain}`;
}

module.exports = { normalizeEmail };
