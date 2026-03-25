import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'MISSING_KEY' });

export async function POST(req: Request) {
  try {
    const { fileName, mimeType, base64Data } = await req.json();

    if (!base64Data || !mimeType) {
      return NextResponse.json({ error: 'Missing file data' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
       return NextResponse.json({ error: 'GEMINI_API_KEY is missing in env' }, { status: 500 });
    }

    const prompt = `
      You are an expert HR assistant. Your task is to extract a list of interview questions from the provided document.
      If the document is a job description, generate 5 to 8 highly relevant interview questions based on the requirements.
      If the document is already a list of questions, simply extract and format them clearly.
      
      Return ONLY a raw JSON flat array of strings. No markdown formatting, no code blocks, no intro/outro explanations. 
      Example: ["Question 1?", "Question 2?", "Question 3?"]
    `;

    // Strip the "data:mime/type;base64," prefix
    const base64Clean = base64Data.split(',').pop();

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Clean,
            mimeType: mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'application/pdf' : mimeType // fallback trick if needed, but Gemini natively supports many
          }
        },
        { text: prompt }
      ]
    });

    const text = response.text || '';
    
    let questions: string[] = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
         questions = JSON.parse(jsonMatch[0]);
      } else {
         questions = JSON.parse(text);
      }
    } catch (e) {
      console.error("Failed to parse AI output as JSON array:", text);
      throw new Error("AI returned an invalid format. Please try another document.");
    }

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('Extraction API Error:', error);
    return NextResponse.json({ error: 'Failed to extract questions from document. Ensure it is text or PDF.' }, { status: 500 });
  }
}
