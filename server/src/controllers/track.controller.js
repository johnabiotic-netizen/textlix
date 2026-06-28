const Visit = require('../models/Visit');
const { getIP, getUA } = require('../utils/audit');
const logger = require('../config/logger');

// Obvious bots/crawlers — we don't count these as visits.
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|node-fetch/i;

const str = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max) : null);

// POST /track/visit — public, fire-and-forget from the client on first landing.
// Upserts ONE visit doc per session (first-touch): $setOnInsert means repeat
// pings for the same session never overwrite the original acquisition data.
exports.recordVisit = async (req, res) => {
  try {
    const ua = getUA(req);
    if (BOT_UA.test(ua)) return res.json({ success: true, data: { skipped: 'bot' } });

    const { sessionId, attribution = {}, landingPath, referrer } = req.body || {};
    const sid = str(sessionId, 100);
    if (!sid) return res.json({ success: true, data: { skipped: 'no-session' } });

    await Visit.updateOne(
      { sessionId: sid },
      {
        $setOnInsert: {
          sessionId: sid,
          source: str(attribution.source, 120) || 'direct',
          medium: str(attribution.medium, 120),
          campaign: str(attribution.campaign, 200),
          content: str(attribution.content, 200),
          term: str(attribution.term, 200),
          fbclid: str(attribution.fbclid, 300),
          ttclid: str(attribution.ttclid, 300),
          gclid: str(attribution.gclid, 300),
          referrer: str(referrer ?? attribution.referrer, 300),
          landingPath: str(landingPath ?? attribution.landingPath, 300),
          ip: getIP(req),
          userAgent: ua,
        },
      },
      { upsert: true }
    );
    res.json({ success: true, data: { ok: true } });
  } catch (err) {
    // Never let visit tracking surface an error to the client — it's best-effort.
    logger.warn(`recordVisit failed: ${err.message}`);
    res.json({ success: true, data: { ok: false } });
  }
};
