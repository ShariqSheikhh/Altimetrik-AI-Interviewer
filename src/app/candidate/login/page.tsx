'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowRight, Loader2, Mail, Lock } from 'lucide-react';
import Image from 'next/image';
import logoImg from '../../icon.png';

export default function CandidateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [passkey, setPasskey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('email', email)
        .eq('passkey', passkey)
        .single();

      if (error || !data) {
        throw new Error('Invalid email or passkey, or you are not allowed to take the test.');
      }

      if (!data.is_allowed) {
        throw new Error('You are not currently authorized to take this test.');
      }

      // Check if candidate already completed the interview
      const { data: existingResult } = await supabase
        .from('results')
        .select('id')
        .eq('candidate_id', data.id)
        .maybeSingle();

      if (existingResult) {
        throw new Error('You have already completed this interview. You cannot take it again.');
      }

      // Check session validity (24 hours)
      let sessionStartedAt = data.session_started_at;
      if (!sessionStartedAt) {
        // First login, set it
        const { error: updateError } = await supabase
          .from('candidates')
          .update({ session_started_at: new Date().toISOString() })
          .eq('id', data.id);
        
        if (updateError) {
          console.error("Failed to update session_started_at", updateError);
        }
      } else {
        const started = new Date(sessionStartedAt);
        const now = new Date();
        const diffHours = (now.getTime() - started.getTime()) / (1000 * 60 * 60);
        if (diffHours > 24) {
          throw new Error('Your 24-hour window to complete this assessment has expired.');
        }
      }

      // Store in simple localStorage for MVP persistence
      localStorage.setItem('candidate_id', data.id);
      localStorage.setItem('interview_id', data.interview_id);
      
      router.push('/candidate/setup');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-dot-pattern opacity-70 pointer-events-none z-0" />
      
      <div className="w-full max-w-[440px] bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative z-10 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
            <Image src={logoImg} alt="Altimetrik" width={48} height={48} className="rounded-xl" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Candidate Portal</h1>
          <p className="text-slate-500 mt-3 text-sm text-center leading-relaxed">
            Welcome to the Altimetrik assessment. Please enter your credentials to begin.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl mb-8 text-sm text-center font-medium animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                placeholder="you@example.com"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Passkey</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[1.25rem] px-4 py-4.5 flex items-center justify-center gap-3 transition-all mt-4 disabled:opacity-50 shadow-lg shadow-blue-600/20 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : <>Sign In <ArrowRight size={20} /></>}
          </button>
        </form>

        <div className="mt-12 text-center">
            <p className="text-xs text-slate-400 font-medium tracking-wide">
                &copy; {new Date().getFullYear()} Altimetrik AI Interviewer
            </p>
        </div>
      </div>
    </div>
  );
}
