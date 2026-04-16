'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, User, Video, FileText, CheckCircle2, ShieldAlert, Loader2, PlayCircle, Target, AlertTriangle, TrendingDown, Clock, ShieldCheck, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function ResultDetails() {
  const params = useParams();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [stitchingStatus, setStitchingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;

    const fetchResult = async () => {
      const { data } = await supabase
        .from('results')
        .select(`
          *,
          candidates(*),
          interviews(*)
        `)
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

                setStitchingStatus(`Stitching ${segments.length} segments...`);

                const segmentBlobs = await Promise.all(
                    segments.map(async (url: string) => {
                        const res = await fetch(url);
                        return await res.blob();
                    })
                );

                const masterBlob = new Blob(segmentBlobs, { type: 'video/webm' });
                const blobUrl = URL.createObjectURL(masterBlob);
                setPresignedUrl(blobUrl);

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

  if (loading) {
    return (
        <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
    );
  }

  if (!result) {
    return (
        <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center text-slate-500 font-bold">
            Evaluation not found.
        </div>
    );
  }

  const score = result.evaluation?.score || 0;
  const scoring = result.evaluation?.scoring;
  const isGoodScore = score >= 60;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">

      {/* Header Info */}
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
                          <FileText size={16} />
                          {result.interviews?.title}
                      </p>
                  </div>
              </div>

              <div className={`px-10 py-5 rounded-[2rem] flex flex-col items-center justify-center border-2 ${isGoodScore ? 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-emerald-700/5' :
            'bg-red-50 border-red-100 text-red-700 shadow-red-700/5'
          } shadow-2xl`}>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">AI Evaluation</span>
                  <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black tracking-tighter">{score}</span>
                      <span className="text-xl font-bold opacity-60">/100</span>
                  </div>
              </div>
      </div>

      {/* Metrics Grid */}
      {scoring && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Rubric Compliance', weighted: scoring.rubric_score?.weighted, max: scoring.rubric_score?.max, color: 'blue', icon: <ShieldCheck size={20} /> },
            { label: 'Question Coverage', weighted: scoring.coverage_score?.weighted, max: scoring.coverage_score?.max, color: 'emerald', icon: <Target size={20} /> },
            { label: 'Follow-up Penalty', weighted: scoring.follow_up_penalty?.penalty, max: scoring.follow_up_penalty?.max, color: 'red', icon: <TrendingDown size={20} />, negative: true }
          ].map((m, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                      <div className={`w-10 h-10 rounded-xl bg-${m.color}-50 text-${m.color}-600 flex items-center justify-center`}>
                          {m.icon}
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">{m.label}</h4>
                  </div>
                  <div className="flex items-baseline gap-2 mb-4">
                      <span className={`text-2xl font-black text-${m.color}-600`}>{m.negative ? '-' : ''}{m.weighted || 0}</span>
                      <span className="text-slate-400 text-sm font-bold">/ {m.max || 0} pts</span>
                  </div>
                  <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                      <div
                          className={`h-full bg-${m.color}-500 rounded-full transition-all`}
                          style={{ width: `${((m.weighted || 0) / (m.max || 1)) * 100}%` }}
                      />
                  </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

              <div className="lg:col-span-2 space-y-10 min-w-0">
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
                              <video
                                  src={presignedUrl}
                                  controls
                                  className="w-full h-full"
                                  preload="metadata"
                                  onError={() => setVideoError(true)}
                              />
                          )}
                      </div>
                  </div>

                  {/* Transcript Section */}
                  <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-sm">
                      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2 uppercase tracking-widest text-[11px]">
                              <FileText size={16} className="text-blue-500" /> Interview Dialogue
                          </h3>
                      </div>
                      <div className="p-10 space-y-12">
                          {result.transcript_data?.full_transcript?.map((item: any, i: number) => (
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
                                            <p className="text-blue-800 font-semibold italic">"{item.followUp}"</p>
                                        </div>
                                        <div className="bg-white border border-blue-200 p-5 rounded-2xl shadow-sm text-blue-900">
                                            <p className="leading-relaxed font-medium">{item.followUpAnswer || 'No specific follow-up response audible.'}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                      </div>
                  </div>
              </div>

              <aside className="space-y-10 min-w-0">
                  {/* Detailed Feedback Cards */}
                  <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-8 border-b border-slate-50 pb-4">
                          <TrendingUp size={18} className="text-emerald-500" /> Qualitative Feedback
                      </h3>
                      <div className="prose prose-slate prose-sm font-medium leading-[1.8] text-slate-600 italic mb-10">
                          "{result.evaluation?.feedback || 'Summary feedback not available.'}"
                      </div>

                      {result.evaluation?.rubric_aspects && (
                          <div className="space-y-6">
                              {Object.entries(result.evaluation.rubric_aspects).map(([key, data]: [string, any], i) => (
                                  <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-3">
                                      <div className="flex justify-between items-center">
                                          <h5 className="font-bold text-slate-800 text-xs uppercase tracking-widest">{key.replace('_', ' ')}</h5>
                                          <span className="text-[11px] font-black bg-white px-2 py-1 rounded-lg border border-slate-200">{data.score}/25</span>
                                      </div>
                                      <p className="text-xs text-slate-500 leading-relaxed font-medium">{data.feedback}</p>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  {/* Integrity & Security */}
                  <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6 border-b border-slate-50 pb-4">
                          <ShieldAlert size={18} className="text-amber-500" /> Security Violations
                      </h3>
                      <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <span className="text-sm font-bold text-slate-700">Tab Switches</span>
                              <span className="text-lg font-black text-amber-600">{result.evaluation?.security_violations?.tab_switches || 0}</span>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <span className="text-sm font-bold text-slate-700">Fullscreen Exits</span>
                              <span className="text-lg font-black text-amber-600">{result.evaluation?.security_violations?.fullscreen_exits || 0}</span>
                          </div>
                      </div>
                  </div>

                  {/* Candidate Info Card */}
                  <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                      <h3 className="text-lg font-bold mb-8 flex items-center gap-2 relative z-10">
                          <User size={20} className="text-blue-400" /> Candidate File
                      </h3>
                      <ul className="space-y-6 relative z-10">
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
                      <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:scale-110 transition-transform">
                          <ShieldCheck size={200} />
                      </div>
                  </div>
              </aside>

      </div>
    </div>
  );
}
