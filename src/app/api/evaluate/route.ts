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
      You are an expert AI Interview Evaluator.
      Here is the candidate's interview transcript.
      
      Questions they were supposed to be asked (and expected answers): ${JSON.stringify(questionBank)}
      
      Actual Conversation / Candidate's Answers:
      ${JSON.stringify(previousContext, null, 2)}
      
      Please meticulously evaluate the candidate's performance. Consider their technical accuracy, communication skills, and depth of knowledge.
      
      You MUST return your evaluation strictly as a JSON object matching this schema, without any markdown formatting wrappers or extra text:
      {
        "score": <number from 0 to 100>,
        "feedback": "<detailed text feedback explaining the score and summarizing the performance>"
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
