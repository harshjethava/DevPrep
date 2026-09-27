const { clerkClient } = require('@clerk/clerk-sdk-node');

const MockInterviewSession = require('../models/MockInterviewSession');
const Resume = require('../models/Resume');
const User = require('../models/User');
const { upsertUserFromClerkApi, getClerkUserIdFromAuth } = require('./clerkSyncController');
const { groqChat } = require('../utils/aiService');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Maximum number of messages (user + interviewer combined) sent to Groq on
// each turn. This bounds token usage and keeps latency constant regardless of
// how long the session runs. Older messages beyond this window are trimmed.
// The system prompt is always included; only chat history is windowed.
const CHAT_HISTORY_WINDOW = 20;

// After this many messages the session is considered "full" and no more
// candidate messages are accepted. This prevents MongoDB documents from
// growing beyond the 16 MB document limit.
const MAX_SESSION_MESSAGES = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveUser(req) {
  const clerkUserId = getClerkUserIdFromAuth(req);
  if (!clerkUserId) return null;

  let user = await User.findOne({ clerkUserId });
  if (!user) {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    user = await upsertUserFromClerkApi(clerkUser);
  }
  return user;
}

// ---------------------------------------------------------------------------
// AI Prompts
// ---------------------------------------------------------------------------

function buildSystemPrompt(session) {
  const typeLabel =
    session.interviewType === 'technical' ? 'Technical'
    : session.interviewType === 'hr' ? 'HR / Behavioral'
    : session.interviewType === 'resume-based' ? 'Resume-Based'
    : 'Mixed (Technical + HR)';

  const topicsStr = session.selectedTopics.length
    ? session.selectedTopics.join(', ')
    : 'general topics relevant to the role';

  const base = `You are a professional mock interviewer conducting a real ${typeLabel} interview simulation.

Candidate details:
- Target role: ${session.role || 'Software Developer'}
- Difficulty level: ${session.difficulty || 'medium'}
- Interview topics: ${topicsStr}
- Interview duration: ${session.duration} minutes

CRITICAL RULE:
You must NEVER provide the correct answer, hints, or complete explanation to the candidate during the interview — even if the candidate gives a wrong or incomplete answer. Your role is to evaluate, guide, and continue the interview — NOT to teach.

QUESTION FLOW:
1. Ask ONE question at a time. Wait for the candidate's response before continuing.
2. Start with a brief, friendly introduction and your first question.
3. Keep questions relevant to the selected interview type, role, difficulty level, and topics.
4. For technical interviews, ask coding concepts, system design, or problem-solving questions appropriate to the difficulty level.
5. For HR interviews, ask behavioral, situational, and culture-fit questions.
6. For mixed interviews, alternate between technical and behavioral questions.
7. Vary question difficulty based on how well the candidate is doing.

ANSWER EVALUATION — After the candidate responds, classify the answer and respond accordingly:

If answer is CORRECT:
- Acknowledge briefly (e.g., "Good answer", "That's correct").
- DO NOT expand or explain further. Move to the next question.

If answer is PARTIALLY CORRECT:
- Say it's partially correct.
- Ask a follow-up question to probe deeper.
- DO NOT reveal the missing part of the answer.

If answer is INCORRECT:
- Clearly but politely say the answer is incorrect.
- DO NOT provide the correct answer.
- Ask: "Would you like to try again or should we move to another question?"
- If candidate says "try again", repeat or slightly rephrase the question.
- If candidate says "next", move to a new question.

If answer is EMPTY or candidate doesn't know:
- Respond: "No problem. Would you like to try another question?"
- Then proceed based on candidate's choice.

STRICT PROHIBITIONS:
- DO NOT explain the correct answer during the interview.
- DO NOT give examples that reveal the answer.
- DO NOT teach concepts mid-interview.
- DO NOT say "the correct answer is..."
- DO NOT give hints that directly lead to the answer.
- DO NOT use markdown formatting, bullet points, or numbered lists.

TONE:
- Professional and encouraging.
- Neutral evaluation (not overly praising or harsh).
- Keep responses concise — speak naturally as a real interviewer would in a conversation.
- Keep the interview interactive. Never break the flow by giving long explanations.
- Always maintain interviewer role under all circumstances.`;

  if (session.resumeContext) {
    return (
      base +
      `\n\nCandidate's Resume Summary:\n${session.resumeContext}\n\nADDITIONAL RESUME-BASED RULES:\n- Ask questions specifically about the candidate's listed projects, experience, and skills.\n- Probe deeper into technologies they claim to know.\n- Ask about challenges faced in their listed projects.\n- Verify their claimed experience with follow-up technical questions.\n- Reference specific items from their resume when asking questions.\n- Mix resume-specific questions with general questions relevant to their target role.`
    );
  }

  return base;
}

