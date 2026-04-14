'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Send, Mail, Users, Loader2, ShieldCheck, FileCode, Monitor } from 'lucide-react';
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
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: white; padding: 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; text-transform: uppercase; }
    .header p { margin: 10px 0 0; color: #94a3b8; font-size: 14px; }
    .content { padding: 40px; }
    .greeting { font-size: 18px; font-weight: 700; margin-bottom: 20px; }
    .button { display: inline-block; background: #2563eb; color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 12px; margin-top: 30px; font-weight: 700; text-align: center; }
    .credentials { background: #f1f5f9; border-radius: 12px; padding: 25px; margin: 30px 0; border: 1px solid #e2e8f0; }
    .credentials h3 { margin: 0 0 15px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
    .cred-item { margin-bottom: 10px; font-size: 15px; }
    .cred-item strong { color: #0f172a; }
    .passkey { font-family: monospace; background: #ffffff; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0; font-weight: 700; color: #2563eb; }
    .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 12px; background: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Interview Invitation</h1>
      <p>Altimetrik Assessment Protocol</p>
    </div>
    <div class="content">
      <p class="greeting">Hello {{candidateName}},</p>

      <p>You have been selected to participate in the <strong>{{interviewTitle}}</strong> assessment. This is a secure, AI-powered interview designed to evaluate your technical and analytical capabilities.</p>

      <div class="credentials">
        <h3>Secure Access Credentials</h3>
        <div class="cred-item"><strong>ID:</strong> {{candidateEmail}}</div>
        <div class="cred-item"><strong>Secure Passkey:</strong> <span class="passkey">{{passkey}}</span></div>
      </div>

      <p>Please click the button below to initialize your assessment session. Ensure you are in a quiet environment with camera and microphone access enabled.</p>

      <div style="text-align: center;">
        <a href="{{loginLink}}" class="button">Initialize Assessment</a>
      </div>

      <p style="margin-top: 40px; font-size: 13px; color: #64748b;"><strong>Technical Requirements:</strong> Stable internet, Chrome/Edge browser, and full-screen mode enabled throughout the session.</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 Altimetrik Corporate Systems. All rights reserved.</p>
      <p>This is an automated operational message. Do not reply.</p>
    </div>
  </div>
</body>
</html>`);

  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('Altimetrik Assessments');

  useEffect(() => {
    const fetchData = async () => {
      const [interviewRes, candidatesRes] = await Promise.all([
        supabase.from('interviews').select('*').eq('id', interviewId).single(),
        supabase.from('candidates').select('*').eq('interview_id', interviewId).eq('is_allowed', true),
      ]);

      if (interviewRes.data) setInterview(interviewRes.data);
      if (candidatesRes.data) setCandidates(candidatesRes.data || []);
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
          fromName,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invites');
      }

      sessionStorage.setItem('emailProgress', JSON.stringify(data));
      sessionStorage.setItem('emailSentCount', data.sent.toString());
      sessionStorage.setItem('emailFailedCount', data.failed.toString());
      sessionStorage.setItem('emailTotal', data.total.toString());

      router.push(`/admin/interviews/${interviewId}/email-progress`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={`/admin/interviews/${interviewId}/status`} className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Campaign Dispatch</h1>
            <p className="text-slate-500 font-medium tracking-tight">Broadcasting secure invites to <span className="text-blue-600 font-bold">{candidates.length} candidates</span>.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <div className="space-y-10">
          <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
            <h2 className="text-xl font-bold mb-8 text-slate-900 flex items-center gap-3">
              <Mail size={24} className="text-blue-500" />
              Sender Identity
            </h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Authorized Name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="Altimetrik Assessments"
                />
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
            <h2 className="text-xl font-bold mb-8 text-slate-900 flex items-center gap-3">
              <FileCode size={24} className="text-blue-500" />
              Payload Configuration
            </h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Subject Protocol</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Body Markup (HTML)</label>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  rows={15}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-slate-600 font-mono text-xs leading-relaxed focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                />
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-[1.5rem] p-6 space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Injection Tokens</p>
                  <div className="grid grid-cols-2 gap-3">
                      {[
                        { k: '{{candidateName}}', d: 'Name' },
                        { k: '{{passkey}}', d: 'Secure Key' },
                        { k: '{{loginLink}}', d: 'URL' },
                        { k: '{{interviewTitle}}', d: 'Test ID' },
                      ].map(v => (
                        <div key={v.k} className="flex items-center justify-between text-[11px] bg-white border border-slate-200 px-3 py-2 rounded-xl">
                            <code className="text-blue-600 font-bold">{v.k}</code>
                            <span className="text-slate-400">{v.d}</span>
                        </div>
                      ))}
                  </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Preview Panel */}
        <div className="space-y-10">
            <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm h-fit">
                <h2 className="text-xl font-bold mb-8 text-slate-900 flex items-center gap-3">
                    <Monitor size={24} className="text-blue-500" />
                    Live View
                </h2>
                <div className="bg-slate-100 rounded-[1.5rem] p-1 relative group overflow-hidden border border-slate-200 shadow-inner">
                    <iframe
                        srcDoc={htmlContent
                            .replace(/{{candidateName}}/g, 'Alex Candidate')
                            .replace(/{{candidateEmail}}/g, 'alex@example.com')
                            .replace(/{{passkey}}/g, 'X79-QZ42')
                            .replace(/{{loginLink}}/g, '#')
                            .replace(/{{interviewTitle}}/g, interview?.title || 'Senior Engineering Assessment')}
                        className="w-full h-[600px] border-0 rounded-[1.25rem] bg-white"
                        title="Email Preview"
                    />
                </div>
            </section>

            <button
              onClick={handleSend}
              disabled={sending || candidates.length === 0}
              className="w-full bg-slate-900 hover:bg-black text-white font-black text-xl rounded-[2.5rem] py-8 flex items-center justify-center gap-4 transition-all shadow-2xl disabled:opacity-30 active:scale-[0.98]"
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin" size={24} /> Executing Broadcast...
                </>
              ) : (
                <>
                  <Send size={24} /> Initialize Broadcast
                </>
              )}
            </button>
            <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Authorized Dispatch Personnel Only</p>
        </div>
      </div>
    </div>
  );
}
