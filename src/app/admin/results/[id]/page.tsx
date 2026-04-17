'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, User, Video, FileText, ShieldAlert, Loader2,
  Target, TrendingDown, ShieldCheck, TrendingUp, AlertTriangle,
  MessageSquareWarning, CheckCircle2, ChevronDown, ChevronUp
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
    if (!result?.video_url) return;

    const getPresignedUrl = async () => {
        setFetchingUrl(true);
        try {
            // Check if it's a segmented folder prefix (ends with /)
            if (result.video_url.endsWith('/')) {
                setStitchingStatus('Searching for video segments...');
                
                const listRes = await fetch('/api/upload-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'listSegments', fileName: result.candidate_id })
                });
                const { segments } = await listRes.json();
                
                if (!segments || segments.length === 0) {
                    setVideoError(true);
                    return;
                }

                setSegmentUrls(segments);
                setCurrentSegmentIndex(0);
                setPresignedUrl(segments[0]);
                
                // For direct download, we still create a master blob
                const segmentBlobs = await Promise.all(
                    segments.map(async (url: string) => {
                        const res = await fetch(url);
                        return await res.blob();
                    })
                );
                const masterBlob = new Blob(segmentBlobs, { type: 'video/webm' });
                
                // --- NEW: Finalize and Upload single file for future use ---
                setStitchingStatus('Finalizing video for permanent storage...');
                
                const finalFileName = `${result.candidate_id}/final_interview.webm`;
                const uploadRes = await fetch('/api/upload-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'upload', fileName: finalFileName, fileType: 'video/webm' })
                });
                const { signedUrl: putUrl, publicUrl } = await uploadRes.json();

                await fetch(putUrl, {
                    method: 'PUT',
                    body: masterBlob,
                    headers: { 'Content-Type': 'video/webm' }
                });

                // Update database to point to the new single file
                await supabase
                    .from('results')
                    .update({ video_url: publicUrl })
                    .eq('id', result.id);

                console.log('Video finalized and database updated.');
                setStitchingStatus(null);
                
            } else {
                // Classic single file logic
                const url = new URL(result.video_url);
                const key = decodeURIComponent(url.pathname.replace(/^\//, ''));

                const response = await fetch('/api/s3-presign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get', fileName: key })
                });
                const data = await response.json();
                if (data.signedUrl) {
                    setPresignedUrl(data.signedUrl);
                }
            }
        } catch (err) {
            console.error('Failed to fetch/finalize video:', err);
            setVideoError(true);
        } finally {
            setFetchingUrl(false);
        }
    };
    getPresignedUrl();
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

        <div className={`px-10 py-5 rounded-[2rem] flex flex-col items-center border-2 ${isGood ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'} shadow-2xl`}>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Overall Score</span>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black tracking-tighter">{score}</span>
            <span className="text-xl font-bold opacity-60">/100</span>
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
            <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 uppercase tracking-widest text-[11px]">
                <Video size={16} className="text-blue-500" /> Session Recording
              </h3>
              {result.video_url && !videoError && (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black tracking-widest">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {presignedUrl ? (result.video_url.endsWith('/') ? 'SEAMLESS SEGMENTED STREAM' : 'SECURE DIRECT STREAM') : (stitchingStatus || 'INITIALIZING...')}
                </div>
              )}
            </div>

            <div className="aspect-video bg-slate-900 relative">
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
              ) : !presignedUrl ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                      <p className="text-slate-400 text-sm font-bold">{stitchingStatus || 'Generating Secure Access URL...'}</p>
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
                  {segmentUrls.length > 1 && (
                    <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black text-white/90 uppercase tracking-widest border border-white/10 pointer-events-none transition-opacity group-hover:opacity-100 opacity-0">
                      Clip {currentSegmentIndex + 1} of {segmentUrls.length}
                    </div>
                  )}
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