function buildEvaluationPrompt(session) {
  const transcript = session.messages
    .map((m) => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
    .join('\n\n');

  return `You are an expert interview evaluator. Analyze the following mock interview transcript and provide a thorough evaluation.

IMPORTANT: Now that the interview has ended, you MUST provide the correct answers/explanations for every question asked. This is the ONLY time correct answers should be revealed.

Interview details:
- Type: ${session.interviewType}
- Role: ${session.role}
- Difficulty: ${session.difficulty}
- Topics: ${session.selectedTopics.join(', ') || 'general'}

Transcript:
${transcript}

Respond ONLY with valid JSON (no markdown, no code fences, no extra text). Use this exact structure:
{
  "overallScore": <number 0-100>,
  "strengths": ["<strength1>", "<strength2>", ...],
  "weaknesses": ["<weakness1>", "<weakness2>", ...],
  "topicFeedback": [{"topic": "<topic>", "score": <0-100>, "comments": "<feedback including what the correct answer was for questions the candidate got wrong>"}],
  "communicationFeedback": "<feedback on communication skills>",
  "technicalDepthFeedback": "<feedback on technical depth, or empty string if HR interview>",
  "improvementTips": ["<tip1>", "<tip2>", ...],
  "recommendedNextSteps": ["<step1>", "<step2>", ...],
  "summary": "<2-3 sentence summary of overall performance>"
}`;
}

/**
 * Build the windowed message history to send to Groq.
 *
 * Always includes the system prompt. Only sends the most recent
 * CHAT_HISTORY_WINDOW messages from the full session history to keep token
 * usage bounded regardless of session length.
 */
function buildGroqMessages(session) {
  const systemPrompt = buildSystemPrompt(session);
  const allMessages = session.messages;

  // Apply sliding window — take the most recent N messages
  const windowedMessages = allMessages.length > CHAT_HISTORY_WINDOW
    ? allMessages.slice(-CHAT_HISTORY_WINDOW)
    : allMessages;

  return [
    { role: 'system', content: systemPrompt },
    ...windowedMessages.map((msg) => ({
      role: msg.role === 'interviewer' ? 'assistant' : 'user',
      content: msg.content,
    })),
  ];
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

async function startSession(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const {
      interviewType = 'technical',
      role = 'Software Developer',
      difficulty = 'medium',
      duration = 30,
      selectedTopics = [],
      resumeId = null,
    } = req.body;

    // Build resume context if resumeId is provided
    let resumeContext = '';
    let resolvedResumeId = null;

    if (resumeId) {
      try {
        const resume = await Resume.findById(resumeId);
        if (resume && String(resume.userId) === String(user._id) && resume.extractionStatus === 'success') {
          resolvedResumeId = resume._id;
          const ed = resume.extractedData;
          const parts = [];
          if (ed.skills && ed.skills.length) parts.push(`Skills: ${ed.skills.join(', ')}`);
          if (ed.experience && ed.experience.length) {
            parts.push('Experience:\n' + ed.experience.map((e) => `- ${e.title}${e.description ? ': ' + e.description : ''}`).join('\n'));
          }
          if (ed.projects && ed.projects.length) {
            parts.push('Projects:\n' + ed.projects.map((p) => `- ${p.title}${p.description ? ': ' + p.description : ''}`).join('\n'));
          }
          if (ed.education && ed.education.length) {
            parts.push('Education:\n' + ed.education.map((e) => `- ${e.title}${e.description ? ': ' + e.description : ''}`).join('\n'));
          }
          if (ed.awards && ed.awards.length) {
            parts.push('Awards & Achievements:\n' + ed.awards.map((a) => `- ${a.title}${a.description ? ': ' + a.description : ''}`).join('\n'));
          }
          if (ed.certifications && ed.certifications.length) {
            parts.push('Certifications:\n' + ed.certifications.map((c) => `- ${c.title}${c.description ? ': ' + c.description : ''}`).join('\n'));
          }
          if (ed.competitiveProgramming && ed.competitiveProgramming.length) {
            parts.push('Competitive Programming:\n' + ed.competitiveProgramming.map((cp) => `- ${cp.title}${cp.description ? ': ' + cp.description : ''}`).join('\n'));
          }
          resumeContext = parts.join('\n\n');
        }
      } catch (_) {
        // Ignore resume lookup failures — proceed without context
      }
    }

    const session = await MockInterviewSession.create({
      userId: user._id,
      interviewType,
      role,
      difficulty,
      duration,
      selectedTopics,
      resumeId: resolvedResumeId,
      resumeContext,
      status: 'active',
      startedAt: new Date(),
      currentQuestionNumber: 1,
      messages: [],
    });

    // Generate first interviewer message
    let aiContent;
    try {
      aiContent = await groqChat([
        { role: 'system', content: buildSystemPrompt(session) },
        { role: 'user', content: 'Please begin the interview. Introduce yourself briefly and ask your first question.' },
      ]);
    } catch (_) {
      aiContent = `Hello! I'm your interviewer today. Let's get started. Could you tell me about your experience with ${session.selectedTopics[0] || session.role}?`;
    }

    session.messages.push({ role: 'interviewer', content: aiContent, timestamp: new Date() });
    await session.save();

    return res.status(201).json({ session });
  } catch (err) {
    return next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return res.status(200).json({ session });
  } catch (err) {
    return next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Interview session is not active' });
    }

    // Enforce max message count to prevent document from growing beyond MongoDB 16 MB limit
    if (session.messages.length >= MAX_SESSION_MESSAGES) {
      return res.status(400).json({
        message: 'This session has reached its maximum length. Please end the interview to receive your evaluation.',
        sessionFull: true,
      });
    }

    const { content } = req.body;

    // Save user message
    session.messages.push({
      role: 'user',
      content: String(content).trim(),
      timestamp: new Date(),
    });

    // Build windowed message history for Groq (sliding window applied here)
    const chatMessages = buildGroqMessages(session);

    // Generate AI follow-up
    let aiContent;
    try {
      aiContent = await groqChat(chatMessages);
    } catch (_) {
      aiContent = "That's interesting. Could you elaborate on that a bit more?";
    }

    session.messages.push({ role: 'interviewer', content: aiContent, timestamp: new Date() });

    // Count interviewer messages as question number
    session.currentQuestionNumber = session.messages.filter((m) => m.role === 'interviewer').length;

    await session.save();
    return res.status(200).json({ session });
  } catch (err) {
    return next(err);
  }
}

