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
function calculateQuestionScore(
  rubricScores: { communication: number; relevance: number; problem_solving: number; specificity: number },
  coveragePercentage: number,
  followUpCount: number
): {
  rubric_weighted: number;
  coverage_weighted: number;
  follow_up_score: number;
  final_score: number;
} {
  // Rubric Score: 4 sub-categories max 25 each = 100, weighted to 50%
  const rubricTotal = clamp(rubricScores.communication, 0, 25)
    + clamp(rubricScores.relevance, 0, 25)
    + clamp(rubricScores.problem_solving, 0, 25)
    + clamp(rubricScores.specificity, 0, 25);
  const rubric_weighted = (rubricTotal / 100) * 50;

  // Coverage Score: % of key points covered, weighted to 40%
  const coverage_weighted = (clamp(coveragePercentage, 0, 100) / 100) * 40;

  // Follow-up Score: Starts at 10, deducts 5 per follow-up needed
  const follow_up_score = clamp(10 - (followUpCount * 5), 0, 10);

  const final_score = Math.round(Math.max(0, rubric_weighted + coverage_weighted + follow_up_score));

  return { 
    rubric_weighted: Math.round(rubric_weighted * 10) / 10, 
    coverage_weighted: Math.round(coverage_weighted * 10) / 10, 
    follow_up_score: Math.round(follow_up_score * 10) / 10, 
    final_score 
  };
}

