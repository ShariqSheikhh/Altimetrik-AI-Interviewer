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

// ── Scoring calculation ───────────────────────────────────────────────
function calculateFinalScore(
  rubricScores: { communication: number; relevance: number; problem_solving: number; specificity: number },
  coveragePercentage: number,
  questionsWithFollowUps: number,
  totalQuestions: number
): {
  rubric_weighted: number;
  coverage_weighted: number;
  follow_up_penalty: number;
  final_score: number;
} {
  // Rubric Score: 4 sub-categories × 25 = 100, weighted to 50%
  const rubricTotal = clamp(rubricScores.communication, 0, 25)
    + clamp(rubricScores.relevance, 0, 25)
    + clamp(rubricScores.problem_solving, 0, 25)
    + clamp(rubricScores.specificity, 0, 25);
  const rubric_weighted = (rubricTotal / 100) * 50;

  // Coverage Score: % of key points covered, weighted to 40%
  const coverage_weighted = (clamp(coveragePercentage, 0, 100) / 100) * 40;

  // Follow-up Penalty: proportional to how many questions needed follow-ups, max 10 pts
  const followUpRatio = totalQuestions > 0 ? questionsWithFollowUps / totalQuestions : 0;
  const follow_up_penalty = followUpRatio * 10;

  const final_score = Math.round(Math.max(0, rubric_weighted + coverage_weighted - follow_up_penalty));

  return { rubric_weighted: Math.round(rubric_weighted * 10) / 10, coverage_weighted: Math.round(coverage_weighted * 10) / 10, follow_up_penalty: Math.round(follow_up_penalty * 10) / 10, final_score };
}

function validateEvaluation(raw: any, coverageData: any, followUpData: any): any {
  const evaluation: any = {};

  // Validate rubric feedback
  evaluation.feedback = typeof raw.feedback === 'string' ? raw.feedback : 'Evaluation completed.';

  // Validate and clamp rubric aspect scores
  const defaultAspect = { score: 0, feedback: 'No evaluation available.' };
  const aspectKeys = ['communication', 'relevance', 'problem_solving', 'specificity'] as const;

  evaluation.rubric_aspects = {};
  for (const key of aspectKeys) {
    const aspect = raw.aspects?.[key];
    if (aspect && typeof aspect === 'object') {
      evaluation.rubric_aspects[key] = {
        score: clamp(typeof aspect.score === 'number' ? aspect.score : 0, 0, 25),
        feedback: typeof aspect.feedback === 'string' ? aspect.feedback : '',
      };
    } else {
      evaluation.rubric_aspects[key] = { ...defaultAspect };
    }
  }

  // Get coverage data from the live evaluator metrics
  const avgCoverage = coverageData.average_coverage || 0;
  const questionsWithFollowUps = followUpData.questions_with_follow_ups || 0;
  const totalQuestions = followUpData.total_questions || 1;

  // Calculate final weighted scores
  const rubricScores = {
    communication: evaluation.rubric_aspects.communication.score,
    relevance: evaluation.rubric_aspects.relevance.score,
    problem_solving: evaluation.rubric_aspects.problem_solving.score,
    specificity: evaluation.rubric_aspects.specificity.score,
  };

  const scoring = calculateFinalScore(rubricScores, avgCoverage, questionsWithFollowUps, totalQuestions);

  evaluation.scoring = {
    rubric_score: {
      raw_total: rubricScores.communication + rubricScores.relevance + rubricScores.problem_solving + rubricScores.specificity,
      weighted: scoring.rubric_weighted,
      max: 50,
      description: 'Communication, Relevance, Problem-Solving, Specificity (0-25 each), weighted to 50%',
    },
    coverage_score: {
      percentage: Math.round(avgCoverage),
      weighted: scoring.coverage_weighted,
      max: 40,
      description: '% of key points covered across primary + follow-up answers',
      per_question: coverageData.per_question || [],
    },
    follow_up_penalty: {
      questions_needing_follow_ups: questionsWithFollowUps,
      total_questions: totalQuestions,
      penalty: scoring.follow_up_penalty,
      max: 10,
      description: 'Deducted if key points only emerged after repeated probing',
    },
  };

  evaluation.score = scoring.final_score;

  return evaluation;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questionBank, previousContext, coverageData, followUpData } = body;

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

    // Build questions with expected answers for rubric evaluation
    const questionsForEval = questionBank.map((q: any, i: number) => {
      const questionText = typeof q === 'string' ? q : q.question || '';
      const answerText = typeof q === 'string' ? '' : q.answer || '';
      return `${i + 1}. Question: ${questionText}\n   Expected Answer: ${answerText}`;
    }).join('\n\n');

    const prompt = `
      You are an expert Interview Evaluator (Evaluator 2 — Final Scoring).
      Your job is to evaluate the candidate's OVERALL performance based on RUBRIC criteria.

      ## Questions and Expected Answers:
      ${questionsForEval}

      ## Full Interview Transcript:
      ${JSON.stringify(sanitizedTranscript, null, 2)}

      ## Your Task — Rubric Evaluation
      Evaluate the candidate across these 4 rubric criteria:

      1. **Communication Clarity (0-25)**: Logical flow, sentence structure, and ability to convey ideas without ambiguity or contradiction.
      2. **Relevance & Depth of Response (0-25)**: How directly the answer addresses the question, with substantive insight rather than surface-level filler.
      3. **Problem-Solving & Critical Thinking (0-25)**: Reasoning through scenarios, weighing trade-offs, and arriving at well-justified conclusions.
      4. **Specificity & Use of Examples (0-25)**: Backing claims with concrete examples, data, or past experiences rather than vague generalities.

      Compare the candidate's answers against the expected answers to judge quality.

      You MUST return your evaluation strictly as a JSON object matching this exact schema, without any markdown formatting wrappers or extra text:
      {
        "feedback": "<detailed overall text feedback explaining the performance>",
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
    let text = responseBody.output?.message?.content?.[0]?.text || '{}';

    // Strip markdown wrappers
    if (text.trimStart().startsWith('```json')) {
      text = text.replace(/^[\s]*```json\s*/, '').replace(/\s*```[\s]*$/, '');
    } else if (text.trimStart().startsWith('```')) {
      text = text.replace(/^[\s]*```\s*/, '').replace(/\s*```[\s]*$/, '');
    }

    let evaluation;
    try {
      const parsed = JSON.parse(text);
      evaluation = validateEvaluation(
        parsed,
        coverageData || { average_coverage: 0, per_question: [] },
        followUpData || { questions_with_follow_ups: 0, total_questions: questionBank.length }
      );
    } catch (e) {
      console.error('[Evaluate] Parse error:', e);
      evaluation = { score: 0, feedback: text };
    }

    return NextResponse.json({ evaluation });
  } catch (error: any) {
    console.error('Evaluator API Error:', error);
    return NextResponse.json({ error: 'An internal error occurred during evaluation.' }, { status: 500 });
  }
}
