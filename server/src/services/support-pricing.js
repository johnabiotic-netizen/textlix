// Provider-aware pricing for the support AI. We support two backends:
//   - anthropic : Claude Haiku 4.5 (direct Anthropic API) — $1 / $5 per 1M
//   - bedrock   : gpt-oss-120b via AWS Bedrock OpenAI endpoint — $0.15 / $0.60 per 1M
// The active provider is Anthropic when ANTHROPIC_API_KEY is set, otherwise
// Bedrock (gated on AWS_BEARER_TOKEN_BEDROCK). Override with SUPPORT_AI_PROVIDER.
const PROVIDER =
  process.env.SUPPORT_AI_PROVIDER ||
  (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'bedrock');

const RATES = {
  anthropic: { input: 1.0 / 1_000_000, output: 5.0 / 1_000_000 },
  bedrock: { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
};

const MODELS = {
  anthropic: 'claude-haiku-4-5',
  bedrock: process.env.SUPPORT_BEDROCK_MODEL || 'openai.gpt-oss-120b-1:0',
};

// Accepts an Anthropic ({input_tokens,output_tokens}) or OpenAI
// ({prompt_tokens,completion_tokens}) usage object.
function estimateCostUsd(usage) {
  if (!usage) return 0;
  const input = usage.input_tokens || usage.prompt_tokens || 0;
  const output = usage.output_tokens || usage.completion_tokens || 0;
  const rate = RATES[PROVIDER] || RATES.bedrock;
  return input * rate.input + output * rate.output;
}

module.exports = { PROVIDER, MODEL: MODELS[PROVIDER], estimateCostUsd };
