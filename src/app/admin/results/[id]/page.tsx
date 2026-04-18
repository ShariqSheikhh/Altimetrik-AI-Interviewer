'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, User, Video, FileText, ShieldAlert, Loader2,
  Target, TrendingDown, ShieldCheck, TrendingUp, AlertTriangle,
  MessageSquareWarning, CheckCircle2, ChevronDown, ChevronUp,
  Settings, Cpu, Terminal
} from 'lucide-react';
import Link from 'next/link';

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full bg-${color}-500 transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function QuestionCard({ qResult, questionBank, index }: { qResult: any; questionBank: any[]; index: number }) {
  const [open, setOpen] = useState(false);
  const q = questionBank[qResult.question_index];
  const questionText = typeof q === 'string' ? q : q?.question || `Question ${qResult.question_index + 1}`;
  const s = qResult.scoring;
  const total = s?.total_score ?? 0;
  const isGood = total >= 60;

  return (
    <div className={`rounded-3xl border overflow-hidden transition-all ${qResult.redirected ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 p-6 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0 ${isGood ? 'bg-emerald-500' : 'bg-red-500'}`}>
            Q{qResult.question_index + 1}
          </div>
          <p className="text-sm font-semibold text-slate-800 line-clamp-1">{questionText}</p>
          {qResult.redirected && (
            <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-200">
              <AlertTriangle size={10} /> Redirected
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xl font-black ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>{total}</span>
          <span className="text-slate-400 text-sm font-bold">/100</span>
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Expanded breakdown */}
      {open && (
        <div className="border-t border-slate-100 p-6 space-y-6">
          {/* Score breakdown */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Rubric (50%)</p>
              <p className="text-2xl font-black text-blue-600">{s?.rubric_weighted ?? 0}</p>
              <ScoreBar value={s?.rubric_weighted ?? 0} max={50} color="blue" />
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Coverage (40%)</p>
              <p className="text-2xl font-black text-emerald-600">{s?.coverage_weighted ?? 0}</p>
              <ScoreBar value={s?.coverage_weighted ?? 0} max={40} color="emerald" />
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1">Follow-up (10%)</p>
              <p className="text-2xl font-black text-violet-600">{s?.follow_up_score ?? 0}</p>
              <ScoreBar value={s?.follow_up_score ?? 0} max={10} color="violet" />
            </div>
          </div>

          {/* Rubric feedback */}
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rubric Breakdown</p>
            {qResult.rubrics && Object.entries(qResult.rubrics).map(([key, data]: [string, any]) => (
              <div key={key} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide">{key.replace('_', ' ')}</span>
                  <span className="text-xs font-black bg-white px-2 py-0.5 rounded-lg border border-slate-200">{data.score}/25</span>
                </div>
                <ScoreBar value={data.score} max={25} color="slate" />
                {data.feedback && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{data.feedback}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultDetails() {
  const params = useParams();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [stitchingStatus, setStitchingStatus] = useState<string | null>(null);
  const [segmentUrls, setSegmentUrls] = useState<string[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [stitchingProgress, setStitchingProgress] = useState(0);
  const [stitchingLogs, setStitchingLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!params.id) return;
    const fetchResult = async () => {
      const { data } = await supabase
        .from('results')
        .select('*, candidates(*), interviews(*)')
        .eq('id', params.id as string)
        .single();
      if (data) setResult(data);
      setLoading(false);
    };
    fetchResult();
  }, [params.id]);

  useEffect(() => {
    if (!result?.video_url || !result.video_url.endsWith('/')) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const startStitchingProcess = async () => {
        setFetchingUrl(true);
        try {
            // 1. Initial Check - See if it's already stitched
            const listRes = await fetch('/api/upload-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'listSegments', fileName: result.candidate_id })
            });
            if (!isMounted) return;
            const listData = await listRes.json();
            
            if (listData.finalExists) {
              console.log('Final video already exists, skipping trigger.');
              setPresignedUrl(listData.finalUrl);
              setStitchingStatus(null);
              // Save that final URL in DB so we never run this check again
              await supabase.from('results').update({ video_url: listData.finalPublicUrl }).eq('id', result.id);
              return;
            }

            if (!listData.segments || listData.segments.length === 0) {
                setVideoError(true);
                return;
            }

            // 2. Trigger Lambda - Only if final video was NOT found
            setStitchingStatus('Server-side stitching in progress...');
            const triggerRes = await fetch('/api/trigger-stitch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidateId: result.candidate_id })
            });
            if (!isMounted) return;
            
            if (!triggerRes.ok) throw new Error('Failed to trigger stitching');

            // 3. Start Polling
            let attempts = 0;
            const maxAttempts = 50; 
            let lastLogIndex = 0;

            pollInterval = setInterval(async () => {
              if (!isMounted) {
                if (pollInterval) clearInterval(pollInterval);
                return;
              }
              attempts++;
              
              try {
                // Fetch Logs
                const statusRes = await fetch('/api/upload-video', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'getStatus', fileName: result.candidate_id })
                });
                const statusData = await statusRes.json();
                
                if (statusData.logs) {
                    setStitchingLogs(statusData.logs);
                    lastLogIndex = statusData.logs.length;
                }
                if (statusData.progress !== undefined) setStitchingProgress(statusData.progress);
                if (statusData.status) setStitchingStatus(statusData.status.toUpperCase());

                const checkRes = await fetch('/api/upload-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'listSegments', fileName: result.candidate_id })
                });
                const checkData = await checkRes.json();
                
                if (checkData.finalExists) {
                  if (pollInterval) clearInterval(pollInterval);
                  console.log('%c[SUCCESS] Video ready!', 'color: #10b981; font-weight: bold;');
                  
                  // Clear segments to force the player to use the single final URL
                  setSegmentUrls([]);
                  setCurrentSegmentIndex(0);
                  
                  setPresignedUrl(checkData.finalUrl);
                  setStitchingStatus(null);
                  
                  await supabase.from('results').update({ video_url: checkData.finalPublicUrl }).eq('id', result.id);
                } else if (attempts >= maxAttempts) {
                  if (pollInterval) clearInterval(pollInterval);
                  setStitchingStatus('STITCHING TIMED OUT');
                }
              } catch (e) {
                console.warn('Polling check failed, retrying...');
              }
            }, 5000);
            
            // We no longer set segmentUrls here because we want to show the Progress Tracker UI
            // instead of a broken segmented experience.
            
        } catch (err) {
            console.error('Failed to manage video:', err);
            setVideoError(true);
        } finally {
            if (isMounted) setFetchingUrl(false);
        }
    };

    startStitchingProcess();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [result?.video_url, result?.id]);

  // Separate effect for single-file presigned URLs
  useEffect(() => {
    if (!result?.video_url || result.video_url.endsWith('/')) return;
    
    const getSingleFileUrl = async () => {
        try {
            const url = new URL(result.video_url);
            const key = decodeURIComponent(url.pathname.replace(/^\//, ''));
            
            console.log(`%c[CHECK] Verifying video existence: ${key}`, 'color: #94a3b8;');
            
            const res = await fetch('/api/s3-presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get', fileName: key })
            });
            const data = await res.json();
            
            if (data.signedUrl) {
                console.log('%c[OK] Video verified. Loading secure stream...', 'color: #10b981;');
                setPresignedUrl(data.signedUrl);
                setVideoError(false);
            } else {
                // FILE IS MISSING (Self-Healing Mode)
                console.warn('%c[RECOVERY] Final video missing from S3! Reverting to segmented mode to re-stitch...', 'color: #f59e0b; font-weight: bold;');
                
                // Reconstruct folder path
                const folderPath = `https://${url.hostname}/interview-videos/${result.candidate_id}/`;
                setVideoError(false);
                setResult((prev: any) => ({ ...prev, video_url: folderPath }));
            }
        } catch (e) {
            console.error('Failed to get presigned URL:', e);
            setVideoError(true);
        }
    };
    getSingleFileUrl();
  }, [result?.video_url]);


  if (loading) return (
    <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={32} />
    </div>
  );

  if (!result) return (
    <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center text-slate-500 font-bold">
      Evaluation not found.
    </div>
  );

  const score = result.evaluation?.score ?? 0;
  const recommendation = score > 80 ? 'Accept' : score < 50 ? 'Reject' : 'Human Evaluation Required';
  const recColor = score > 80 ? 'emerald' : score < 50 ? 'red' : 'amber';
  const isGood = score >= 60;
  const perQResults: any[] = result.evaluation?.per_question_results ?? [];
  const questionBank: any[] = result.interviews?.question_bank ?? [];
  const redirectedCount = perQResults.filter((q: any) => q.redirected).length;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-6">
          <Link href="/admin/dashboard" className="w-12 h-12 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 transition-all">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{result.candidates?.name}</h1>
              <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100 italic">
                Interview Result
              </div>
            </div>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <FileText size={16} /> {result.interviews?.title}
            </p>
          </div>
        </div>

        <div className={`px-10 py-5 rounded-[2rem] flex flex-col items-center border-2 shadow-2xl ${
          score > 80 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
          score < 50 ? 'bg-red-50 border-red-100 text-red-700' :
          'bg-amber-50 border-amber-100 text-amber-700'
        }`}>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Final Recommendation</span>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-xl font-black tracking-tight">{recommendation}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black tracking-tighter">{score}</span>
            <span className="text-sm font-bold opacity-60">/100</span>
          </div>
          <span className="text-[10px] opacity-50 mt-1">Avg of {perQResults.length} question(s)</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Questions', value: perQResults.length, icon: <FileText size={16} />, color: 'blue' },
          { label: 'Redirected', value: redirectedCount, icon: <MessageSquareWarning size={16} />, color: 'amber' },
          { label: 'Tab Switches', value: result.evaluation?.security_violations?.tab_switches ?? 0, icon: <ShieldAlert size={16} />, color: 'red' },
          { label: 'Fullscreen Exits', value: result.evaluation?.security_violations?.fullscreen_exits ?? 0, icon: <ShieldAlert size={16} />, color: 'orange' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-9 h-9 rounded-xl bg-${stat.color}-50 text-${stat.color}-500 flex items-center justify-center shrink-0`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

        <div className="lg:col-span-2 space-y-10 min-w-0">

          {/* Per-Question Breakdown */}
          {perQResults.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 uppercase tracking-widest text-[11px]">
                  <Target size={16} className="text-blue-500" /> Per-Question Scores (50% Rubric · 40% Coverage · 10% Follow-up)
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {perQResults.map((qr: any, i: number) => (
                  <QuestionCard key={i} qResult={qr} questionBank={questionBank} index={i} />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 text-center text-slate-400 shadow-sm">
              <CheckCircle2 size={40} className="mx-auto mb-4 text-slate-200" />
              <p className="font-bold">No per-question data available for this result.</p>
              <p className="text-sm mt-1">This may be an older result recorded before the new scoring system.</p>
            </div>
          )}

          {/* Transcript */}
          <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 uppercase tracking-widest text-[11px]">
                <FileText size={16} className="text-blue-500" /> Interview Dialogue
              </h3>
            </div>
            <div className="p-10 space-y-12">
              {result.transcript_data?.full_transcript?.map((item: any, i: number) => {
                if (item.isBreak || item.speaker === 'System') {
                  return (
                    <div key={i} className="flex items-center gap-4 py-8">
                      <div className="h-[1px] bg-slate-200 grow" />
                      <div className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full flex flex-col items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={12} className="text-amber-500" /> Session Interrupted & Resumed
                        </div>
                        {item.timestamp && <span className="text-[9px] lowercase font-medium text-slate-400">at {item.timestamp}</span>}
                      </div>
                      <div className="h-[1px] bg-slate-200 grow" />
                    </div>
                  );
                }
                return (
                  <div key={i} className="relative pl-12 border-l-2 border-slate-100 space-y-6">
                    <div className="absolute -left-[13px] top-0 w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-[10px] shadow-lg shadow-blue-500/30">
                      {i + 1}
                    </div>
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-[2rem] rounded-tl-none shadow-sm">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Altimetrik AI</span>
                        <p className="text-slate-800 font-bold leading-relaxed">{item.q}</p>
                      </div>
                      <div className="bg-blue-600 p-6 rounded-[2rem] rounded-tr-none shadow-lg shadow-blue-600/10 text-white">
                        <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest block mb-2">Candidate</span>
                        <p className="leading-relaxed font-medium">{item.a || 'No response recorded.'}</p>
                      </div>
                      {item.followUp && (
                        <div className="pl-6 space-y-4">
                          <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl border-l-4 border-l-blue-400">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Probing Follow-Up</span>
                            <p className="text-blue-800 font-semibold italic">&ldquo;{item.followUp}&rdquo;</p>
                          </div>
                          <div className="bg-white border border-blue-200 p-5 rounded-2xl shadow-sm text-blue-900">
                            <p className="leading-relaxed font-medium">{item.followUpAnswer || 'No specific follow-up response audible.'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-8 min-w-0">

          {/* Video Player Section */}
          <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
            <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between relative z-10">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 uppercase tracking-widest text-[11px]">
                <Video size={16} className="text-blue-500" /> Session Recording
              </h3>
              {result.video_url && !videoError && presignedUrl && (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black tracking-widest">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {result.video_url.endsWith('/') ? 'SEAMLESS SEGMENTED STREAM' : 'SECURE DIRECT STREAM'}
                </div>
              )}
            </div>

            <div className="aspect-video bg-slate-900 relative overflow-hidden rounded-b-[3rem]">
              {!result.video_url ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 border border-white/5">
                    <ShieldAlert size={40} className="text-slate-600" />
                  </div>
                  <h4 className="text-white font-bold text-xl mb-2">Video Unavailable</h4>
                  <p className="text-slate-500 text-sm max-w-sm">No recording was captured for this session. This can happen due to connection loss or restricted camera access.</p>
                </div>
              ) : videoError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                  <h4 className="text-white font-bold text-xl mb-4">Stream Playback Failed</h4>
                  <a href={presignedUrl || result.video_url} target="_blank" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95">Download Recording</a>
                </div>
              ) : stitchingStatus ? (
                // --- REFINED LIGHT THEME PROGRESS TRACKER ---
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white border-t border-slate-100">
                  <div className="absolute inset-0 opacity-40 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_#f1f5f9_0%,_transparent_70%)]" />
                  </div>
                  
                  <div className="z-10 w-full max-w-xs space-y-5">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center shadow-sm">
                        <Cpu size={24} className="text-blue-500 animate-pulse" />
                      </div>
                      <div className="text-center">
                        <h4 className="text-slate-900 font-black text-sm tracking-widest uppercase">{stitchingStatus || 'Processing...'}</h4>
                        <p className="text-blue-500/60 text-[9px] font-black uppercase tracking-[0.2em] italic">Optimization Pipeline Active</p>
                      </div>
                    </div>

                    {/* Compact Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-end px-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Sync Progress</span>
                        <span className="text-sm font-black text-blue-600 tabular-nums">{stitchingProgress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-[1px]">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-1000 ease-out shadow-sm"
                          style={{ width: `${stitchingProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Light Live Log Window */}
                    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 h-28 overflow-hidden relative shadow-sm">
                      <div className="flex flex-col-reverse gap-1.5 overflow-y-auto h-full pr-1 custom-scrollbar">
                        {stitchingLogs.slice().reverse().map((log, lIdx) => (
                          <div key={lIdx} className="flex gap-2 items-start animate-in fade-in duration-300">
                            <Terminal size={8} className="text-slate-400 mt-1 shrink-0" />
                            <p className="text-[9px] font-mono text-slate-500 font-bold leading-tight uppercase tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
                              {log.replace(/\[.*?\]\s*/, '')}
                            </p>
                          </div>
                        ))}
                        {stitchingLogs.length === 0 && (
                          <p className="text-[9px] font-mono text-slate-400 text-center mt-6 italic">Connecting...</p>
                        )}
                      </div>
                    </div>

                    <p className="text-[8px] text-center text-slate-400 font-black uppercase tracking-widest opacity-60">
                      Processing High-Fidelity Audio Sync...
                    </p>
                  </div>
                </div>
              ) : !presignedUrl ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                  <p className="text-slate-400 text-sm font-bold">Generating Secure Access URL...</p>
                </div>
              ) : (
                <div className="relative w-full h-full group">
                  <video
                    src={segmentUrls.length > 0 ? segmentUrls[currentSegmentIndex] : presignedUrl}
                    controls
                    autoPlay={currentSegmentIndex > 0}
                    className="w-full h-full"
                    preload="auto"
                    onEnded={() => {
                      if (currentSegmentIndex < segmentUrls.length - 1) {
                        setCurrentSegmentIndex(prev => prev + 1);
                      }
                    }}
                    onError={() => setVideoError(true)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Overall Feedback */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6 border-b border-slate-50 pb-4">
              <TrendingUp size={18} className="text-emerald-500" /> Overall Feedback
            </h3>
            <p className="prose prose-slate prose-sm font-medium leading-[1.8] text-slate-600 italic">
              &ldquo;{result.evaluation?.feedback || 'Summary feedback not available.'}&rdquo;
            </p>
          </div>

          {/* Candidate Info */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <User size={20} className="text-blue-400" /> Candidate File
            </h3>
            <ul className="space-y-5">
              <li>
                <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Assessed On</p>
                <p className="font-bold text-sm">{new Date(result.created_at).toLocaleString()}</p>
              </li>
              <li>
                <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Candidate ID</p>
                <code className="text-[11px] bg-white/5 px-2 py-1 rounded border border-white/10 font-mono text-slate-400 break-all">{result.candidate_id}</code>
              </li>
              <li>
                <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Access Key</p>
                <p className="font-bold text-sm tracking-[0.3em] font-mono">{result.candidates?.passkey}</p>
              </li>
            </ul>
            <div className="absolute -bottom-10 -right-10 opacity-5">
              <ShieldCheck size={180} />
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}