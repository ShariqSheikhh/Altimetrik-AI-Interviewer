'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mic, MicOff, Video, Save, Loader2, Square, Play, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function InterviewRoom() {
  const router = useRouter();
  
  // State
  const [candidate, setCandidate] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [transcript, setTranscript] = useState<{speaker: 'AI' | 'Candidate', text: string}[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const finalizedTextRef = useRef('');
  const [savingStatus, setSavingStatus] = useState<string>('');
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const questionIndex = useRef(-1);
  const candidateAnswers = useRef<{q: string, a: string}[]>([]);

  useEffect(() => {
    // Basic setup
    const cid = localStorage.getItem('candidate_id');
    const iid = localStorage.getItem('interview_id');
    if (!cid || !iid) {
      router.push('/candidate/login');
      return;
    }

    const init = async () => {
      const [cRes, iRes] = await Promise.all([
        supabase.from('candidates').select('*').eq('id', cid).single(),
        supabase.from('interviews').select('*').eq('id', iid).single()
      ]);
      setCandidate(cRes.data);
      setInterview(iRes.data);

      try {
        const ms = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(ms);
        localStreamRef.current = ms;
        if (videoRef.current) videoRef.current.srcObject = ms;
      } catch (err) {
        console.error("Camera access failed", err);
      }
    };
    init();

    // Setup speech recognition
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      recognitionRef.current = new SpeechRec();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interimTrans += event.results[i][0].transcript;
          }
        }
        if (finalTrans) finalizedTextRef.current += ' ' + finalTrans;
        setCurrentAnswer((finalizedTextRef.current + ' ' + interimTrans).trim());
      };

      recognitionRef.current.onend = () => {
        if (isListeningRef.current) {
          try { recognitionRef.current.start(); } catch(e){}
        }
      };
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e){}
      }
    };
  }, []);

  const speak = (text: string) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  };

  const askNextQuestion = async () => {
    if (!interview || !interview.question_bank) return;
    
    try {
      const res = await fetch('/api/interviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_next',
          questionBank: interview.question_bank,
          currentQuestionIndex: questionIndex.current,
          previousContext: candidateAnswers.current
        })
      });
      
      const data = await res.json();
      
      if (data.isCompleted) {
        setIsCompleted(true);
        if (data.response) {
          setTranscript(prev => [...prev, { speaker: 'AI', text: data.response }]);
          await speak(data.response);
        }
        await handleEndInterview();
        return;
      }

      setTranscript(prev => [...prev, { speaker: 'AI', text: data.response }]);
      await speak(data.response);
      
      // Start listening to candidate
      setCurrentAnswer('');
      finalizedTextRef.current = '';
      if (recognitionRef.current) {
        try {
          isListeningRef.current = true;
          setIsListening(true);
          recognitionRef.current.start();
        } catch (e) {} // ignore if already started
      }
      
    } catch (e) {
      console.error(e);
    }
  };

  const submitAnswer = async () => {
    if (recognitionRef.current && isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current.stop();
    }

    if (!currentAnswer.trim()) {
      setTranscript(prev => [...prev, { speaker: 'AI', text: "I didn't quite catch that. Could you please answer?" }]);
      await speak("I didn't quite catch that. Could you please answer?");
      setCurrentAnswer('');
      finalizedTextRef.current = '';
      if (recognitionRef.current) {
        try { 
          isListeningRef.current = true;
          setIsListening(true);
          recognitionRef.current.start(); 
        } catch (e) {}
      }
      return;
    }

    const currentQ = questionIndex.current === -1 ? "Introduction" : interview.question_bank[questionIndex.current];
    candidateAnswers.current.push({ q: currentQ, a: currentAnswer });
    
    setTranscript(prev => [...prev, { speaker: 'Candidate', text: currentAnswer }]);
    questionIndex.current++;
    
    await askNextQuestion();
  };

  const startInterviewProcess = async () => {
    setIsStarted(true);
    
    // Start Recording video
    if (stream) {
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }

    await askNextQuestion();
  };

  const handleEndInterview = async () => {
    setSavingStatus('Evaluating answers and saving results...');
    
    // Explicitly shut off all media immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (recognitionRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      try { recognitionRef.current.stop(); } catch(e){}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    
    // 1. Evaluate via API
    let evaluationResult = {};
    try {
      const res = await fetch('/api/interviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          questionBank: interview.question_bank,
          previousContext: candidateAnswers.current
        })
      });
      const data = await res.json();
      evaluationResult = data.evaluation;
    } catch (e) {
      console.error('Eval error', e);
    }

    // 2. Upload Video to Supabase Storage
    let finalVideoUrl = 'mock_video_playback_feature_coming_soon.mp4';
    
    if (recordedChunks.current.length > 0) {
      try {
        const videoBlob = new Blob(recordedChunks.current, { type: 'video/webm' });
        const fileName = `interview-${interview.id}-candidate-${candidate.id}-${Date.now()}.webm`;
        
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('videos')
          .upload(fileName, videoBlob, { contentType: 'video/webm' });
          
        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);
          finalVideoUrl = publicUrl;
        } else {
          console.error("Video upload failed:", uploadError);
        }
      } catch (err) {
        console.error("Video processing error:", err);
      }
    }

    try {
      await supabase.from('results').insert([{
        candidate_id: candidate.id,
        interview_id: interview.id,
        evaluation: evaluationResult,
        transcript_data: { full_transcript: candidateAnswers.current },
        video_url: finalVideoUrl
      }]);
      
      setSavingStatus('Completed successfully! You can close this window.');
      setTimeout(() => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        router.push('/');
      }, 3000);
    } catch (err) {
      setSavingStatus('Error saving results. Please contact support.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-white/5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-red-500/20 p-2 rounded-xl">
            {isRecording ? <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" /> : <Video size={16} className="text-slate-400" />}
          </div>
          <span className="font-semibold">{interview?.title || 'Loading Interview...'}</span>
        </div>
        <div className="text-sm font-medium text-slate-400">
          Candidate: <span className="text-white">{candidate?.name || '...'}</span>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 relative overflow-hidden">
        
        {/* Left Side: Video Preview */}
        <div className="flex-1 rounded-3xl overflow-hidden bg-white/5 border border-white/10 relative shadow-2xl flex items-center justify-center">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          
          {/* Overlay UI when not started */}
          {!isStarted && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <button 
                onClick={startInterviewProcess}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-all shadow-[0_0_30px_-5px_var(--color-indigo-600)]"
              >
                <Play fill="currentColor" size={20} />
                Start Interview
              </button>
            </div>
          )}

          {/* End screen UI */}
          {isCompleted && (
            <div className="absolute inset-0 bg-indigo-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center z-[100] transition-all duration-500">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-4 border-indigo-400 border-t-indigo-100 rounded-full animate-spin" />
                <div className="absolute inset-2 bg-indigo-500/20 rounded-full flex items-center justify-center">
                   <ShieldCheck size={32} className="text-white animate-pulse" />
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-4 text-white">Evaluating Interview...</h2>
              <p className="text-indigo-200 text-lg max-w-md animate-pulse">
                {savingStatus || 'Our AI is analyzing your responses against the standard curriculum. Please bear with us...'}
              </p>
            </div>
          )}

          {/* Status indicators */}
          {isListening && (
            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center pointer-events-none">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-sm font-medium">
                <Mic size={16} className="text-green-400" />
                Listening...
              </div>
              <button 
                onClick={submitAnswer}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-6 py-2 rounded-full text-sm font-bold pointer-events-auto flex items-center gap-2 transition-colors"
                title="Click when you are finished speaking"
              >
                <MicOff size={16} /> Close Mic & Continue
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Transcript */}
        <div className="w-full md:w-96 flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden shrink-0 h-full">
          <div className="p-4 border-b border-white/10 bg-black/50">
            <h3 className="font-semibold flex items-center gap-2">Live Transcript</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transcript.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.speaker === 'Candidate' ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 px-1">{msg.speaker}</span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                  msg.speaker === 'Candidate' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-white/10 text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {/* Realtime Candidate Input Preview */}
            {isListening && currentAnswer && (
              <div className="flex flex-col items-end opacity-70">
                <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 px-1 flex items-center gap-1">
                  Candidate (speaking...) <Mic size={10} className="text-green-400 animate-pulse" />
                </span>
                <div className="px-4 py-2 rounded-2xl max-w-[85%] text-sm leading-relaxed bg-indigo-600/50 text-white rounded-tr-sm italic">
                  {currentAnswer}
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
