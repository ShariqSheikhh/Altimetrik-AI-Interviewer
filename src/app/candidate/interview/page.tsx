'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mic, MicOff, Video, Play, ShieldCheck, BookOpen, CheckCircle2, ArrowRight, Mail, AlertTriangle } from 'lucide-react';

export default function InterviewRoom() {
  const router = useRouter();

  const [candidate, setCandidate] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [isStarted, setIsStarted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [isUploadComplete, setIsUploadComplete] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('interview_done') === 'true'
  );
  const [isListening, setIsListening] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [transcript, setTranscript] = useState<{ speaker: 'AI' | 'Candidate', text: string }[]>([]);
  const transcriptRef = useRef<{ speaker: 'AI' | 'Candidate', text: string }[]>([]);
  const [savingStatus, setSavingStatus] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const questionIndex = useRef(-1);
  const candidateAnswers = useRef<{ q: string, a: string, followUp?: string, followUpAnswer?: string }[]>([]);
  const finalizedTextRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // ── Evaluator 1 tracking ──────────────────────────────────────────
  const coveragePerQuestion = useRef<{ questionIndex: number, coverage: number }[]>([]);
  const questionsWithFollowUps = useRef<number>(0);
  const isAwaitingFollowUp = useRef(false);
  const lastQuestionText = useRef('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentAnswer]);

  // Fetch support email from server-side API
  useEffect(() => {
    fetch('/api/support-email')
      .then(r => r.json())
      .then(d => { if (d.email) setSupportEmail(d.email); })
      .catch(() => { });
  }, []);

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    const iid = localStorage.getItem('interview_id');
    if (!cid || !iid) return router.push('/candidate/login');

    if (sessionStorage.getItem('interview_done') === 'true') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(ms => ms.getTracks().forEach(t => t.stop()))
        .catch(() => { });
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

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      selectedVoiceRef.current =
        voices.find(v => v.name.includes('Microsoft Ava Online')) ||
        voices.find(v => v.name.includes('Google UK English Male')) ||
        voices.find(v => v.name.includes('Google UK English Female')) ||
        voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.name.includes('Microsoft Neerja Online')) ||
        voices.find(v => v.name.includes('Microsoft Andrew Online')) ||
        voices.find(v => v.name.includes('Microsoft Emma Online')) ||
        voices.find(v => v.name.includes('Natural')) ||
        voices.find(v => v.name.includes('Microsoft Zira')) ||
        voices.find(v => v.name.includes('Microsoft David')) ||
        voices.find(v => v.lang === 'en-US' && /female|zira|samantha/i.test(v.name)) ||
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang === 'en-US') ||
        voices[0] ||
        null;
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      try { recognitionRef.current?.stop(); } catch (e) { }
      try { window.speechSynthesis.cancel(); } catch (e) { }
    };
  }, []);

  const splitIntoChunks = (text: string): string[] => {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .match(/[^.!?]+[.!?]*|.+$/g) || [];
  };

  const preprocessText = (text: string): string => {
    return text
      .replace(/\s+/g, ' ')
      .replace(/:\s*/g, ', ')
      .replace(/;\s*/g, ', ')
      .replace(/\(\s*/g, ', ')
      .replace(/\s*\)/g, ', ')
      .trim();
  };

  const getSentenceStyle = (sentence: string, index: number, total: number) => {
    let rate = 0.98;
    let pitch = 1.02;
    const s = sentence.trim();
    if (s.endsWith('?')) { rate = 1.0; pitch = 1.08; }
    else if (s.endsWith('!')) { rate = 1.03; pitch = 1.1; }
    else if (s.length > 120) { rate = 0.95; pitch = 1.0; }
    if (index === total - 1) { rate -= 0.01; }
    return { rate, pitch };
  };

  const speakChunk = (sentence: string, index: number, total: number) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      const style = getSentenceStyle(sentence, index, total);
      utterance.voice = selectedVoiceRef.current;
      utterance.rate = style.rate;
      utterance.pitch = style.pitch;
      utterance.volume = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  };

  const speak = async (text: string) => {
    window.speechSynthesis.cancel();
    if (!selectedVoiceRef.current) {
      const voices = window.speechSynthesis.getVoices();
      selectedVoiceRef.current =
        voices.find(v => v.name.includes('Microsoft Ava Online')) ||
        voices.find(v => v.name.includes('Google UK English Male')) ||
        voices.find(v => v.name.includes('Google UK English Female')) ||
        voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.name.includes('Microsoft Neerja Online')) ||
        voices.find(v => v.name.includes('Microsoft Andrew Online')) ||
        voices.find(v => v.name.includes('Microsoft Emma Online')) ||
        voices.find(v => v.name.includes('Natural')) ||
        voices.find(v => v.name.includes('Microsoft Zira')) ||
        voices.find(v => v.name.includes('Microsoft David')) ||
        voices.find(v => v.lang === 'en-US' && /female|zira|samantha/i.test(v.name)) ||
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang === 'en-US') ||
        voices[0] ||
        null;
    }
    const processed = preprocessText(text);
    if (!processed) return;
    const chunks = splitIntoChunks(processed);
    for (let i = 0; i < chunks.length; i++) {
      await speakChunk(chunks[i].trim(), i, chunks.length);
    }
  };

  // ── Client-side output sanitization ──────────────────────────────
  const sanitizeAIOutput = (text: string): string => {
    return text
      .replace(/\[INTERVIEW_ENDED\]/g, '')
      .replace(/^AI:\s*/i, '')
      .replace(/System\s*Instructions?:[\s\S]{0,200}/gi, '')
      .replace(/\[Interview\s*Questions[\s\S]{0,50}\]/gi, '')
      .trim();
  };

  // ── Get key points for a question (from question bank) ───────────
  const getKeyPointsForQuestion = (qIndex: number): string[] => {
    if (!interview?.question_bank || qIndex < 0 || qIndex >= interview.question_bank.length) {
      return [];
    }
    const q = interview.question_bank[qIndex];
    return Array.isArray(q.key_points) ? q.key_points : [];
  };

  // ── Call Evaluator 1 (live coverage check) ───────────────────────
  const callLiveEvaluator = async (
    question: string,
    answer: string,
    keyPoints: string[],
    followUpAnswer?: string
  ) => {
    try {
      const res = await fetch('/api/live-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          candidateAnswer: answer,
          keyPoints,
          ...(followUpAnswer ? { followUpAnswer } : {}),
        }),
      });
      return await res.json();
    } catch (e) {
      console.error('[LiveEvaluate] Error:', e);
      return { decision: 'move_next', covered_points: [], missed_points: keyPoints, coverage_percentage: 0 };
    }
  };

  // ── Ask the Interviewer for next response ────────────────────────
  const askInterviewer = async (currentTranscript: any[], followUpInstruction?: string) => {
    try {
      const res = await fetch('/api/interviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_next',
          questionBank: interview.question_bank,
          transcript: currentTranscript,
          ...(followUpInstruction ? { followUpInstruction } : {}),
        }),
      });
      return await res.json();
    } catch (e) {
      console.error('[Interviewer] Error:', e);
      return { response: 'I apologize, there was an issue. Let me continue.', isCompleted: false };
    }
  };

  // ── Main flow: Ask the next question ─────────────────────────────
  const askNextQuestion = async (currentTranscript = transcriptRef.current) => {
    const data = await askInterviewer(currentTranscript);

    if (data.isCompleted) {
      setIsCompleted(true);
      const cleanedResponse = sanitizeAIOutput(data.response);
      const finalMsg = { speaker: 'AI' as 'AI', text: cleanedResponse };
      transcriptRef.current.push(finalMsg);
      setTranscript([...transcriptRef.current]);
      await speak(cleanedResponse);
      await handleEndInterview();
      return;
    }

    const cleanedResponse = sanitizeAIOutput(data.response);
    const aiMsg = { speaker: 'AI' as 'AI', text: cleanedResponse };
    transcriptRef.current.push(aiMsg);
    setTranscript([...transcriptRef.current]);

    // Track the question
    lastQuestionText.current = cleanedResponse;
    isAwaitingFollowUp.current = false;
    candidateAnswers.current.push({ q: cleanedResponse, a: '' });

    // Track question index from the interviewer
    if (data.currentQuestionIndex !== null && data.currentQuestionIndex !== undefined) {
      questionIndex.current = data.currentQuestionIndex - 1; // Convert 1-based to 0-based
    }

    await speak(cleanedResponse);
    startListening();
  };

  // ── Ask a follow-up (Evaluator 1 decided) ────────────────────────
  const askFollowUp = async (followUpQuestion: string, currentTranscript: any[]) => {
    const data = await askInterviewer(currentTranscript, followUpQuestion);

    const cleanedResponse = sanitizeAIOutput(data.response);
    const aiMsg = { speaker: 'AI' as 'AI', text: cleanedResponse };
    transcriptRef.current.push(aiMsg);
    setTranscript([...transcriptRef.current]);

    isAwaitingFollowUp.current = true;
    lastQuestionText.current = cleanedResponse;
    questionsWithFollowUps.current += 1;

    await speak(cleanedResponse);
    startListening();
  };

  const startListening = () => {
    setCurrentAnswer('');
    finalizedTextRef.current = '';
    if (recognitionRef.current) {
      try {
        setIsListening(true);
        recognitionRef.current.start();
      } catch (e) { }
    }
  };

  // ── Submit answer → Evaluator 1 decides next step ────────────────
  const submitAnswer = async () => {
    if (recognitionRef.current) {
      setIsListening(false);
      recognitionRef.current.stop();
    }

    const finalAnswer = currentAnswer.trim() || '(No response audible)';

    // Add to transcript
    const candidateMsg = { speaker: 'Candidate' as 'Candidate', text: finalAnswer };
    transcriptRef.current.push(candidateMsg);
    setTranscript([...transcriptRef.current]);

    // Fill the answer for the last question the AI asked
    if (candidateAnswers.current.length > 0) {
      const lastEntry = candidateAnswers.current[candidateAnswers.current.length - 1];
      if (isAwaitingFollowUp.current) {
        lastEntry.followUpAnswer = finalAnswer;
      } else {
        lastEntry.a = finalAnswer;
      }
    }

    // ── Evaluator 1: Check key point coverage ─────────────────────
    const keyPoints = getKeyPointsForQuestion(questionIndex.current);

    if (keyPoints.length > 0 && questionIndex.current >= 0) {
      // There are key points to check
      const lastEntry = candidateAnswers.current[candidateAnswers.current.length - 1];
      const originalQuestion = interview.question_bank[questionIndex.current]?.question || lastEntry.q;

      const liveResult = await callLiveEvaluator(
        originalQuestion,
        lastEntry.a,
        keyPoints,
        isAwaitingFollowUp.current ? finalAnswer : undefined
      );

      console.log('[Evaluator 1] Decision:', liveResult.decision, 'Coverage:', liveResult.coverage_percentage);

      // Track coverage
      coveragePerQuestion.current.push({
        questionIndex: questionIndex.current,
        coverage: liveResult.coverage_percentage || 0,
      });

      if (liveResult.decision === 'follow_up' && !isAwaitingFollowUp.current && liveResult.follow_up_question) {
        // Evaluator 1 says: ask a follow-up
        if (lastEntry) lastEntry.followUp = liveResult.follow_up_question;
        await askFollowUp(liveResult.follow_up_question, transcriptRef.current);
        return;
      }

      // decision is 'move_next' or 'skip' or it was already a follow-up → proceed
    }

    // No key points to check, or Evaluator 1 said move on → ask next question
    isAwaitingFollowUp.current = false;
    await askNextQuestion(transcriptRef.current);
  };

  const handleShowInstructions = () => {
    setShowInstructions(true);
  };

  const startInterviewProcess = async () => {
    setShowInstructions(false);
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

    try { recognitionRef.current?.stop(); } catch (e) { }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // ── Prepare Evaluator 1 metrics for Evaluator 2 ─────────────
    const totalQuestions = interview?.question_bank?.length || 1;
    const coverages = coveragePerQuestion.current;
    const avgCoverage = coverages.length > 0
      ? coverages.reduce((sum, c) => sum + c.coverage, 0) / coverages.length
      : 0;

    const coverageData = {
      average_coverage: avgCoverage,
      per_question: coverages,
    };

    const followUpData = {
      questions_with_follow_ups: questionsWithFollowUps.current,
      total_questions: totalQuestions,
    };

    // ── Call Evaluator 2 (post-interview) ─────────────────────────
    let evaluationResult: any = {};
    try {
      setSavingStatus('AI is evaluating your responses...');
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionBank: interview.question_bank,
          previousContext: transcriptRef.current,
          coverageData,
          followUpData,
        })
      });
      const data = await res.json();
      console.log('[Evaluator 2] API response:', data);
      if (data.evaluation) {
        evaluationResult = data.evaluation;
      } else {
        console.error('[Evaluator 2] Missing evaluation field:', data);
      }
    } catch (e) {
      console.error('[Evaluator 2] Fetch failed:', e);
    }

    // Attempt video upload
    let finalVideoUrl = '';
    if (mediaRecorderRef.current && recordedChunks.current.length > 0) {
      try {
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

        if (uploadData && !uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);
          finalVideoUrl = publicUrl;
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
        transcript_data: { full_transcript: candidateAnswers.current.filter((item) => item.a !== '') },
        video_url: finalVideoUrl || null
      }]);

      setSavingStatus('Your results are saved securely.');
      sessionStorage.setItem('interview_done', 'true');
      streamRef.current?.getTracks().forEach(t => t.stop());
      try { recognitionRef.current?.stop(); } catch (e) { }
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

        <div className="flex items-center gap-6">
          <div className="hidden sm:block text-sm font-medium text-slate-400">
            Candidate: <span className="text-white">{candidate?.name || '...'}</span>
          </div>

          {supportEmail && (
            <a
              href={`mailto:${supportEmail}`}
              title="Contact Support"
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-semibold text-blue-400 transition-all hover:scale-105"
            >
              <Mail size={14} />
              <span className="hidden xs:inline">Support</span>
            </a>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 relative overflow-hidden">
        <div className="flex-1 rounded-3xl overflow-hidden bg-white/5 border border-white/10 relative shadow-2xl flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

          {!isStarted && !showInstructions && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <button
                onClick={handleShowInstructions}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-transform hover:scale-105"
              >
                <Play fill="currentColor" size={20} />
                Start Interview
              </button>
            </div>
          )}

          {showInstructions && !isStarted && (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 z-[100] flex items-center justify-center overflow-y-auto p-6">
              <div className="max-w-2xl w-full space-y-6">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-2">
                    <BookOpen size={32} className="text-blue-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white">Interview Instructions</h2>
                  <p className="text-slate-400 text-sm">Please read the following instructions carefully before beginning your interview.</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-slate-200 text-sm leading-relaxed">
                      <span className="font-semibold text-white">Camera & Microphone:</span> Your camera and microphone will remain active throughout the entire interview for recording purposes.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-slate-200 text-sm leading-relaxed">
                      <span className="font-semibold text-white">Listen First:</span> The AI interviewer will ask you questions one at a time. Please <span className="text-blue-400 font-semibold">wait for the AI to finish speaking</span> completely before you begin your response.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-slate-200 text-sm leading-relaxed">
                      <span className="font-semibold text-white">Answering:</span> Once the AI has finished speaking, you will see a <span className="text-green-400 font-semibold">"Listening..."</span> indicator. Speak clearly into your microphone to answer. Your speech will be transcribed in real-time.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-slate-200 text-sm leading-relaxed">
                      <span className="font-semibold text-white">Clarification:</span> You can ask to repeat the question or request clarification if you don't understand it. You can also say that you don't know the answer if you're unsure.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-slate-200 text-sm leading-relaxed">
                      <span className="font-semibold text-white">Submitting Your Answer:</span> When you have finished answering, click the <span className="text-red-400 font-semibold">"Submit Answer"</span> button. The AI will then proceed to the next question. Do <span className="font-bold">not</span> click submit while you are still speaking.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-slate-200 text-sm leading-relaxed">
                      <span className="font-semibold text-white">Interview Flow:</span> The AI will first check if you are ready, then ask for a brief introduction, and finally proceed to the interview questions one by one.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-slate-200 text-sm leading-relaxed">
                      <span className="font-semibold text-white">Automatic Completion:</span> The interview will automatically end when all questions have been covered. Your video, transcript, and evaluation will be securely saved.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-slate-200 text-sm leading-relaxed">
                      <span className="font-semibold text-amber-300">Important:</span> Do <span className="font-bold">not</span> refresh, close, or navigate away from this page during the interview. Doing so will result in loss of your progress.
                    </p>
                  </div>

                  {supportEmail && (
                    <div className="flex items-start gap-3 pt-2 border-t border-white/10">
                      <Mail size={20} className="text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-slate-200 text-sm leading-relaxed">
                        <span className="font-semibold text-white">Technical Issues:</span> If you experience any <span className="italic">technical difficulties</span> during the interview (e.g., microphone not working, page freezing), please email{' '}
                        <a href={`mailto:${supportEmail}`} className="text-blue-400 hover:text-blue-300 underline font-semibold">{supportEmail}</a>. This is for technical issues only.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    onClick={startInterviewProcess}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-10 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-all hover:scale-105 shadow-[0_0_40px_-10px_var(--color-blue-600)]"
                  >
                    I Understand, Begin Interview
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
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
                    try { recognitionRef.current?.stop(); } catch (e) { }
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
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm leading-relaxed ${msg.speaker === 'Candidate' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white/10 text-slate-200 rounded-tl-sm'
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