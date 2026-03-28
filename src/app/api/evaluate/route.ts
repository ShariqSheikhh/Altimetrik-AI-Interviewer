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

// ── Guardrails ────────────────────────────────────────────────────────
const MAX_TRANSCRIPT_ENTRIES = 200;
const MAX_ENTRY_LENGTH = 5000;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function sanitizeTranscript(entries: any[]): any[] {
  return entries.slice(0, MAX_TRANSCRIPT_ENTRIES).map((entry: any) => ({
    speaker: entry.speaker === 'AI' ? 'AI' : 'Candidate',
    text: typeof entry.text === 'string' ? entry.text.slice(0, MAX_ENTRY_LENGTH) : '',
  }));
}

function validateEvaluation(raw: any): any {
  const evaluation: any = {};

  // Validate feedback
  evaluation.feedback = typeof raw.feedback === 'string' ? raw.feedback : 'Evaluation completed.';

  // Validate and clamp aspect scores
  const defaultAspect = { score: 0, feedback: 'No evaluation available.' };
  const aspectKeys = ['communication', 'relevance', 'problem_solving', 'specificity'] as const;

  evaluation.aspects = {};
  for (const key of aspectKeys) {
    const aspect = raw.aspects?.[key];
    if (aspect && typeof aspect === 'object') {
      evaluation.aspects[key] = {
        score: clamp(typeof aspect.score === 'number' ? aspect.score : 0, 0, 25),
        feedback: typeof aspect.feedback === 'string' ? aspect.feedback : '',
      };
    } else {
      evaluation.aspects[key] = { ...defaultAspect };
    }
  }

  // Calculate total score from clamped aspect scores
  evaluation.score = aspectKeys.reduce(
    (sum, key) => sum + evaluation.aspects[key].score,
    0
  );

  return evaluation;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questionBank, previousContext } = body;

    // ── Input validation ──────────────────────────────────────────
    if (!Array.isArray(questionBank) || questionBank.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty question bank' }, { status: 400 });
    }
    if (!Array.isArray(previousContext) || previousContext.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty transcript' }, { status: 400 });
    }

    if (!process.env.AWS_ACCESS_KEY_ID) {
      return NextResponse.json({
        evaluation: { score: 0, feedback: "AWS credentials not configured." }
      });
    }

    const sanitizedTranscript = sanitizeTranscript(previousContext);

    // Build questions — send ONLY question text, never the answer
    const questionsForEval = questionBank.map((q: any, i: number) => {
      const questionText = typeof q === 'string' ? q : q.question || '';
      return `${i + 1}. ${questionText}`;
    }).join('\n');

    const prompt = `
      You are an expert Interview Evaluator.
      Here is the candidate's interview transcript.

      Questions they were supposed to be asked:
      ${questionsForEval}

      Actual Conversation / Candidate's Answers:
      ${JSON.stringify(sanitizedTranscript, null, 2)}

      Please meticulously evaluate the candidate's performance based on the following 4 aspects:
      1. Communication Clarity (25 points): Logical flow, sentence structure, and ability to convey ideas without ambiguity or contradiction.
      2. Relevance & Depth of Response (25 points): How directly the answer addresses the question, with substantive insight rather than surface-level filler.
      3. Problem-Solving & Critical Thinking (25 points): Reasoning through scenarios, weighing trade-offs, and arriving at well-justified conclusions.
      4. Specificity & Use of Examples (25 points): Backing claims with concrete examples, data, or past experiences rather than vague generalities.

      You MUST return your evaluation strictly as a JSON object matching this exact schema, without any markdown formatting wrappers or extra text:
      {
        "feedback": "<detailed overall text feedback explaining the score and summarizing the performance>",
        "aspects": {
          "communication": { "score": <number 0-25>, "feedback": "<reasoning>" },
          "relevance": { "score": <number 0-25>, "feedback": "<reasoning>" },
          "problem_solving": { "score": <number 0-25>, "feedback": "<reasoning>" },
          "specificity": { "score": <number 0-25>, "feedback": "<reasoning>" }
        }
      }

      Return ONLY the valid JSON object, no other text.
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
        maxTokens: 2048,
        temperature: 0.3,
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
    const text = responseBody.output?.message?.content?.[0]?.text || '{}';

    let evaluation;
    try {
      const parsed = JSON.parse(text);
      evaluation = validateEvaluation(parsed);
    } catch (e) {
      evaluation = { score: 0, feedback: text };
    }

    return NextResponse.json({ evaluation });
  } catch (error: any) {
    console.error('Evaluator API Error:', error);
    return NextResponse.json({ error: 'An internal error occurred during evaluation.' }, { status: 500 });
  }
}
