const SupportMessage = require('../models/SupportMessage');
const User = require('../models/User');
const NumberOrder = require('../models/NumberOrder');
const Payment = require('../models/Payment');
const settings = require('./support-settings');
const usage = require('./support-usage');
const pricing = require('./support-pricing');
const actions = require('./support-actions.service');
const logger = require('../config/logger');

// Two interchangeable model backends (chosen by pricing.PROVIDER):
//   - 'anthropic' : Claude Haiku 4.5 via @anthropic-ai/sdk
//   - 'bedrock'   : gpt-oss-120b via AWS Bedrock's OpenAI-compatible endpoint
// The user's own account snapshot is injected into the prompt (scoped reads),
// and the model can EXECUTE scoped write actions via tool use (e.g. resolve a
// stuck card payment). Both providers run the same tool loop.
const MAX_TOKENS = 300;
const MAX_TOOL_LOOPS = 4;
const HISTORY_LIMIT = 10;
const ESCALATE_TOKEN = '[[ESCALATE]]';

const PROVIDER_PATTERNS = /\b(5\s?sim|fivesim|grizzly\s?sms|grizzly|getsms\s?otp|getsms|sms[-\s]?activate|smsactivate|smspool)\b/gi;
function scrubProviders(text) {
  return String(text || '').replace(PROVIDER_PATTERNS, 'our network');
}
function stripReasoning(text) {
  return String(text || '').replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim();
}

// Safety net so replies always read like a human text, never like formatted AI
// output: strip markdown bold/italic/headings/bullets and normalize the dashes
// the user specifically doesn't want. The persona prompt does the heavy lifting;
// this just guarantees the surface.
function humanize(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')        // **bold**
    .replace(/`([^`]+)`/g, '$1')            // `code`
    .replace(/^#{1,6}\s+/gm, '')            // # headings
    .replace(/^\s*[-*]\s+/gm, '')           // leading bullet markers
    .replace(/–/g, '-')                      // en-dash -> hyphen (keeps ranges like 50-500)
    .replace(/\s*—\s*/g, ', ')              // em-dash -> comma
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

let _anthropic = null;
function anthropicClient() {
  if (!_anthropic) {
    const Anthropic = require('@anthropic-ai/sdk');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}
let _openai = null;
function bedrockClient() {
  if (!_openai) {
    const OpenAI = require('openai');
    const region = process.env.AWS_BEDROCK_REGION || 'us-east-2';
    _openai = new OpenAI({
      apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
      baseURL: `https://bedrock-runtime.${region}.amazonaws.com/openai/v1`,
    });
  }
  return _openai;
}

function hasKey() {
  return pricing.PROVIDER === 'anthropic'
    ? !!process.env.ANTHROPIC_API_KEY
    : !!process.env.AWS_BEARER_TOKEN_BEDROCK;
}

// ── Tool loop (provider-specific request/response, shared action executor) ─────
// Returns { text, totals: { input, output } }.
async function runWithTools(system, history, userId) {
  const totals = { input: 0, output: 0 };

  if (pricing.PROVIDER === 'anthropic') {
    const messages = history.slice();
    for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
      const resp = await anthropicClient().messages.create({
        model: pricing.MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: actions.TOOLS,
        messages,
      });
      totals.input += resp.usage?.input_tokens || 0;
      totals.output += resp.usage?.output_tokens || 0;

      if (resp.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: resp.content });
        const results = [];
        for (const b of resp.content) {
          if (b.type !== 'tool_use') continue;
          const out = await actions.executeAction(b.name, b.input, userId);
          results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) });
        }
        messages.push({ role: 'user', content: results });
        continue;
      }
      const text = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      return { text, totals };
    }
    return { text: '', totals };
  }

  // bedrock / gpt-oss (OpenAI-compatible)
  const openaiTools = actions.TOOLS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
  const messages = [{ role: 'system', content: system }, ...history];
  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const resp = await bedrockClient().chat.completions.create({
      model: pricing.MODEL,
      max_completion_tokens: MAX_TOKENS,
      temperature: 0.3,
      tools: openaiTools,
      messages,
    });
    totals.input += resp.usage?.prompt_tokens || 0;
    totals.output += resp.usage?.completion_tokens || 0;
    const msg = resp.choices?.[0]?.message;
    if (msg?.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}
        const out = await actions.executeAction(tc.function.name, args, userId);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out) });
      }
      continue;
    }
    return { text: msg?.content || '', totals };
  }
  return { text: '', totals };
}

