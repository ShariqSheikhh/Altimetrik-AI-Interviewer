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

export async function POST(req: Request) {
  try {
    const { questionBank, previousContext } = await req.json();

    if (!process.env.AWS_ACCESS_KEY_ID) {
      // Mock mode for local testing if no credentials provided
      return NextResponse.json({
        evaluation: { score: 8, feedback: "Mock evaluation: Good answers." }
      });
    }

    const prompt = `
      You are an expert Interview Evaluator.
      Here is the candidate's interview transcript.
      
      Questions they were supposed to be asked: ${JSON.stringify(questionBank)}
      
      Actual Conversation / Candidate's Answers:
      ${JSON.stringify(previousContext, null, 2)}
      
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
      evaluation = JSON.parse(text);
      // Calculate total score dynamically from aspect scores
      let totalScore = 0;
      if (evaluation.aspects) {
        totalScore += (evaluation.aspects.communication?.score || 0);
        totalScore += (evaluation.aspects.relevance?.score || 0);
        totalScore += (evaluation.aspects.problem_solving?.score || 0);
        totalScore += (evaluation.aspects.specificity?.score || 0);
      }
      evaluation.score = totalScore;
    } catch (e) {
      // Fallback if parsing fails
      evaluation = { score: 0, feedback: text };
    }

    return NextResponse.json({ evaluation });
  } catch (error: any) {
    console.error('Evaluator API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
