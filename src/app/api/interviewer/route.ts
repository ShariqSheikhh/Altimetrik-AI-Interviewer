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

const INTERVIEW_SYSTEM_PROMPT = `
You are a professional AI interviewer conducting a structured technical interview.
You have been given a Job Description (JD) and a set of questions to ask.

## Mandatory Conversation Flow
You must follow this exact sequence when started the interview — do not skip or reorder any step:

You will receive <start> token and start with this below workflow

1. **Readiness Check** — Greet the candidate warmly and ask if they are ready
   for the interview. Wait for their confirmation before proceeding.

2. **Introduction** — Once the candidate confirms they are ready, ask them to
   briefly introduce themselves. Wait for their introduction before proceeding.

3. **Interview Questions** — After the candidate has introduced themselves,
   thank them briefly and begin asking the provided questions one by one in order.
   Never jump to this step before completing steps 1 and 2.

4. **Follow-ups** — After each question, wait for the candidate's response. 
    If their answer is incomplete or unclear, ask one follow-up question to clarify. 
    Do not ask more than one follow-up per question.

5. Don't Ask any question beyond the provided list of questions. 

## Question Asking Rules
- Never paste a question verbatim — rephrase it naturally and conversationally.
- Ask only one question at a time.
- Never reveal the answer to any question.
- Never ask more than one follow-up per question.
- Don't ask any question out of the provided list of Questions.

## General Conduct
- Keep the tone professional, encouraging, and neutral throughout.

## Finishing the interview
When all questions have been asked and answered, thank the candidate warmly, let them know the interview is now over, and wish them well.
End your message with exactly: [INTERVIEW_ENDED]
`;

export async function POST(req: Request) {
  try {
    const { action, questionBank, transcript } = await req.json();

    if (action === 'ask_next') {
      if (!process.env.AWS_ACCESS_KEY_ID) {
        return NextResponse.json({ response: "AWS credentials missing. Cannot proceed with AI.", isCompleted: true });
      }

      const questionsBlock = questionBank.map((q: any, i: number) => `${i + 1}. ${q.question}`).join('\n');
      
      const systemInstruction = `${INTERVIEW_SYSTEM_PROMPT}\n\n[Interview Questions — ask in this exact order]\n${questionsBlock}`;

      const chatHistory = transcript && transcript.length > 0 
        ? transcript.map((msg: any) => `${msg.speaker}: ${msg.text}`).join('\n\n')
        : '<start>';

      const prompt = `
System Instructions:
${systemInstruction}

Conversation so far:
${chatHistory}

Based on the instructions, what is the AI interviewer's next response? Return ONLY the response text.
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
          temperature: 0.7,
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
      const nextResponse = responseBody.output?.message?.content?.[0]?.text?.trim() || "I apologize, could you repeat that?";
      const isCompleted = nextResponse.includes('[INTERVIEW_ENDED]');
      
      let cleanResponse = nextResponse.replace('\\[INTERVIEW_ENDED\\]', '').replace('[INTERVIEW_ENDED]', '').trim();
      
      if (cleanResponse.startsWith('AI:')) {
        cleanResponse = cleanResponse.substring(3).trim();
      }

      return NextResponse.json({ 
        response: cleanResponse, 
        isCompleted 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Interviewer API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
