import { NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export const maxDuration = 60;

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

const MODEL_ID = process.env.MODEL_NAME || 'amazon.nova-lite-v1:0';

// ── Input guardrails ──────────────────────────────────────────────────
const MAX_TEXT_LENGTH = 5000;

function sanitize(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.slice(0, MAX_TEXT_LENGTH).trim();
}

export async function POST(req: Request) {
  console.log(`\n================= [LIVE EVALUATOR API: START] =================`);
  try {
    const body = await req.json();
    const { question, candidateAnswer, keyPoints, followUpsHistory, allQuestions, maxFollowUps, currentFollowUpCount } = body;
    console.log(`[LiveEvaluate] Received live evaluation request.`);
    console.log(`[LiveEvaluate] Question: ${question}`);
    console.log(`[LiveEvaluate] Expected Key Points: ${keyPoints?.length || 0}`);
    console.log(`[LiveEvaluate] Candidate Answer: ${candidateAnswer}`);
    console.log(`[LiveEvaluate] Follow-Ups Asked: ${currentFollowUpCount || 0} / ${maxFollowUps || 2}`);
    if (followUpsHistory?.length > 0) {
      console.log(`[LiveEvaluate] Context includes ${followUpsHistory.length} previous follow-ups.`);
    }
    console.log(`[LiveEvaluate] Total Main Questions context: ${allQuestions?.length || 0}`);

    if (!question || !candidateAnswer || !Array.isArray(keyPoints) || keyPoints.length === 0) {
      console.log(`[LiveEvaluate] Error: Missing required fields`);
      return NextResponse.json({ error: 'Missing required fields: question, candidateAnswer, keyPoints' }, { status: 400 });
    }

    if (!process.env.ACCESS_KEY_ID) {
      console.log(`[LiveEvaluate] Error: AWS credentials missing`);
      return NextResponse.json({
        decision: 'move_next',
        covered_points: [],
        missed_points: keyPoints,
        coverage_percentage: 0,
      });
    }

    const sanitizedQuestion = sanitize(question);
    const sanitizedAnswer = sanitize(candidateAnswer);
    const followUpsText = Array.isArray(followUpsHistory) && followUpsHistory.length > 0
      ? `\n## Previous Follow-Ups and Answers:\n${followUpsHistory.map((fu: any, i: number) => `Follow-Up Q${i + 1}: ${sanitize(fu.q)}\nCandidate A${i + 1}: ${sanitize(fu.a)}`).join('\n\n')}`
      : '';
    const allQuestionsText = Array.isArray(allQuestions) && allQuestions.length > 0
      ? `\n## Main Interview Questions (DO NOT USE THESE AS FOLLOW-UPS):\n${allQuestions.map((q: string, i: number) => `${i + 1}. ${sanitize(q)}`).join('\n')}`
      : '';

    const prompt = `
You are an expert interview evaluator sitting silently in the corner during an interview.
Your ONLY job is to check whether the candidate's answer covers the required key points.

## The Question Asked:
${sanitizedQuestion}

## Required Key Points (that the candidate MUST cover):
${keyPoints.map((kp: string, i: number) => `${i + 1}. ${kp}`).join('\n')}

## Candidate's Primary Answer:
${sanitizedAnswer}
${followUpsText}${allQuestionsText}

## Follow-up Constraints:
- Max allowed follow-ups: ${maxFollowUps ?? 2}
- Follow-ups already asked: ${currentFollowUpCount ?? 0}
- If <Follow-ups already asked> >= <Max allowed follow-ups>, you MUST choose "move_next".
- If the candidate has covered ALL required key points, you MUST choose "move_next" immediately. Do NOT ask a follow-up if their coverage is 100%.

## Your Task:
Analyze the candidate's answer(s) and determine which key points were covered and which were missed.

Then decide:
- "move_next" — MANDATORY if the candidate demonstrates a clear understanding of the core concepts, or if they have covered all key points, or if the maximum allowed follow-ups have been reached. If they correctly use the terminology or list the required methods, treat it as covered. DO NOT be overly pedantic or demand essay-length answers. If they prove they know the answer, choose "move_next".
- "follow_up" — Choose this if a critical concept is missing, OR if the candidate's answer is completely off-topic AND you have NOT reached the maximum allowed follow-ups. Generate a natural follow-up question. If they were off-topic, politely nudge them back to the original topic in your follow-up. CRITICAL RULES: 1. NEVER repeat the exact original question verbatim. 2. NEVER give away the answer or hints. 3. NEVER ask any of the questions listed under "Main Interview Questions" as a follow-up. Your follow-up MUST be from the Required Key Points points only donot ask any other point as follow up.
- "skip" — ONLY if the candidate explicitly passes on the question (e.g., "I don't know", "skip this"). Do not use skip for off-topic answers; try to redirect them instead.

You MUST return ONLY a valid JSON object (no markdown, no extra text):
{
  "decision": "move_next" | "follow_up" | "skip",
  "covered_points": ["list of key points that were covered"],
  "missed_points": ["list of key points that were missed"],
  "coverage_percentage": <number 0-100>,
  "follow_up_question": "<natural follow-up question to ask, ONLY if decision is follow_up, otherwise empty string>"
}
`;

    const payload = {
      schemaVersion: "messages-v1",
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 500,
        temperature: 0.1,
      },
    };

    console.log(`[LiveEvaluate] Invoking AWS Bedrock: ${MODEL_ID}`);
    console.log(`[LiveEvaluate] --- LLM PROMPT PAYLOAD (SENT) ---`);
    console.log(`[..System prompt..]

## The Question Asked:
${sanitizedQuestion}

## Required Key Points (that the candidate MUST cover):
${keyPoints.map((kp: string, i: number) => `${i + 1}. ${kp}`).join('\n')}

## Candidate's Primary Answer:
${sanitizedAnswer}
${followUpsText}

[..System Instructions & Formatting..]`);
    console.log(`------------------------------------------------`);

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    let rawText = responseBody.output?.message?.content?.[0]?.text?.trim() || '{}';

    console.log(`[LiveEvaluate] --- LLM RAW RESPONSE (RECEIVED) ---`);
    console.log(rawText);
    console.log(`--------------------------------------------------`);

    // Strip markdown wrappers if present
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
      console.log(`[LiveEvaluate] Successfully parsed LLM JSON response.`);
    } catch (e) {
      console.log(`[LiveEvaluate] FALLBACK: Failed to parse LLM response. Defaulting to move_next. Raw Text was:`, rawText);
      // Default: move to next question on parse failure
      parsed = {
        decision: 'move_next',
        covered_points: [],
        missed_points: keyPoints,
        coverage_percentage: 0,
        follow_up_question: '',
      };
    }

    // Validate and sanitize the response
    const validDecisions = ['move_next', 'follow_up', 'skip'];
    const decision = validDecisions.includes(parsed.decision) ? parsed.decision : 'move_next';

    // Enforce limits and correct constraints rigidly
    let finalDecision = decision;
    const isCoverageComplete = Array.isArray(parsed.missed_points) && parsed.missed_points.length === 0;
    const reachedMaxFollowUps = typeof maxFollowUps === 'number' && typeof currentFollowUpCount === 'number' && currentFollowUpCount >= maxFollowUps;
    
    if (reachedMaxFollowUps || isCoverageComplete) {
      finalDecision = 'move_next';
    }

    console.log(`[LiveEvaluate] --- FINAL API RESPONSE OVERVIEW ---`);
    console.log(`Decision: ${finalDecision}`);
    console.log(`Coverage %: ${parsed.coverage_percentage}`);
    console.log(`Covered Points: ${parsed.covered_points?.length || 0}`);
    console.log(`Missed Points: ${parsed.missed_points?.length || 0}`);
    if (finalDecision === 'follow_up') {
      console.log(`Follow-up Question generated: ${parsed.follow_up_question}`);
    }
    console.log(`===============================================================\n`);

    return NextResponse.json({
      decision: finalDecision,
      covered_points: Array.isArray(parsed.covered_points) ? parsed.covered_points : [],
      missed_points: Array.isArray(parsed.missed_points) ? parsed.missed_points : [],
      coverage_percentage: typeof parsed.coverage_percentage === 'number'
        ? Math.max(0, Math.min(100, parsed.coverage_percentage))
        : 0,
      follow_up_question: finalDecision === 'follow_up' ? (parsed.follow_up_question || '') : '',
    });
  } catch (error: any) {
    console.log(`[LiveEvaluate] FALLBACK SEVERE ERROR: Caught unhandled API error!`);
    console.log(`[LiveEvaluate] Error Stack:`, error);
    console.log(`===============================================================\n`);
    return NextResponse.json({ error: 'An internal error occurred during live evaluation.' }, { status: 500 });
  }
}
