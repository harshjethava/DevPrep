/**
 * aiService.js — Centralized Groq AI provider.
 *
 * PHASE 2 IMPROVEMENT: All AI calls across the codebase now use this single
 * implementation instead of three duplicate groqChat() functions that lived in
 * mockInterviewController.js, resumeController.js, and here.
 *
 * Exports:
 *   groqChat(messages, options)  — multi-turn chat (primary API)
 *   generateText(opts)           — legacy single-prompt wrapper (kept for
 *                                  questionGeneration.js compatibility)
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY;
  return key ? String(key).trim() : '';
}

function getGroqModel() {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  return String(model).trim();
}

/**
 * Send a multi-turn chat request to Groq.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} [opts]
 * @param {number} [opts.temperature=0.7]
 * @param {number} [opts.maxTokens=2048]
 * @param {number} [opts.timeoutMs=60000]
 * @param {boolean} [opts.returnFullResponse=false]  if true, returns the raw
 *   Groq JSON response object; if false (default), returns the message content string.
 * @returns {Promise<string | object>}
 */
async function groqChat(messages, {
  temperature = 0.7,
  maxTokens = 2048,
  timeoutMs = 60000,
  returnFullResponse = false,
} = {}) {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getGroqModel(),
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }

    if (!res.ok) {
      const msg =
        (json && json.error && (json.error.message || json.error.type)) ||
        (json && json.message) ||
        text ||
        `Groq request failed (${res.status})`;
      const e = new Error(msg);
      e.status = res.status;
      e.body = json || text;
      throw e;
    }

    if (returnFullResponse) return json;

    return json?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Legacy single-prompt wrapper used by questionGeneration.js.
 * Translates the old generateText() API into groqChat() calls.
 *
 * @param {Object} opts
 * @param {string} opts.prompt
 * @param {Object} [opts.parameters]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<object>} — returns the raw Groq JSON (choices[0].message.content)
 *   in the OpenAI response shape so that parseQuestionsFromModelOutput() can extract it.
 */
async function generateText({ prompt, parameters, timeoutMs } = {}) {
  const temperature =
    parameters && typeof parameters.temperature === 'number'
      ? parameters.temperature
      : undefined;
  const maxTokens =
    parameters && typeof parameters.max_new_tokens === 'number'
      ? parameters.max_new_tokens
      : undefined;

  // Return the full response object so that questionGeneration.js can parse
  // choices[0].message.content from it (matches the existing parseQuestionsFromModelOutput logic).
  return groqChat(
    [{ role: 'user', content: String(prompt || '') }],
    {
      ...(typeof temperature === 'number' ? { temperature } : {}),
      ...(typeof maxTokens  === 'number'  ? { maxTokens  } : {}),
      ...(typeof timeoutMs  === 'number'  ? { timeoutMs  } : {}),
      returnFullResponse: true,
    }
  );
}

module.exports = { groqChat, generateText };