// Project an order to fields safe to expose — NEVER provider / providerOrderId.
function safeOrder(o) {
  const code = o.smsCode || (o.smsMessages && o.smsMessages.length ? o.smsMessages[o.smsMessages.length - 1].code : null);
  return {
    service: o.serviceId?.name || o.rentalServiceSlug || 'number',
    country: o.countryId?.name || o.countryCode || '',
    phone: o.phoneNumber,
    status: o.status,
    type: o.orderType,
    codeReceived: !!code,
    code: code || null,
    createdAt: o.createdAt,
    expiresAt: o.expiresAt,
  };
}

async function accountSnapshot(userId) {
  const [u, orders, payments] = await Promise.all([
    User.findById(userId, 'email creditBalance createdAt name'),
    NumberOrder.find({ userId }).sort({ createdAt: -1 }).limit(5).populate('serviceId', 'name').populate('countryId', 'name'),
    Payment.find({ userId }).sort({ createdAt: -1 }).limit(5),
  ]);
  return {
    account: u ? { name: u.name, email: u.email, creditBalance: u.creditBalance, joinedAt: u.createdAt } : null,
    recentOrders: orders.map(safeOrder),
    recentPayments: payments.map((p) => ({
      id: p._id, // the model passes this to resolve_pending_payment
      amountUSD: p.amountUSD,
      method: p.method === 'KORAPAY' ? 'Card/Bank' : 'Crypto',
      status: p.status,
      creditsAdded: p.creditsAdded,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
    })),
  };
}

function systemPrompt(kb, snapshot) {
  return [
    "You are Ada, the friend everyone wishes they had, who happens to work support at Textlix (a service where people buy credits and rent temporary virtual phone numbers to receive SMS verification codes). People should leave a chat with you feeling lighter, like they just texted their funniest, most dependable friend who also quietly fixed their problem. The goal is for users to genuinely love talking to you.",
    '',
    'HOW YOU TALK (most important thing on this whole page):',
    '- Write exactly like a real person texting a close friend. SHORT and punchy. One or two sentences, max. If you catch yourself starting a third sentence, stop. No little paragraphs, no wind-up, get to it.',
    '- Be genuinely funny, playful and a little cheeky when the moment fits. Celebrate their wins, tease gently, use everyday slang and the little asides a real friend throws in.',
    '- Be massively on their side and accommodating. Make them feel heard and looked after, never like a ticket number.',
    '- PLAIN TEXT ONLY. No markdown, no asterisks or bold, no bullet points, no numbered lists, no headings, and never use the long dash character. Just normal sentences like a text message. One natural emoji here and there is great, do not spam them.',
    '- Use their first name now and then if you know it. Mirror their energy and vibe.',
    '- Read the room. If they are stressed about money or a missing code, lead with warmth and fixing it fast and keep jokes light. If they are relaxed, let your fun side out.',
    '',
    'NEVER sound like a bot or a help-desk script. Banned phrases and anything in that family: "I apologize for the inconvenience", "How may I assist you", "Is there anything else I can help you with", "Thank you for reaching out", "I completely understand your frustration", "rest assured", "certainly", "great question", "I am here to help", "feel free to", "as an AI", "kindly". If a sentence sounds like a canned macro, rewrite it the way a human would actually say it out loud. If someone straight up asks whether you are a bot, be honest but keep it warm and funny.',
    '',
    'A couple of examples of your vibe (do not copy them, just match the energy):',
    'User: "ugh my code still isnt here" -> You: "Ugh, that is the worst, let me help. Sometimes it just needs a couple minutes to land, but if it totally ghosts you it auto-refunds and we try a different country. Give it a sec?"',
    'User: "do you have anything to pick the best country?" -> You: "Oh you are gonna love this. Tap AI Recommend up top, tell it your service, and it shows the countries with the best success rate right now. Basically cheating, the good kind 😄"',
    '',
    'Never tell someone a feature does not exist unless you are sure. If you are not certain we offer something, do not deny it. Say you are not 100 percent sure off the top of your head and offer to check or point them the right way. Wrongly telling a user something is not available is way worse than saying you will double check.',
    '',
    'What you know:',
    '- 1 credit = $0.01. Numbers cost ~50–500 credits depending on service/country.',
    '- An OTP number waits ~20 min for an SMS; if none comes it auto-expires and credits are auto-refunded.',
    '- Up to 5 active numbers at once. Minimum top-up is $2.',
    '- Payments: card/bank (KoraPay) and crypto (USDT/BTC/ETH). Credits land automatically once a payment is confirmed.',
    '',
    'Features we DO have (so you never wrongly say we lack one):',
    '- ✨ AI Recommend — pick a service and we surface the countries with the highest CURRENT success rate for receiving that code. It\'s the "AI Recommend" button in the top nav.',
    '- Get Number — browse and buy numbers by service or by country. Active Numbers shows your live numbers and the codes as they arrive in real time.',
    '- Order History, Buy Credits, and account Settings.',
    '- Long-term number rentals (e.g. 1 / 7 / 30 days) for keeping a number, alongside the quick one-off OTP numbers.',
    '- A developer API with API keys (Settings → API Keys) for using Textlix programmatically.',
    '- A Creator / referral program (at creator.textlix.com) — earn a share of the credit top-ups from people you refer.',
    '',
    "This is the CURRENT USER's own account (JSON). Use it to answer their questions specifically. Only ever discuss THIS user's data; never invent anything.",
    '```json',
    JSON.stringify(snapshot),
    '```',
    '',
    'Taking action — you can actually FIX things, not just explain:',
    "- CRITICAL: whenever a payment is involved and it isn't already COMPLETED in the data above, you MUST call resolve_pending_payment (with that payment's id) BEFORE you say anything about its status. Never tell someone it's 'still processing' or 'give it a few minutes' from memory — you don't actually know until the tool checks. Check first, then reply based on the result.",
    "- If the tool confirms it and adds credits, tell them warmly what you did (e.g. \"All sorted — just added your 500 credits, you're good to go 🎉\"). Don't ask permission first; just fix it and report back.",
    "- If the tool says it's still processing at the provider, then reassure them it usually clears in a few minutes.",
    "- For crypto payments, refunds, cancellations, or anything you can't resolve with your tool, hand off to a human: reply with EXACTLY \"" + ESCALATE_TOKEN + "\" and nothing else.",
    '',
    'STRICT CONFIDENTIALITY: numbers come from our own internal network. NEVER name, hint at, or speculate about any third-party SMS provider or API. If asked where a number comes from, it comes from our own number network.',
    kb ? `\nTeam notes (authoritative — prefer these):\n${kb}` : '',
  ].join('\n');
}

