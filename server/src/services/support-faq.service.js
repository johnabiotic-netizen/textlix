const settings = require('./support-settings');
const logger = require('../config/logger');

// FAQ deflection — answer common questions for $0 before ever calling Claude.
// The admin stores entries in PlatformSettings.support_faq as JSON:
//   [{ "patterns": ["how do i buy credits", "add credits"], "answer": "..." }]
// A message matches an entry if it contains any of that entry's patterns
// (normalized, case-insensitive). First match wins.
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getEntries() {
  const raw = await settings.getString('support_faq', '');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && Array.isArray(e.patterns) && e.answer);
  } catch (err) {
    logger.warn('support_faq is not valid JSON — ignoring:', err.message);
    return [];
  }
}

// Returns the matching answer string, or null if nothing matches.
async function findAnswer(text) {
  const entries = await getEntries();
  if (!entries.length) return null;
  const norm = normalize(text);
  if (!norm) return null;
  for (const entry of entries) {
    for (const p of entry.patterns) {
      const np = normalize(p);
      if (np && norm.includes(np)) return entry.answer;
    }
  }
  return null;
}

module.exports = { findAnswer };
