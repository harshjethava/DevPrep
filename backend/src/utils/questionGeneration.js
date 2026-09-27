const { AppError } = require('./AppError');
const { generateText } = require('./aiService');

function normalizeTopics(topics) {
  if (!Array.isArray(topics)) return [];
  return topics
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeDifficulty(difficulty) {
  const d = String(difficulty || '').trim().toLowerCase();
  if (d === 'easy') return 'Easy';
  if (d === 'medium') return 'Medium';
  if (d === 'hard') return 'Hard';
  return 'Medium';
}

function safeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function buildPrompt({ role, difficulty, topics, count, excludeQuestions = [] }) {
  const safeRole = String(role || 'Software Engineer').trim() || 'Software Engineer';
  const safeDifficulty = normalizeDifficulty(difficulty);
  const safeTopics = normalizeTopics(topics);
  const safeCount = Math.max(1, Math.min(safeInt(count, 10) || 10, 20));

  const difficultyGuidance =
    safeDifficulty === 'Easy'
      ? 'Easy: entry-level, fundamental definitions and simple scenarios. No deep system design.'
      : safeDifficulty === 'Hard'
        ? 'Hard: senior-level depth, edge cases, trade-offs, performance, and advanced scenarios.'
        : 'Medium: practical day-to-day depth, some trade-offs, moderate complexity.';

  const topicLine = safeTopics.length ? safeTopics.join(', ') : 'General';
  const exclude = Array.isArray(excludeQuestions)
    ? excludeQuestions
        .map((q) => (typeof q === 'string' ? q.trim() : ''))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const excludeBlock = exclude.length
    ? `\nDo NOT repeat any of these questions (treat as duplicates even if phrased slightly differently):\n${exclude
        .map((q) => `- ${q}`)
        .join('\n')}\n`
    : '';

  return `You are an expert interview coach.

Generate ${safeCount} multiple-choice interview questions for the role: "${safeRole}".
Difficulty: ${safeDifficulty}.
${difficultyGuidance}
Focus topics: ${topicLine}.
${excludeBlock}

Return ONLY valid JSON (no markdown, no prose), in this exact shape:
[
  {
    "question": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "topic": "One of the focus topics or General",
    "explanation": "1-2 sentences explaining why the correct option is correct"
  }
]

Rules:
- question must be a single question (no answer).
- options must be exactly 4 distinct strings.
- correctIndex must be 0, 1, 2, or 3.
- Avoid trick questions; make one option clearly best.
- Keep explanation short.
- Output must start with '[' and end with ']'.
- Do NOT wrap the JSON in triple backticks.
- Use double quotes for all JSON strings.
`;
}

function extractJsonArray(text) {
  const s = String(text || '').trim();
  const noFences = s.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const start = noFences.indexOf('[');
  const end = noFences.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return noFences.slice(start, end + 1);
}

function extractJsonValue(text) {
  const s = String(text || '').trim();
  const noFences = s.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

  const firstArr = noFences.indexOf('[');
  const firstObj = noFences.indexOf('{');
  if (firstArr === -1 && firstObj === -1) return null;

  const start = firstArr !== -1 && (firstObj === -1 || firstArr < firstObj) ? firstArr : firstObj;
  const open = noFences[start];
  const close = open === '[' ? ']' : '}';

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = start; i < noFences.length; i += 1) {
    const ch = noFences[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return noFences.slice(start, i + 1);
      }
    }
  }

  return null;
}

function sanitizeJsonLikeString(input) {
  let s = String(input || '').trim();
  s = s.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  // smart quotes -> normal quotes
  s = s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  // remove non-printable control chars
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  // remove trailing commas
  s = s.replace(/,\s*]/g, ']');
  s = s.replace(/,\s*}/g, '}');

  // If the model returned JSON-like content (single quotes / unquoted keys), attempt a minimal repair.
  // Quote unquoted object keys: { foo: "bar" } -> { "foo": "bar" }
  s = s.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_\-]*)(\s*:)/g, '$1"$2"$3');

  // Convert simple single-quoted strings to double-quoted strings.
  // This is a heuristic: it won't handle every edge case but helps common model outputs.
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (m, inner) => {
    const safe = String(inner)
      .replace(/\\"/g, '"')
      .replace(/"/g, '\\"');
    return `"${safe}"`;
  });

  return s;
}

