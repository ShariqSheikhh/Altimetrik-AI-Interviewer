'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mic, MicOff, Video, Play, ShieldCheck } from 'lucide-react';

export default function InterviewRoom() {
  const router = useRouter();
  
  const [candidate, setCandidate] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isUploadComplete, setIsUploadComplete] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('interview_done') === 'true'
  );
  const [isListening, setIsListening] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [transcript, setTranscript] = useState<{speaker: 'AI' | 'Candidate', text: string}[]>([]);
  const [savingStatus, setSavingStatus] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null); // always holds the live stream
  
  const questionIndex = useRef(-1);
  const candidateAnswers = useRef<{q: string, a: string}[]>([]);
  const finalizedTextRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentAnswer]);

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    const iid = localStorage.getItem('interview_id');
    if (!cid || !iid) return router.push('/candidate/login');

    // If we just refreshed after evaluation, stop any lingering
    // media the browser may still be holding and show End Test UI
    if (sessionStorage.getItem('interview_done') === 'true') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(ms => ms.getTracks().forEach(t => t.stop()))
        .catch(() => {});
      setIsCompleted(true);
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
        streamRef.current = ms;
        if (videoRef.current) videoRef.current.srcObject = ms;
      } catch (err) {
        console.error("Camera access failed", err);
      }
    };
    init();

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      recognitionRef.current = new SpeechRec();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTrans += event.results[i][0].transcript;
          else interimTrans += event.results[i][0].transcript;
        }
        if (finalTrans) finalizedTextRef.current += ' ' + finalTrans;
        setCurrentAnswer((finalizedTextRef.current + ' ' + interimTrans).trim());
      };
    }

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      try { recognitionRef.current?.stop(); } catch(e){}
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
    try {
      const res = await fetch('/api/interviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_next',
          questionBank: interview.question_bank,
          currentQuestionIndex: questionIndex.current
        })
      });
      
      const data = await res.json();
      
      if (data.isCompleted) {
        setIsCompleted(true);
        setTranscript(prev => [...prev, { speaker: 'AI', text: data.response }]);
        await speak(data.response);
        await handleEndInterview();
        return;
      }

      setTranscript(prev => [...prev, { speaker: 'AI', text: data.response }]);
      await speak(data.response);
      
      // Reset text and start listening purely for the candidate's answer
      setCurrentAnswer('');
      finalizedTextRef.current = '';
      if (recognitionRef.current) {
        try {
          setIsListening(true);
          recognitionRef.current.start();
        } catch (e) {}
      }
    } catch (e) {
      console.error(e);
    }
  };

  const submitAnswer = async () => {
    if (recognitionRef.current) {
      setIsListening(false);
      recognitionRef.current.stop();
    }

    const currentQ = questionIndex.current === -1 ? "Introduction" : interview.question_bank[questionIndex.current];
    const finalAnswer = currentAnswer.trim() || '(No response audible)';
    
    candidateAnswers.current.push({ q: currentQ, a: finalAnswer });
    setTranscript(prev => [...prev, { speaker: 'Candidate', text: finalAnswer }]);
    
    questionIndex.current++;
    await askNextQuestion();
  };

  const startInterviewProcess = async () => {
    setIsStarted(true);
    if (stream) {
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      mediaRecorderRef.current.start();
    }
    await askNextQuestion();
  };

  const handleEndInterview = async () => {
    setSavingStatus('Evaluating answers and saving video...');
    
    // Stop capturing new audio/video data for the recording upload
    try { recognitionRef.current?.stop(); } catch(e){}
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Evaluate via pure JSON Eval endpoint
    let evaluationResult: { score?: number; feedback?: string } = {};
    try {
      setSavingStatus('AI is evaluating your responses...');
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionBank: interview.question_bank,
          previousContext: candidateAnswers.current
        })
      });
      const data = await res.json();
      console.log('[Evaluate] API response:', data);
      if (data.evaluation) {
        evaluationResult = data.evaluation;
      } else {
        console.error('[Evaluate] Missing evaluation field in response:', data);
      }
    } catch (e) {
      console.error('[Evaluate] Fetch failed:', e);
    }

    // Attempt video upload — wait for MediaRecorder to fully flush
    let finalVideoUrl = '';
    if (mediaRecorderRef.current && recordedChunks.current.length > 0) {
      try {
        // Wait for all chunks to be flushed via onstop
        await new Promise<void>(resolve => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            resolve();
          } else {
            mediaRecorderRef.current.onstop = () => resolve();
          }
        });
        setSavingStatus('Uploading session recording...');
        const videoBlob = new Blob(recordedChunks.current, { type: 'video/webm' });
        const fileName = `interview-${interview.id}-candidate-${candidate.id}-${Date.now()}.webm`;
        
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('videos')
          .upload(fileName, videoBlob, { contentType: 'video/webm' });
        
        console.log('[Video Upload] data:', uploadData, '| error:', uploadError);
          
        if (uploadData && !uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);
          finalVideoUrl = publicUrl;
          console.log('[Video Upload] publicUrl:', publicUrl);
        }
      } catch (err) {
        console.error("Upload error", err);
      }
    }

    try {
      await supabase.from('results').insert([{
        candidate_id: candidate.id,
        interview_id: interview.id,
        evaluation: evaluationResult,
        transcript_data: { full_transcript: candidateAnswers.current },
        video_url: finalVideoUrl || null
      }]);
      
      setSavingStatus('Your results are saved securely.');
      sessionStorage.setItem('interview_done', 'true');
      // Stop all media before refreshing so camera light turns off
      streamRef.current?.getTracks().forEach(t => t.stop());
      try { recognitionRef.current?.stop(); } catch(e){}
      window.location.reload();
    } catch (err) {
      setSavingStatus('Server error saving. Please contact admin.');
      sessionStorage.setItem('interview_done', 'true');
      streamRef.current?.getTracks().forEach(t => t.stop());
      window.location.reload();
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-black text-white flex flex-col font-sans">
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          {stream ? <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" /> : <Video size={16} />}
          <span className="font-semibold">{interview?.title || 'Loading Interview...'}</span>
        </div>
        <div className="text-sm font-medium text-slate-400">
          Candidate: <span className="text-white">{candidate?.name || '...'}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 relative overflow-hidden">
        <div className="flex-1 rounded-3xl overflow-hidden bg-white/5 border border-white/10 relative shadow-2xl flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          
          {!isStarted && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <button 
                onClick={startInterviewProcess}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-transform hover:scale-105"
              >
                <Play fill="currentColor" size={20} />
                Start Interview
              </button>
            </div>
          )}

          {isCompleted && (
            <div className="absolute inset-0 bg-indigo-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center z-[100]">
              <ShieldCheck size={48} className="text-white mb-4 animate-bounce" />
              <h2 className="text-3xl font-bold mb-4 text-white">
                {isUploadComplete ? 'Interview Evaluated & Saved!' : 'Saving Session...'}
              </h2>
              <p className={`text-indigo-200 text-lg mb-8 ${!isUploadComplete ? 'animate-pulse' : ''}`}>
                {savingStatus}
              </p>
              
              {isUploadComplete && (
                <button
                  onClick={() => {
                    sessionStorage.removeItem('interview_done');
                    streamRef.current?.getTracks().forEach(t => t.stop());
                    try { recognitionRef.current?.stop(); } catch(e){}
                    router.push('/');
                  }}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-10 py-4 rounded-full transition-transform hover:scale-105 shadow-[0_0_30px_-5px_var(--color-red-600)]"
                >
                  End Test & Leave Protocol
                </button>
              )}
            </div>
          )}

          {isListening && !isCompleted && (
            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center bg-black/60 backdrop-blur-md px-6 py-4 rounded-full border border-white/10">
              <div className="flex items-center gap-3 text-sm font-semibold text-white">
                <Mic size={20} className="text-green-400 animate-pulse" /> Listening to your answer...
              </div>
              <button 
                onClick={submitAnswer}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-transform hover:scale-105"
              >
                <MicOff size={18} /> Submit Answer
              </button>
            </div>
          )}
        </div>

        <div className="w-full md:w-96 flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden shrink-0 h-full">
          <div className="p-4 border-b border-white/10 bg-black/50">
            <h3 className="font-semibold flex items-center gap-2">Live Transcript</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transcript.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.speaker === 'Candidate' ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 px-1">{msg.speaker}</span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                  msg.speaker === 'Candidate' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white/10 text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isListening && currentAnswer && (
              <div className="flex flex-col items-end opacity-70">
                <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 px-1">Candidate (speaking...)</span>
                <div className="px-4 py-2 rounded-2xl max-w-[85%] text-sm bg-blue-600/50 text-white rounded-tr-sm italic">
                  {currentAnswer}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
