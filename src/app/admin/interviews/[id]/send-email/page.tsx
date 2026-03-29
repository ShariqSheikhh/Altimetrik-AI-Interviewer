'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Send, Mail, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SendEmailPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;

  const [interview, setInterview] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [subject, setSubject] = useState('Interview Invitation - {{interviewTitle}}');
  const [htmlContent, setHtmlContent] = useState(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
    .credentials { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Interview Invitation</h1>
      <p>You have been invited to take part in an AI-powered interview</p>
    </div>
    <div class="content">
      <p>Dear {{candidateName}},</p>

      <p>You have been invited to participate in the <strong>{{interviewTitle}}</strong> interview. This is an AI-powered automated interview that will assess your skills through a series of questions.</p>

      <div class="credentials">
        <h3>Your Login Credentials</h3>
        <p><strong>Email:</strong> {{candidateEmail}}</p>
        <p><strong>Passkey:</strong> <code style="background: #eee; padding: 5px 10px; border-radius: 3px;">{{passkey}}</code></p>
      </div>

      <p>Click the button below to access your interview:</p>

      <a href="{{loginLink}}" class="button">Start Interview</a>

      <p style="margin-top: 20px;"><strong>Important Notes:</strong></p>
      <ul>
        <li>Ensure you have a stable internet connection</li>
        <li>Find a quiet place with good lighting</li>
        <li>Your camera and microphone will be required</li>
        <li>Do not refresh or close the browser during the interview</li>
      </ul>

      <p>If you have any questions or face technical issues, please contact our support team.</p>

      <p>Best regards,<br/>The AI Interviewer Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`);

  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('AI Interviewer');

  useEffect(() => {
    const fetchData = async () => {
      const [interviewRes, candidatesRes] = await Promise.all([
        supabase.from('interviews').select('*').eq('id', interviewId).single(),
        supabase.from('candidates').select('*').eq('interview_id', interviewId).eq('is_allowed', true),
      ]);

      if (interviewRes.data) setInterview(interviewRes.data);
      if (candidatesRes.data) setCandidates(candidatesRes.data);
      setLoading(false);
    };

    fetchData();
  }, [interviewId]);

  const handleSend = async () => {
    setSending(true);
    try {
      const response = await fetch('/api/send-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          interviewTitle: interview?.title,
          candidates: candidates.map(c => ({
            email: c.email,
            name: c.name,
            passkey: c.passkey,
          })),
          subject,
          htmlContent,
          fromEmail,
          fromName,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invites');
      }

      // Store progress data in sessionStorage for the progress page
      sessionStorage.setItem('emailProgress', JSON.stringify(data));
      sessionStorage.setItem('emailSentCount', data.sent.toString());
      sessionStorage.setItem('emailFailedCount', data.failed.toString());
      sessionStorage.setItem('emailTotal', data.total.toString());

      // Redirect to progress page
      router.push(`/admin/interviews/${interviewId}/email-progress`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      setSending(false);
    }
  };

  const availableVariables = [
    { key: '{{candidateName}}', description: 'Candidate\'s name' },
    { key: '{{candidateEmail}}', description: 'Candidate\'s email' },
    { key: '{{passkey}}', description: 'Unique passkey for login' },
    { key: '{{loginLink}}', description: 'Direct login link' },
    { key: '{{interviewTitle}}', description: 'Interview/test title' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-blue-400" size={48} />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Send Interview Invites</h1>
            <p className="text-slate-400 mt-1">Compose and send emails to {candidates.length} candidates</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Email Composition */}
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Mail size={20} className="text-blue-400" /> Email Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">From Name</label>
                  <input
                    type="text"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="AI Interviewer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">From Email</label>
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="noreply@yourcompany.com"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Send size={20} className="text-blue-400" /> Email Content
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Subject Line</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Interview Invitation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Email Body (HTML)</label>
                  <textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    rows={20}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Enter HTML email content..."
                  />
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Available Variables:</h3>
                  <div className="space-y-2">
                    {availableVariables.map((v) => (
                      <div key={v.key} className="flex items-center justify-between text-sm">
                        <code className="text-blue-400 bg-blue-500/10 px-2 py-1 rounded">{v.key}</code>
                        <span className="text-slate-500">{v.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview and Send */}
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Users size={20} className="text-blue-400" /> Recipients
              </h2>

              <div className="mb-4 text-sm text-slate-400">
                Sending to <span className="text-white font-semibold">{candidates.length}</span> candidates
              </div>

              <div className="max-h-64 overflow-y-auto border border-white/5 rounded-xl bg-black/30">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-medium text-slate-400">Name</th>
                      <th className="px-4 py-3 font-medium text-slate-400">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {candidates.map((c, i) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="px-4 py-3">{c.name}</td>
                        <td className="px-4 py-3 text-slate-400">{c.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-semibold mb-4">Preview</h2>
              <div className="bg-white rounded-xl overflow-hidden">
                <iframe
                  srcDoc={htmlContent
                    .replace(/{{candidateName}}/g, 'John Doe')
                    .replace(/{{candidateEmail}}/g, 'john@example.com')
                    .replace(/{{passkey}}/g, 'ABC12345')
                    .replace(/{{loginLink}}/g, '#')
                    .replace(/{{interviewTitle}}/g, interview?.title || 'Interview')}
                  className="w-full h-96 border-0"
                  title="Email Preview"
                />
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={sending || candidates.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full px-8 py-4 flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_-5px_var(--color-blue-600)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Sending...
                </>
              ) : (
                <>
                  <Send size={20} /> Send Invites to {candidates.length} Candidates
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
