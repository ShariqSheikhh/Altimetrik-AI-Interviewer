'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Camera, Mic, Loader2, CheckCircle2, AlertCircle, ArrowRight, Expand, Mail, User, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import logoImg from '../../icon.png';

export default function CandidateSetup() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  
  // System check states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [sysCheckStatus, setSysCheckStatus] = useState<'idle' | 'checking' | 'passed' | 'failed'>('idle');
  const [setupError, setSetupError] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const candidateId = localStorage.getItem('candidate_id');
    const interviewId = localStorage.getItem('interview_id');

    if (!candidateId || !interviewId) {
      router.push('/candidate/login');
      return;
    }

    const fetchData = async () => {
      try {
        const { data: existingResult } = await supabase
          .from('results')
          .select('id')
          .eq('candidate_id', candidateId)
          .maybeSingle();

        if (existingResult) {
          localStorage.removeItem('candidate_id');
          localStorage.removeItem('interview_id');
          router.push('/candidate/login');
          return;
        }

        const [candidateRes, interviewRes] = await Promise.all([
          supabase.from('candidates').select('*').eq('id', candidateId).single(),
          supabase.from('interviews').select('*').eq('id', interviewId).single()
        ]);

        if (candidateRes.data) {
          setCandidate(candidateRes.data);
          setName(candidateRes.data.name || '');
        }
        if (interviewRes.data) {
          setInterview(interviewRes.data);
        }
      } catch (err) {
        setSetupError('Failed to load interview details.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
        stream?.getTracks().forEach(t => t.stop());
    };
  }, [router]);

  const runSystemCheck = async () => {
    setSysCheckStatus('checking');
    setSetupError('');
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Audio analyzing logic
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      source.connect(analyzerRef.current);

      const bufferLength = analyzerRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!analyzerRef.current) return;
        analyzerRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicLevel(average);
        requestAnimationFrame(checkAudioLevel);
      };
      
      checkAudioLevel();
      setTimeout(() => setSysCheckStatus('passed'), 2000);
      
    } catch (err: any) {
      setSetupError('Failed to access Camera or Microphone. Please allow permissions.');
      setSysCheckStatus('failed');
    }
  };

  const handleStartInterview = async () => {
    if (!name.trim()) {
      setSetupError('Please enter your full name.');
      return;
    }
    
    // Save candidate name
    if (name !== candidate?.name) {
      await supabase
        .from('candidates')
        .update({ name })
        .eq('id', candidate.id);
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Full screen request failed:', err);
    }
    
    router.push('/candidate/interview');
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-800 p-6 md:p-12 font-sans relative">
      <div className="absolute inset-0 bg-dot-pattern opacity-70 pointer-events-none z-0" />
      
      <div className="max-w-5xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm">
                    <Image src={logoImg} alt="Altimetrik" width={32} height={32} className="rounded-lg" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Check</h1>
                    <p className="text-slate-500 text-sm font-medium">Ready for your assessment, {candidate?.name || 'Candidate'}?</p>
                </div>
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Details Section */}
          <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)]">
                <h2 className="text-xl font-bold mb-8 flex items-center gap-3 text-slate-900 border-b border-slate-50 pb-4">
                <User size={22} className="text-blue-500" /> 
                Confirmation
                </h2>
                
                <div className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                    <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-semibold focus:outline-none focus:border-blue-500 transition-all outline-none"
                    placeholder="Enter your full name"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Email</label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-400 font-medium flex items-center gap-3">
                        <Mail size={18} />
                        {candidate?.email}
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2">Test Role</label>
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-center justify-between">
                        <span className="text-blue-700 font-bold">{interview?.title || 'General Assessment'}</span>
                        <div className="px-3 py-1 bg-white rounded-lg text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                            {interview?.question_bank?.length || 0} Questions
                        </div>
                    </div>
                </div>
                </div>
            </div>

            <div className="bg-blue-600 rounded-[2rem] p-8 text-white relative overflow-hidden group shadow-xl">
                 <div className="relative z-10">
                    <p className="text-blue-100 font-bold text-xs uppercase tracking-[0.2em] mb-2">Notice</p>
                    <h3 className="text-xl font-black mb-4 tracking-tight">Assessment Integrity</h3>
                    <p className="text-blue-50 text-sm leading-relaxed opacity-90">
                        This session will be recorded. Please ensure you are alone in a quiet room. Your browser must remain in full-screen mode throughout.
                    </p>
                 </div>
                 <div className="absolute -bottom-8 -right-8 opacity-10 group-hover:scale-110 transition-transform">
                      <ShieldCheck size={160} />
                 </div>
            </div>
          </div>

          {/* System Check Section */}
          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)] flex flex-col animate-in slide-in-from-right-4 duration-500">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-3 text-slate-900 border-b border-slate-50 pb-4">
              <Camera size={22} className="text-blue-500" /> 
              Device Setup
            </h2>

            <div className="flex-1 flex flex-col">
              {sysCheckStatus === 'idle' ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-6">
                    <Camera size={32} className="text-slate-400" />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2">Hardware Check</h3>
                  <p className="text-slate-500 mb-8 text-sm leading-relaxed">We need to verify your camera and microphone are working correctly.</p>
                  <button 
                    onClick={runSystemCheck}
                    className="bg-white hover:bg-slate-50 border border-slate-200 px-8 py-3 rounded-xl text-sm font-bold text-slate-800 transition-all shadow-sm active:scale-95"
                  >
                    Allow Permissions
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative aspect-video bg-slate-100 rounded-[2rem] overflow-hidden border border-slate-200 shadow-inner">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {sysCheckStatus === 'checking' && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="animate-spin text-blue-600" size={32} />
                      </div>
                    )}
                    {sysCheckStatus === 'passed' && (
                        <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            Live Feed
                        </div>
                    )}
                  </div>
                  
                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <Mic size={16} className={sysCheckStatus === 'passed' ? 'text-emerald-500' : 'text-slate-400'} />
                            Microphone Active
                        </div>
                        {sysCheckStatus === 'passed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                    </div>
                    <div className="h-2.5 bg-white rounded-full overflow-hidden shadow-inner border border-slate-100 p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-75 ${micLevel > 10 ? 'bg-blue-500' : 'bg-slate-200'}`}
                        style={{ width: `${Math.min(100, (micLevel / 128) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3 text-center">Speak to test your input levels</p>
                  </div>

                  {setupError && (
                    <div className="flex items-start gap-4 text-red-600 text-sm bg-red-50 border border-red-100 p-5 rounded-2xl animate-in shake duration-300">
                      <AlertCircle size={20} className="shrink-0" />
                      <p className="font-semibold leading-relaxed">{setupError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={handleStartInterview}
              disabled={sysCheckStatus !== 'passed'}
              className="mt-10 w-full bg-slate-900 hover:bg-black text-white font-bold rounded-2xl px-4 py-5 flex items-center justify-center gap-3 transition-all shadow-xl disabled:opacity-30 active:scale-[0.98]"
            >
              Start Full Interview <ArrowRight size={20} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
