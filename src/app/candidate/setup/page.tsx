'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Camera, Mic, Loader2, CheckCircle2, AlertCircle, ArrowRight, Expand } from 'lucide-react';

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
    return <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center text-white"><Loader2 className="animate-spin" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-12 selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Interview Setup</h1>
        <p className="text-slate-400 mb-8">Please confirm your details and check your system before starting.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Details Section */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-400 p-1.5 rounded-lg"><CheckCircle2 size={18} /></span> 
              Your Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                <div className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-slate-300">
                  {candidate?.email}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 mt-4">
                <label className="block text-sm font-medium text-slate-400 mb-2">Interview Role / Title</label>
                <div className="w-full bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-indigo-200 font-medium">
                  {interview?.title || 'Unknown Interview'}
                </div>
                <p className="text-xs text-slate-500 mt-2">Questions: {interview?.question_bank?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* System Check Section */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md flex flex-col">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-400 p-1.5 rounded-lg"><CheckCircle2 size={18} /></span> 
              System Check
            </h2>

            <div className="flex-1 flex flex-col">
              {sysCheckStatus === 'idle' ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-black/30 rounded-2xl border border-white/5">
                  <Camera size={48} className="text-slate-500 mb-4" />
                  <p className="text-slate-300 mb-4 text-sm">We need to check your camera and microphone.</p>
                  <button 
                    onClick={runSystemCheck}
                    className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-full text-sm font-medium transition-colors"
                  >
                    Start System Check
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {sysCheckStatus === 'checking' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="animate-spin text-white" size={32} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10">
                    <Mic className={sysCheckStatus === 'passed' ? 'text-green-400' : 'text-slate-400'} size={20} />
                    <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all duration-75"
                        style={{ width: `${Math.min(100, (micLevel / 128) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {setupError && (
                    <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-xl">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <p>{setupError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={handleStartInterview}
              disabled={sysCheckStatus !== 'passed'}
              className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-4 py-4 flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_-5px_var(--color-indigo-600)] disabled:opacity-50 disabled:shadow-none"
            >
              Start Full Screen Interview <Expand size={18} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