function buildRepairPrompt(badText) {
  const snippet = String(badText || '').slice(0, 12000);
  return `Fix the following into ONLY valid JSON (no markdown, no prose).\n\nReturn ONLY a JSON array with objects of the form:\n{\n  \"question\": string,\n  \"options\": [string,string,string,string],\n  \"correctIndex\": 0|1|2|3,\n  \"topic\": string,\n  \"explanation\": string\n}\n\nText to fix:\n${snippet}`;
}

function normalizeQuestionKey(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ?.,-]/g, '')
    .trim();
}

function dedupeQuestions(items) {
  const seen = new Set();
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    const key = normalizeQuestionKey(it && it.question);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function parseQuestionsFromModelOutput(raw) {
  // HF text-generation commonly returns: [{ generated_text: '...' }]
  let text = '';

  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first && typeof first.generated_text === 'string') {
      text = first.generated_text;
    } else {
      text = JSON.stringify(raw);
    }
  } else if (raw && typeof raw === 'object') {
    // Some models return { generated_text: '...' } or other shapes
    if (typeof raw.generated_text === 'string') {
      text = raw.generated_text;
    } else if (
      Array.isArray(raw.choices) &&
      raw.choices[0] &&
      raw.choices[0].message &&
      typeof raw.choices[0].message.content === 'string'
    ) {
      text = raw.choices[0].message.content;
    } else {
      text = JSON.stringify(raw);
    }
  } else {
    text = String(raw || '');
  }

  const jsonCandidate = extractJsonValue(text);
  if (!jsonCandidate) {
    const err = new AppError('AI response was not valid JSON', 502);
    err.details = [{ kind: 'parse', note: 'No JSON array/object found in model output' }];
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch (_) {
    try {
      parsed = JSON.parse(sanitizeJsonLikeString(jsonCandidate));
    } catch (e2) {
      const err = new AppError('AI response JSON could not be parsed', 502);
      err.details = [{ kind: 'parse', snippet: String(jsonCandidate).slice(0, 500) }];
      throw err;
    }
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.questions)) {
    parsed = parsed.questions;
  }

  if (!Array.isArray(parsed)) {
    throw new AppError('AI response JSON is not an array', 502);
  }

  const normalizeCorrectIndex = (q, options) => {
    const idx = q && q.correctIndex;
    if (Number.isInteger(idx) && idx >= 0 && idx <= 3) return idx;
    if (typeof idx === 'string') {
      const s = idx.trim();
      if (/^[0-3]$/.test(s)) return Number(s);
      const upper = s.toUpperCase();
      if (upper === 'A') return 0;
      if (upper === 'B') return 1;
      if (upper === 'C') return 2;
      if (upper === 'D') return 3;
    }
    const ans = q && (q.correctAnswer || q.answer);
    if (typeof ans === 'string') {
      const key = ans.trim().toLowerCase();
      const found = (options || []).findIndex((o) => String(o || '').trim().toLowerCase() === key);
      if (found >= 0 && found <= 3) return found;
    }
    return 0;
  };

  return parsed
    .map((q) => {
      const question = q && typeof q.question === 'string' ? q.question.trim() : '';
      const options =
        q && Array.isArray(q.options)
          ? q.options
              .map((o) => {
                if (typeof o === 'string') return o.trim();
                if (o && typeof o === 'object' && typeof o.text === 'string') return o.text.trim();
                return '';
              })
              .filter(Boolean)
          : [];
      const topic = q && typeof q.topic === 'string' ? q.topic.trim() : '';
      const explanation = q && typeof q.explanation === 'string' ? q.explanation.trim() : '';

      const normalizedOptions = options.slice(0, 4);
      const hasFour = normalizedOptions.length === 4;
      const correctIndex = normalizeCorrectIndex(q, normalizedOptions);

      return {
        question,
        options: normalizedOptions,
        correctIndex,
        topic: topic || 'General',
        explanation,
        _valid: Boolean(question) && hasFour
      };
    })
    .filter((q) => q._valid)
    .map(({ _valid, ...rest }) => rest);
}