async function buildHistory(conversationId) {
  const rows = await SupportMessage.find({ conversationId }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT);
  rows.reverse();
  const msgs = [];
  for (const m of rows) {
    if (m.sender === 'SYSTEM') continue;
    msgs.push({ role: m.sender === 'USER' ? 'user' : 'assistant', content: m.text });
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

// Entry point called by support.service.handleUserMessage when AI is enabled.
// `helpers` = { appendMessage, escalate, emitToUser } from support.service.
async function respond(conversation, userText, helpers) {
  const { appendMessage, escalate, emitToUser } = helpers;

  if (!hasKey()) {
    await escalate(conversation, 'AI unavailable — no provider key');
    return;
  }
  if (!(await settings.getBool('support_ai_enabled', true))) {
    await escalate(conversation, 'AI disabled by admin');
    return;
  }
  const budget = await settings.getNumber('support_budget_monthly_usd', 0);
  if (budget > 0 && (await usage.monthCostUsd()) >= budget) {
    logger.warn('Support AI monthly budget reached — routing to human');
    await escalate(conversation, 'Monthly AI budget reached');
    return;
  }

  const [kb, snapshot, history] = await Promise.all([
    settings.getString('support_kb', ''),
    accountSnapshot(conversation.userId),
    buildHistory(conversation._id),
  ]);
  if (!history.length) history.push({ role: 'user', content: userText });

  const firstTime = (await SupportMessage.countDocuments({ conversationId: conversation._id, sender: { $in: ['AI', 'AGENT'] } })) === 0;

  let out;
  try {
    out = await runWithTools(systemPrompt(kb, snapshot), history, conversation.userId);
  } catch (err) {
    logger.error(`Support AI (${pricing.PROVIDER}) call failed: ${err.message}`);
    await escalate(conversation, 'AI error — routed to a human');
    return;
  }

  const costUsd = pricing.estimateCostUsd({ input_tokens: out.totals.input, output_tokens: out.totals.output });
  await usage.record({
    inputTokens: out.totals.input,
    outputTokens: out.totals.output,
    costUsd,
    conversationStarted: firstTime,
  });

  const text = stripReasoning(out.text);
  if (!text || text.includes(ESCALATE_TOKEN)) {
    await escalate(conversation, 'AI handed off to a human');
    return;
  }

  const clean = humanize(scrubProviders(text));
  await appendMessage(conversation, {
    sender: 'AI',
    text: clean,
    meta: { provider: pricing.PROVIDER, model: pricing.MODEL, inputTokens: out.totals.input, outputTokens: out.totals.output, costUsd },
  });
  emitToUser(conversation.userId, 'support:message', {
    conversationId: conversation._id,
    sender: 'AI',
    text: clean,
  });
}

module.exports = { respond };
