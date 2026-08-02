const User = require('../models/User');
const Payment = require('../models/Payment');
const Visit = require('../models/Visit');
const { success } = require('../utils/response');

// Same pre-launch floor used across admin so test data never leaks in.
const LAUNCH_DATE = new Date('2026-06-01T00:00:00.000Z');

// Resolve a {from,to} window from query, clamped to LAUNCH_DATE. Defaults to the
// last 30 days.
function resolveRange(q) {
  const requestedFrom = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const start = requestedFrom > LAUNCH_DATE ? requestedFrom : LAUNCH_DATE;
  const end = q.to ? new Date(q.to) : new Date();
  return { start, end };
}

// Funnel conversion rate, capped at 100%. Values would otherwise exceed 100%
// during the tracking cold-start, when historical signups (made before visit
// tracking existed) vastly outnumber tracked visits.
const pct = (num, den) => (den > 0 ? Math.min(100, Math.round((num / den) * 1000) / 10) : 0);

// Core funnel-by-source computation, shared by the JSON endpoint and the exports.
async function computeOverview(start, end) {
  const [visitAgg, signupAgg, payAgg] = await Promise.all([
    // Visits per source
    Visit.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $ifNull: ['$source', 'direct'] }, visits: { $sum: 1 } } },
    ]),
    // Signups per source (real users only). A MISSING source falls back to
    // 'direct' — "unknown" is reserved as the explicit pre-ads-team baseline
    // label (backfilled onto all users that existed before attribution tracking
    // mattered), so new untracked signups never pollute that baseline bucket.
    User.aggregate([
      { $match: { role: 'USER', createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $ifNull: ['$attribution.source', 'direct'] }, signups: { $sum: 1 } } },
    ]),
    // Paying users / sales / revenue per source — join completed payments to the
    // buyer's first-touch source.
    Payment.aggregate([
      { $match: { status: 'COMPLETED', completedAt: { $gte: start, $lte: end } } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      {
        $group: {
          _id: { $ifNull: ['$u.attribution.source', 'direct'] },
          revenueUSD: { $sum: '$amountUSD' },
          sales: { $sum: 1 },
          payers: { $addToSet: '$userId' },
        },
      },
    ]),
  ]);

  // Merge the three aggregations into one row per source.
  const rows = new Map();
  const row = (src) => {
    const key = src || 'direct';
    if (!rows.has(key)) rows.set(key, { source: key, visits: 0, signups: 0, payingUsers: 0, sales: 0, revenueUSD: 0 });
    return rows.get(key);
  };
  visitAgg.forEach((v) => { row(v._id).visits = v.visits; });
  signupAgg.forEach((s) => { row(s._id).signups = s.signups; });
  payAgg.forEach((p) => {
    const r = row(p._id);
    r.revenueUSD = Math.round((p.revenueUSD || 0) * 100) / 100;
    r.sales = p.sales;
    r.payingUsers = (p.payers || []).length;
  });

  const sources = [...rows.values()]
    .map((r) => ({
      ...r,
      visitToSignupPct: pct(r.signups, r.visits),
      signupToPayingPct: pct(r.payingUsers, r.signups),
    }))
    .sort((a, b) => b.revenueUSD - a.revenueUSD || b.visits - a.visits);

  const totals = sources.reduce(
    (t, r) => ({
      visits: t.visits + r.visits,
      signups: t.signups + r.signups,
      payingUsers: t.payingUsers + r.payingUsers,
      sales: t.sales + r.sales,
      revenueUSD: Math.round((t.revenueUSD + r.revenueUSD) * 100) / 100,
    }),
    { visits: 0, signups: 0, payingUsers: 0, sales: 0, revenueUSD: 0 }
  );
  totals.visitToSignupPct = pct(totals.signups, totals.visits);
  totals.signupToPayingPct = pct(totals.payingUsers, totals.signups);

  return { sources, totals };
}

// GET /admin/analytics/overview
exports.getOverview = async (req, res, next) => {
  try {
    const { start, end } = resolveRange(req.query);
    const data = await computeOverview(start, end);
    success(res, { ...data, range: { from: start, to: end } });
  } catch (err) {
    next(err);
  }
};

