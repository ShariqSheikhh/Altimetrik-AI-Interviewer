import { NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const MODEL_ID = process.env.AWS_MODEL_NAME || 'amazon.nova-lite-v1:0';

// ── Input guardrails ──────────────────────────────────────────────────
const MAX_TEXT_LENGTH = 5000;

function sanitize(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.slice(0, MAX_TEXT_LENGTH).trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, candidateAnswer, keyPoints, followUpAnswer } = body;

    if (!question || !candidateAnswer || !Array.isArray(keyPoints) || keyPoints.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: question, candidateAnswer, keyPoints' }, { status: 400 });
    }

    if (!process.env.AWS_ACCESS_KEY_ID) {
      return NextResponse.json({
        decision: 'move_next',
        covered_points: [],
        missed_points: keyPoints,
        coverage_percentage: 0,
      });
    }

    const sanitizedQuestion = sanitize(question);
    const sanitizedAnswer = sanitize(candidateAnswer);
    const sanitizedFollowUp = followUpAnswer ? sanitize(followUpAnswer) : null;

    const prompt = `
You are an expert interview evaluator sitting silently in the corner during an interview.
Your ONLY job is to check whether the candidate's answer covers the required key points.

## The Question Asked:
${sanitizedQuestion}

## Required Key Points (that the candidate MUST cover):
${keyPoints.map((kp: string, i: number) => `${i + 1}. ${kp}`).join('\n')}

## Candidate's Primary Answer:
${sanitizedAnswer}
${sanitizedFollowUp ? `\n## Candidate's Follow-up Answer:\n${sanitizedFollowUp}` : ''}

## Your Task:
Analyze the candidate's answer(s) and determine which key points were covered and which were missed.

Then decide:
- "move_next" — MANDATORY if ALL key points are covered in the candidate's answer. If the candidate has successfully demonstrated understanding of the required key points, you MUST choose "move_next". Do NOT ask follow-ups just for the sake of it.
- "follow_up" — ONLY if ONE OR MORE key points are CLEARLY MISSING BUT the answer is in the right context (partially correct). Generate a natural follow-up question that specifically asks about the MISSED key points to see if the candidate knows them, WITHOUT revealing the answer.
- "skip" — if the answer is COMPLETELY off-topic, out of context from the very beginning, or if they explicitly say they don't know. No follow-up needed.

${sanitizedFollowUp ? 'IMPORTANT: Since this is already a follow-up answer, you should decide "move_next" regardless. The candidate has had their chance. Do NOT request another follow-up.' : ''}

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
        maxTokens: 1024,
        temperature: 0.2,
      },
    };

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    let rawText = responseBody.output?.message?.content?.[0]?.text?.trim() || '{}';

    // Strip markdown wrappers if present
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.error('[LiveEvaluate] Failed to parse LLM response:', rawText);
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

    // If this was already a follow-up answer, force move_next
    const finalDecision = sanitizedFollowUp ? 'move_next' : decision;

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
    console.error('Live Evaluate API Error:', error);
    return NextResponse.json({ error: 'An internal error occurred during live evaluation.' }, { status: 500 });
  }
}
