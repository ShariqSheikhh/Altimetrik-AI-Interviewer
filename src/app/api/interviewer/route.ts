import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Assume GEMINI_API_KEY is in env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'MISSING_KEY' });

export async function POST(req: Request) {
  try {
    const { action, questionBank, currentQuestionIndex, candidateAnswer, previousContext } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      // Mock mode for local testing if no key provided
      if (action === 'ask_next') {
        return NextResponse.json({ 
          response: questionBank[currentQuestionIndex] || "Thank you. We are done.",
          isCompleted: currentQuestionIndex >= questionBank.length
        });
      }
      if (action === 'evaluate') {
        return NextResponse.json({
          evaluation: { score: 8, feedback: "Mock evaluation: Good answers." }
        });
      }
    }

    if (action === 'ask_next') {
      if (currentQuestionIndex >= questionBank.length) {
        const prompt = `You are an AI Interviewer concluding the interview dynamically. Generate a warm, professional closing statement. Assure the candidate that their responses are recorded, thank them sincerely for their time, very briefly acknowledge their general effort, and wish them a great day. Output ONLY the spoken text.`;
        const response = await ai.models.generateContent({
           model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
           contents: prompt
        });
        return NextResponse.json({ response: response.text, isCompleted: true });
      }

      const targetQuestion = currentQuestionIndex === -1 ? "Could you please briefly introduce yourself and share a bit about your background?" : questionBank[currentQuestionIndex];

      const prompt = `
        You are an AI Interviewer conducting a professional interview.
        Guardrails: 
        1. Be polite, conversational, and professional. 
        2. Do not answer questions for the candidate or provide hints. 
        3. Do not be biased.
        4. Maintain a natural human-like rhythm.
        
        ${currentQuestionIndex === -1 
          ? "Since this is the VERY FIRST question, start by warmly welcoming the candidate to the interview! Introduce yourself quickly as the AI Interviewer, and kindly ask the following introductory question." 
          : "Acknowledge the candidate's previous answer dynamically and humanly (e.g., 'That is a great approach', 'I understand', 'Good point, let us move on'). If their answer was severely lacking, just be encouraging and pivot. Then, seamlessly ask the following question."}

        Next question to ask: "${targetQuestion}"
        
        Previous Context (Candidate's previous answers, if any): 
        ${JSON.stringify(previousContext)}
        
        Please generate the exact spoken text to say to the candidate naturally now. Output only the dialogue you will speak.
      `;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: prompt
      });

      return NextResponse.json({ 
        response: response.text, 
        isCompleted: false 
      });
    }

    if (action === 'evaluate') {
      const prompt = `
        You are an expert AI Interview Evaluator.
        Here is the question bank: ${JSON.stringify(questionBank)}
        Here are the candidate's answers:
        ${JSON.stringify(previousContext)}
        
        Please evaluate the candidate's performance. Consider accuracy, communication, and depth of knowledge.
        Return a JSON object with two fields: 
        1. "score" (number from 0 to 100)
        2. "feedback" (detailed text feedback)
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const text = response.text || '';
      // Try to parse JSON from the response
      let evaluation = { score: 0, feedback: 'Failed to parse evaluation.' };
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          evaluation = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        evaluation.feedback = text;
      }

      return NextResponse.json({ evaluation });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Interviewer API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