function getRetryDelayMsFromError(err) {
  const msg = String(err && err.message ? err.message : '');
  const m = msg.match(/retry in\s*([0-9]+(?:\.[0-9]+)?)s/i);
  if (m) {
    const seconds = Number(m[1]);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000);
  }
  return 0;
}

function isRetryableAiError(err) {
  const msg = String(err && err.message ? err.message : '').toLowerCase();
  const status = err && typeof err.status === 'number' ? err.status : 0;

  if (status === 429 || status === 503) return true;
  if (msg.includes('currently loading')) return true;
  if (msg.includes('rate limit')) return true;
  if (msg.includes('timeout')) return true;
  if (msg.includes('temporarily unavailable')) return true;
  if (msg.includes('quota')) return true;
  return false;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function generateInterviewQuestions({ role, difficulty, topics, count, excludeQuestions = [] }) {
  const safeCount = Math.max(1, Math.min(safeInt(count, 10) || 10, 20));

  // PERFORMANCE FIX: Over-request by ~30% in a single call so we almost always
  // get enough valid questions without needing a second Groq round-trip.
  // e.g. user wants 10 -> we request 13; user wants 20 -> we request 20 (cap).
  const requestCount = Math.min(20, Math.ceil(safeCount * 1.3));

  const all = [];
  let lastErr;

  const callWithRetries = async (fn, { maxAttempts = 3 } = {}) => {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt += 1;
      try {
        return await fn();
      } catch (err) {
        if (!isRetryableAiError(err) || attempt >= maxAttempts) throw err;
        const hinted = getRetryDelayMsFromError(err);
        const backoff = 500 * attempt;
        await sleep(Math.max(hinted, backoff));
      }
    }
  };

  const attemptOnce = async ({ targetCount, timeoutMs }) => {
    const prompt = buildPrompt({
      role,
      difficulty,
      topics,
      count: targetCount,
      excludeQuestions: [...excludeQuestions, ...all.map((q) => q.question)],
    });

    const raw = await callWithRetries(
      () =>
        generateText({
          prompt,
          parameters: {
            temperature: 0.1,
            max_new_tokens: Math.min(2400, 320 + targetCount * 170),
            return_full_text: false,
          },
          timeoutMs,
        }),
      { maxAttempts: 3 }
    );

    let batch;
    try {
      batch = parseQuestionsFromModelOutput(raw);
    } catch (_) {
      // Repair pass: ask model to fix its own malformed output
      const rawText =
        (raw && raw.choices && raw.choices[0] && raw.choices[0].message && raw.choices[0].message.content) ||
        JSON.stringify(raw);
      const repairPrompt = buildRepairPrompt(rawText);
      const repaired = await callWithRetries(
        () =>
          generateText({
            prompt: repairPrompt,
            parameters: { temperature: 0, max_new_tokens: 2400, return_full_text: false },
            timeoutMs: 65000,
          }),
        { maxAttempts: 2 }
      );
      batch = parseQuestionsFromModelOutput(repaired);
    }

    const merged = dedupeQuestions([...all, ...batch]);
    all.splice(0, all.length, ...merged);
  };

  // Primary call: request requestCount (safeCount + buffer) questions at once.
  // This covers the target in a single Groq round-trip for the vast majority of cases.
  try {
    await attemptOnce({ targetCount: requestCount, timeoutMs: 65000 });
  } catch (err) {
    lastErr = err;
    if (isRetryableAiError(err)) {
      await sleep(Math.max(getRetryDelayMsFromError(err), 500));
    }
  }

  if (all.length >= safeCount) {
    return all.slice(0, safeCount);
  }

  // Single fallback call for the remaining questions (replaces the old 5-call loop).
  const remaining = safeCount - all.length;
  if (remaining > 0) {
    try {
      await attemptOnce({ targetCount: remaining, timeoutMs: 65000 });
    } catch (err) {
      lastErr = err;
    }
  }

  if (all.length >= safeCount) {
    return all.slice(0, safeCount);
  }

  // Return whatever we have if we got at least some questions
  if (all.length > 0) {
    return all;
  }

  const baseMsg = lastErr && lastErr.message ? lastErr.message : 'Failed to generate questions';
  throw new AppError(`${baseMsg} (generated ${all.length}/${safeCount})`, 502);
}

module.exports = {
  generateInterviewQuestions,
  normalizeTopics,
  normalizeDifficulty
};