// GET /admin/analytics/timeseries — daily visits / signups / revenue for charts.
exports.getTimeseries = async (req, res, next) => {
  try {
    const { start, end } = resolveRange(req.query);
    const dayKey = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: 'UTC' } });

    const [visits, signups, revenue] = await Promise.all([
      Visit.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: dayKey('$createdAt'), v: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { role: 'USER', createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: dayKey('$createdAt'), v: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'COMPLETED', completedAt: { $gte: start, $lte: end } } },
        { $group: { _id: dayKey('$completedAt'), v: { $sum: '$amountUSD' } } },
      ]),
    ]);

    const map = new Map();
    const bucket = (d) => {
      if (!map.has(d)) map.set(d, { date: d, visits: 0, signups: 0, revenue: 0 });
      return map.get(d);
    };
    visits.forEach((x) => { bucket(x._id).visits = x.v; });
    signups.forEach((x) => { bucket(x._id).signups = x.v; });
    revenue.forEach((x) => { bucket(x._id).revenue = Math.round((x.v || 0) * 100) / 100; });

    const series = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    success(res, { series, range: { from: start, to: end } });
  } catch (err) {
    next(err);
  }
};

// GET /admin/analytics/export?format=xlsx|pdf
exports.exportReport = async (req, res, next) => {
  try {
    const { start, end } = resolveRange(req.query);
    const { sources, totals } = await computeOverview(start, end);
    const format = (req.query.format || 'xlsx').toLowerCase();
    const rangeLabel = `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`;
    const stamp = end.toISOString().slice(0, 10);

    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="textlix-conversions-${stamp}.pdf"`);
      doc.pipe(res);

      doc.fontSize(18).text('TextLix — Conversion Report', { align: 'left' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#666').text(`Range: ${rangeLabel}`);
      doc.moveDown(1);

      doc.fillColor('#000').fontSize(12).text('Summary', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#000');
      [
        ['Visits', totals.visits],
        ['Signups', totals.signups],
        ['Paying customers', totals.payingUsers],
        ['Sales', totals.sales],
        ['Revenue (USD)', `$${totals.revenueUSD.toFixed(2)}`],
        ['Visit → Signup', `${totals.visitToSignupPct}%`],
        ['Signup → Paying', `${totals.signupToPayingPct}%`],
      ].forEach(([k, v]) => doc.text(`${k}: ${v}`));
      doc.moveDown(1);

      doc.fontSize(12).text('By source', { underline: true });
      doc.moveDown(0.5);

      // Simple fixed-width table
      const cols = [
        { h: 'Source', w: 110 }, { h: 'Visits', w: 55 }, { h: 'Signups', w: 60 },
        { h: 'Paying', w: 55 }, { h: 'Sales', w: 50 }, { h: 'Revenue', w: 70 }, { h: 'V→S %', w: 50 },
      ];
      const startX = doc.x;
      let y = doc.y;
      const drawRow = (vals, bold) => {
        let x = startX;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        vals.forEach((val, i) => { doc.text(String(val), x + 2, y, { width: cols[i].w - 4 }); x += cols[i].w; });
        y += 16;
        if (y > doc.page.height - 50) { doc.addPage(); y = doc.y; }
      };
      drawRow(cols.map((c) => c.h), true);
      sources.forEach((r) =>
        drawRow([r.source, r.visits, r.signups, r.payingUsers, r.sales, `$${r.revenueUSD.toFixed(2)}`, `${r.visitToSignupPct}%`])
      );

      doc.end();
      return;
    }

    // Default: native Excel (.xlsx)
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'TextLix';
    const ws = wb.addWorksheet('By Source');
    ws.addRow([`TextLix Conversion Report — ${rangeLabel}`]);
    ws.addRow([]);
    ws.addRow(['Source', 'Visits', 'Signups', 'Paying Customers', 'Sales', 'Revenue (USD)', 'Visit→Signup %', 'Signup→Paying %']);
    ws.getRow(3).font = { bold: true };
    sources.forEach((r) =>
      ws.addRow([r.source, r.visits, r.signups, r.payingUsers, r.sales, r.revenueUSD, r.visitToSignupPct, r.signupToPayingPct])
    );
    ws.addRow([]);
    ws.addRow(['TOTAL', totals.visits, totals.signups, totals.payingUsers, totals.sales, totals.revenueUSD, totals.visitToSignupPct, totals.signupToPayingPct]);
    ws.lastRow.font = { bold: true };
    ws.columns.forEach((c) => { c.width = 18; });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="textlix-conversions-${stamp}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};
