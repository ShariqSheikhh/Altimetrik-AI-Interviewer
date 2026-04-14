'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, Loader2, Mail, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import logoImg from '../../icon.png';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // If the admin is already logged in, redirect to dashboard immediately
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace('/admin/dashboard');
      } else {
        setCheckingSession(false);
      }
    };
    checkExistingSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Supabase Auth — only verified admin accounts can log in
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please contact your administrator.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking for an existing session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-dot-pattern opacity-70 pointer-events-none z-0" />

      <div className="w-full max-w-[440px] bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative z-10 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
             <Image src={logoImg} alt="Altimetrik" width={48} height={48} className="rounded-xl" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Console</h1>
          <p className="text-slate-500 mt-3 text-sm text-center leading-relaxed">
            Authorized personnel only. Access the interview management system.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl mb-8 text-sm text-center font-medium animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                placeholder="admin@example.com"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-black text-white font-bold rounded-[1.25rem] px-4 py-4.5 flex items-center justify-center gap-3 transition-all mt-4 disabled:opacity-50 shadow-lg active:scale-[0.98]"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : <><ShieldCheck size={20} /> Authorize Access</>}
          </button>
        </form>

        <div className="mt-12 text-center">
            <p className="text-xs text-slate-400 font-medium tracking-wide">
                &copy; {new Date().getFullYear()} Altimetrik Protected System
            </p>
        </div>
      </div>
    </div>
  );
}