async function endSession(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Interview session is not active' });
    }

    const { status = 'completed' } = req.body;
    session.status = status;
    session.endedAt = new Date();

    // Generate evaluation if completed (not abandoned) and there are messages
    if (status === 'completed' && session.messages.length >= 2) {
      try {
        const evalPrompt = buildEvaluationPrompt(session);
        const evalRaw = await groqChat(
          [
            { role: 'system', content: 'You are an interview evaluation expert. Respond only with valid JSON.' },
            { role: 'user', content: evalPrompt },
          ],
          { temperature: 0.3, maxTokens: 4096 }
        );

        // Parse JSON — strip code fences if the model adds them
        let cleaned = evalRaw.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        }

        const evalData = JSON.parse(cleaned);

        session.evaluation = {
          overallScore: Math.min(100, Math.max(0, Number(evalData.overallScore) || 0)),
          strengths: Array.isArray(evalData.strengths) ? evalData.strengths : [],
          weaknesses: Array.isArray(evalData.weaknesses) ? evalData.weaknesses : [],
          topicFeedback: Array.isArray(evalData.topicFeedback) ? evalData.topicFeedback : [],
          communicationFeedback: String(evalData.communicationFeedback || ''),
          technicalDepthFeedback: String(evalData.technicalDepthFeedback || ''),
          improvementTips: Array.isArray(evalData.improvementTips) ? evalData.improvementTips : [],
          recommendedNextSteps: Array.isArray(evalData.recommendedNextSteps) ? evalData.recommendedNextSteps : [],
          summary: String(evalData.summary || ''),
        };
      } catch (_) {
        // Fallback evaluation if AI fails
        session.evaluation = {
          overallScore: 50,
          strengths: ['Completed the interview'],
          weaknesses: ['Evaluation could not be generated automatically'],
          topicFeedback: [],
          communicationFeedback: 'Unable to evaluate — please review the transcript.',
          technicalDepthFeedback: '',
          improvementTips: ['Practice more mock interviews to improve'],
          recommendedNextSteps: ['Try another mock interview session'],
          summary: 'The interview was completed. Automated evaluation encountered an issue.',
        };
      }
    }

    await session.save();
    return res.status(200).json({ session });
  } catch (err) {
    return next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const sessions = await MockInterviewSession.find({ userId: user._id })
      .select(
        'interviewType role difficulty duration status startedAt endedAt currentQuestionNumber evaluation.overallScore evaluation.summary createdAt'
      )
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({ sessions });
  } catch (err) {
    return next(err);
  }
}

module.exports = { startSession, getSession, sendMessage, endSession, getHistory };
