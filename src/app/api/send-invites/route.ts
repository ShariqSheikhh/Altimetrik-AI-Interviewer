import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const MAX_RETRIES = 3;

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { interviewId, candidates, subject, htmlContent, fromEmail, fromName } = body;

    if (!interviewId || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: 'Invalid request: interviewId and candidates array required' }, { status: 400 });
    }

    if (!subject || !htmlContent) {
      return NextResponse.json({ error: 'Email subject and content are required' }, { status: 400 });
    }

    const transporter = createTransporter();

    const results: Array<{ email: string; success: boolean; error?: string }> = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const candidate of candidates) {
      const loginLink = `${process.env.NEXT_PUBLIC_APP_URL}/candidate/login`;

      const personalizedHtml = htmlContent
        .replace(/{{candidateName}}/g, candidate.name || 'Candidate')
        .replace(/{{candidateEmail}}/g, candidate.email)
        .replace(/{{passkey}}/g, candidate.passkey)
        .replace(/{{loginLink}}/g, loginLink)
        .replace(/{{interviewTitle}}/g, body.interviewTitle || 'the interview');

      let attempt = 0;
      let success = false;
      let lastError: string | undefined;

      while (attempt < MAX_RETRIES && !success) {
        try {
          await transporter.sendMail({
            from: `"${fromName || 'AI Interviewer'}" <${fromEmail || process.env.SMTP_FROM_EMAIL || 'noreply@altimetrik.com'}>`,
            to: candidate.email,
            subject: subject.replace(/{{interviewTitle}}/g, body.interviewTitle || 'Interview'),
            html: personalizedHtml,
          });
          success = true;
          sentCount++;
        } catch (err: any) {
          attempt++;
          lastError = err.message;
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      results.push({
        email: candidate.email,
        success,
        error: lastError,
      });

      if (!success) {
        failedCount++;
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      success: true,
      total: candidates.length,
      sent: sentCount,
      failed: failedCount,
      results,
    });
  } catch (error: any) {
    console.error('Send invites error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send invites' },
      { status: 500 }
    );
  }
}
