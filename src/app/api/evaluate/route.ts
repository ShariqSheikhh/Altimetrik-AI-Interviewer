import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'MISSING_KEY' });

export async function POST(req: Request) {
  try {
    const { questionBank, previousContext } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      // Mock mode for local testing if no key provided
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
        "score": <total number from 0 to 100>,
        "feedback": "<detailed overall text feedback explaining the score and summarizing the performance>",
        "aspects": {
          "communication": { "score": <number 0-25>, "feedback": "<reasoning>" },
          "relevance": { "score": <number 0-25>, "feedback": "<reasoning>" },
          "problem_solving": { "score": <number 0-25>, "feedback": "<reasoning>" },
          "specificity": { "score": <number 0-25>, "feedback": "<reasoning>" }
        }
      }
    `;
    
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || '{}';
    let evaluation;
    try {
      evaluation = JSON.parse(text);
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