function validateEvaluation(raw: any, coverageData: any, followUpData: any, totalQuestions: number): any {
  const evaluation: any = {
    feedback: typeof raw.feedback === 'string' ? raw.feedback : 'Evaluation completed.',
    per_question_results: [],
  };

  const defaultAspect = { score: 0, feedback: 'No evaluation available.' };
  let totalScoreSum = 0;

  const rawQuestions = Array.isArray(raw.per_question_aspects) ? raw.per_question_aspects : [];
  const perQCoverage = Array.isArray(coverageData.per_question) ? coverageData.per_question : [];
  const perQFollowUps = Array.isArray(followUpData.per_question) ? followUpData.per_question : [];

  for (let i = 0; i < totalQuestions; i++) {
    // Safely extract AI scores for this question
    const qRaw = rawQuestions.find((q: any) => q.question_id === i) || {};
    const communication = qRaw.communication || defaultAspect;
    const relevance = qRaw.relevance || defaultAspect;
    const problem_solving = qRaw.problem_solving || defaultAspect;
    const specificity = qRaw.specificity || defaultAspect;

    const rubricScores = {
      communication: clamp(typeof communication.score === 'number' ? communication.score : 0, 0, 25),
      relevance: clamp(typeof relevance.score === 'number' ? relevance.score : 0, 0, 25),
      problem_solving: clamp(typeof problem_solving.score === 'number' ? problem_solving.score : 0, 0, 25),
      specificity: clamp(typeof specificity.score === 'number' ? specificity.score : 0, 0, 25),
    };

    // Get live evaluator metrics for this question
    const coveragesForQ = perQCoverage.filter((c: any) => c.questionIndex === i);
    const coveragePercentage = coveragesForQ.length > 0 
      ? Math.max(...coveragesForQ.map((c: any) => c.coverage)) 
      : 0;

    const qFollow = perQFollowUps.find((f: any) => f.questionIndex === i);
    const followUpCount = qFollow ? qFollow.count : 0;

    // Calculate score for this question
    const scoring = calculateQuestionScore(rubricScores, coveragePercentage, followUpCount);
    
    totalScoreSum += scoring.final_score;

    evaluation.per_question_results.push({
      question_index: i,
      rubrics: {
        communication: { score: rubricScores.communication, feedback: typeof communication.feedback === 'string' ? communication.feedback : '' },
        relevance: { score: rubricScores.relevance, feedback: typeof relevance.feedback === 'string' ? relevance.feedback : '' },
        problem_solving: { score: rubricScores.problem_solving, feedback: typeof problem_solving.feedback === 'string' ? problem_solving.feedback : '' },
        specificity: { score: rubricScores.specificity, feedback: typeof specificity.feedback === 'string' ? specificity.feedback : '' },
      },
      scoring: {
        rubric_weighted: scoring.rubric_weighted,
        coverage_weighted: scoring.coverage_weighted,
        follow_up_score: scoring.follow_up_score,
        total_score: scoring.final_score,
      }
    });
  }

  // Final interview score is the average of all question scores
  evaluation.score = totalQuestions > 0 ? Math.round(totalScoreSum / totalQuestions) : 0;

  return evaluation;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questionBank, previousContext, coverageData, followUpData } = body;

    if (!Array.isArray(questionBank) || questionBank.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty question bank' }, { status: 400 });
    }
    if (!Array.isArray(previousContext) || previousContext.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty transcript' }, { status: 400 });
    }

    if (!process.env.ACCESS_KEY_ID) {
      return NextResponse.json({
        evaluation: { score: 0, feedback: "AWS credentials not configured." }
      });
    }

    const sanitizedTranscript = sanitizeTranscript(previousContext);

    const questionsForEval = questionBank.map((q: any, i: number) => {
      const questionText = typeof q === 'string' ? q : q.question || '';
      const answerText = typeof q === 'string' ? '' : q.answer || '';
      return \`Question ID \${i}: \${questionText}\nExpected Answer: \${answerText}\`;
    }).join('\n\n');

    const prompt = \`
      You are an expert Interview Evaluator (Evaluator 2 — Final Scoring).
      Your job is to evaluate the candidate's performance QUESTION-BY-QUESTION based on RUBRIC criteria.

      ## Questions and Expected Answers:
      \${questionsForEval}

      ## Full Interview Transcript:
      \${JSON.stringify(sanitizedTranscript, null, 2)}

      ## Your Task — Rubric Evaluation (Per Question)
      For EACH question ID listed above, find the candidate's answer(s) in the transcript.
      Evaluate their answer(s) to that specific question across these 4 rubric criteria:

      1. **Communication Clarity (0-25)**:
         - 20-25: Answer is structured, logically flowing, easy to understand.
         - 15-19: Mostly correct coverage, but no clear language, rambling.
         - 10-14: Candidate is speaking superficially, seems to jumble words.
         - 0-9: Not able to form correct sentences, or failed to answer.

      2. **Relevance & Depth of Response (0-25)**:
         - 20-25: Direct, substantive, insightful.
         - 15-19: Generally relevant but might include minor tangents.
         - 10-14: Mostly surface-level observations; misses underlying points.
         - 0-9: Completely off-topic or entirely composed of filler.

      3. **Problem-Solving & Critical Thinking (0-25)**:
         - 20-25: Demonstrates strong logical reasoning and conclusions.
         - 15-19: Shows some logical reasoning but may overlook trade-offs.
         - 10-14: Struggles to outline a clear path; relies on generic memory.
         - 0-9: Fails to demonstrate basic reasoning; relies on guesswork.

      4. **Specificity & Use of Examples (0-25)**:
         - 20-25: Consistently backs up claims with concrete examples.
         - 15-19: Provides some examples, but they might be generic.
         - 10-14: Rarely uses examples, relies on vague generalizations.
         - 0-9: Completely lacks examples or specificity.

      You MUST return your evaluation strictly as a JSON object matching this exact schema, without any markdown formatting wrappers or extra text:
      {
        "feedback": "<detailed overall text feedback explaining their overall interview performance>",
        "per_question_aspects": [
          {
            "question_id": <number (0, 1, 2...) matching the Question ID above>,
            "communication": { "score": <number 0-25>, "feedback": "<reasoning for this question>" },
            "relevance": { "score": <number 0-25>, "feedback": "<reasoning for this question>" },
            "problem_solving": { "score": <number 0-25>, "feedback": "<reasoning for this question>" },
            "specificity": { "score": <number 0-25>, "feedback": "<reasoning for this question>" }
          }
        ]
      }

      Generate an entry in the "per_question_aspects" array for EVERY question.
      Return ONLY the valid JSON object, no other text.
    \`;

    const payload = {
      schemaVersion: "messages-v1",
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0,
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
    if (text.trimStart().startsWith('\`\`\`json')) {
      text = text.replace(/^[\s]*\`\`\`json\s*/, '').replace(/\s*\`\`\`[\s]*$/, '');
    } else if (text.trimStart().startsWith('\`\`\`')) {
      text = text.replace(/^[\s]*\`\`\`\s*/, '').replace(/\s*\`\`\`[\s]*$/, '');
    }

    let evaluation;
    try {
      const parsed = JSON.parse(text);
      evaluation = validateEvaluation(
        parsed,
        coverageData || { average_coverage: 0, per_question: [] },
        followUpData || { per_question: [], total_questions: questionBank.length },
        questionBank.length
      );
    } catch (e) {
      console.error('[Evaluate] Parse error:', e);
      evaluation = { score: 0, feedback: text, per_question_results: [] };
    }

    return NextResponse.json({ evaluation });
  } catch (error: any) {
    console.error('Evaluator API Error:', error);
    return NextResponse.json({ error: 'An internal error occurred during evaluation.' }, { status: 500 });
  }
}
