const SupportUsage = require('../models/SupportUsage');

// UTC 'YYYY-MM' bucket key for the current month.
function currentMonth(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// This month's spend so far (USD). Cheap single-doc read for the budget gate.
async function monthCostUsd() {
  const doc = await SupportUsage.findOne({ month: currentMonth() }, 'costUsd');
  return doc ? doc.costUsd : 0;
}

// Atomically fold one AI turn's tokens/cost (and counters) into the month rollup.
async function record({ inputTokens = 0, outputTokens = 0, cachedTokens = 0, costUsd = 0, conversationStarted = false, deflected = false }) {
  const inc = { inputTokens, outputTokens, cachedTokens, costUsd };
  if (conversationStarted) inc.conversations = 1;
  if (deflected) inc.deflected = 1;
  await SupportUsage.findOneAndUpdate(
    { month: currentMonth() },
    { $inc: inc, $setOnInsert: { month: currentMonth() } },
    { upsert: true }
  );
}

// Dashboard read: the current month rollup as a plain object.
async function summary() {
  const month = currentMonth();
  const doc = await SupportUsage.findOne({ month });
  return {
    month,
    conversations: doc?.conversations || 0,
    deflected: doc?.deflected || 0,
    inputTokens: doc?.inputTokens || 0,
    outputTokens: doc?.outputTokens || 0,
    cachedTokens: doc?.cachedTokens || 0,
    costUsd: doc?.costUsd || 0,
  };
}

module.exports = { currentMonth, monthCostUsd, record, summary };
