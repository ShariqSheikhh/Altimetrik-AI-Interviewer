import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { action, questionBank, currentQuestionIndex } = await req.json();

    if (action === 'ask_next') {
      if (currentQuestionIndex >= questionBank.length) {
        return NextResponse.json({ 
          response: "Thank you for your valuable time and responses. That concludes our interview process for today. Let me save your session.", 
          isCompleted: true 
        });
      }

      const isFirstQuestion = currentQuestionIndex === -1;
      const targetQuestion = isFirstQuestion 
        ? "Hello and welcome! Could you please briefly introduce yourself and share a bit about your background?" 
        : questionBank[currentQuestionIndex].question;

      const responseText = isFirstQuestion 
        ? targetQuestion 
        : `Thank you. Here is your next question: ${targetQuestion}`;

      return NextResponse.json({ 
        response: responseText, 
        isCompleted: false 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Interviewer API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
