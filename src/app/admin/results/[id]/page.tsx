'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, User, Video, FileText, CheckCircle2, ShieldAlert, Loader2, PlayCircle, Target, AlertTriangle, TrendingDown } from 'lucide-react';
import Link from 'next/link';

export default function ResultDetails() {
  const params = useParams();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

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

  if (loading) {
    return <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center text-blue-400"><Loader2 className="animate-spin" size={32} /></div>;
  }

  if (!result) {
    return <div className="min-h-screen bg-[#0a0f1c] text-white flex items-center justify-center">Result not found.</div>;
  }

  const score = result.evaluation?.score || 0;
  const scoring = result.evaluation?.scoring;
  const isGoodScore = score >= 60;

  // Convert an S3 public URL to our server-side proxy URL.
  // This avoids the need for a public bucket policy or CORS on S3.
  const getProxyVideoUrl = (s3Url: string): string => {
    try {
      const url = new URL(s3Url);
      // pathname is like /interview-videos/xxx.webm
      const key = url.pathname.replace(/^\//, '');
      return `/api/video-stream?key=${encodeURIComponent(key)}`;
    } catch {
      return s3Url; // fallback to original if URL parsing fails
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-8 selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{result.candidates?.name}</h1>
              <p className="text-sm text-slate-400 font-medium">Applied for: {result.interviews?.title}</p>
            </div>
          </div>

          <div className={`px-6 py-3 rounded-2xl flex items-center gap-4 ${
            isGoodScore ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
            'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            <span className="font-semibold text-sm uppercase tracking-wide opacity-80">Final Score</span>
            <span className="text-3xl font-black">{score}/100</span>
          </div>
        </div>

        {/* Score Breakdown Cards */}
        {scoring && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rubric Score */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={18} className="text-blue-400" />
                <h4 className="font-semibold text-white text-sm">Rubric Score</h4>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-black text-blue-400">{scoring.rubric_score?.weighted || 0}</span>
                <span className="text-slate-500 text-sm">/ {scoring.rubric_score?.max || 50} pts (50%)</span>
              </div>
              <p className="text-xs text-slate-500">{scoring.rubric_score?.description}</p>
              <div className="mt-3 bg-black/30 rounded-lg h-2 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-lg transition-all" 
                  style={{ width: `${((scoring.rubric_score?.weighted || 0) / (scoring.rubric_score?.max || 50)) * 100}%` }}
                />
              </div>
            </div>

            {/* Coverage Score */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <Target size={18} className="text-green-400" />
                <h4 className="font-semibold text-white text-sm">Coverage Score</h4>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-black text-green-400">{scoring.coverage_score?.weighted || 0}</span>
                <span className="text-slate-500 text-sm">/ {scoring.coverage_score?.max || 40} pts (40%)</span>
              </div>
              <p className="text-xs text-slate-500">Key point coverage: {scoring.coverage_score?.percentage || 0}%</p>
              <div className="mt-3 bg-black/30 rounded-lg h-2 overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-lg transition-all" 
                  style={{ width: `${((scoring.coverage_score?.weighted || 0) / (scoring.coverage_score?.max || 40)) * 100}%` }}
                />
              </div>
            </div>

            {/* Follow-up Penalty */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={18} className="text-red-400" />
                <h4 className="font-semibold text-white text-sm">Follow-up Penalty</h4>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-black text-red-400">-{scoring.follow_up_penalty?.penalty || 0}</span>
                <span className="text-slate-500 text-sm">/ -{scoring.follow_up_penalty?.max || 10} pts max</span>
              </div>
              <p className="text-xs text-slate-500">
                {scoring.follow_up_penalty?.questions_needing_follow_ups || 0} of {scoring.follow_up_penalty?.total_questions || 0} questions needed probing
              </p>
              <div className="mt-3 bg-black/30 rounded-lg h-2 overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-lg transition-all" 
                  style={{ width: `${((scoring.follow_up_penalty?.penalty || 0) / (scoring.follow_up_penalty?.max || 10)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column: Video & Transcript */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Video Recording */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
              <div className="p-4 border-b border-white/5 font-semibold flex items-center gap-2 bg-black/50">
                <Video size={18} className="text-blue-400" /> Session Recording
              </div>
              <div className="aspect-video bg-black relative flex items-center justify-center">
                {!result.video_url ? (
                  <div className="text-center text-slate-500 flex flex-col items-center p-6">
                    <ShieldAlert size={48} className="mb-4 opacity-50 text-red-400" />
                    <p className="font-semibold text-white">Video Recording Not Found</p>
                    <p className="text-sm mt-2 max-w-sm">
                      The video failed to upload or was not recorded. Check AWS S3 bucket configuration, CORS settings, and candidate's browser permissions.
                    </p>
                  </div>
                ) : videoError ? (
                  <div className="text-center text-slate-500 flex flex-col items-center p-6">
                    <ShieldAlert size={48} className="mb-4 opacity-50 text-amber-400" />
                    <p className="font-semibold text-white">Video Could Not Be Played</p>
                    <p className="text-sm mt-2 max-w-sm text-slate-400">
                      The video could not be streamed. Try opening it directly.
                    </p>
                    <a
                      href={getProxyVideoUrl(result.video_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-full transition-colors"
                    >
                      Open Video in New Tab
                    </a>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col">
                    <video
                      key={result.video_url}
                      src={getProxyVideoUrl(result.video_url)}
                      controls
                      className="w-full h-full"
                      preload="metadata"
                      onError={() => {
                        console.error('[Video] Failed to stream:', result.video_url);
                        setVideoError(true);
                      }}
                    />
                    {/* Video URL info bar */}
                    <div className="bg-black/60 px-4 py-2 flex items-center justify-between gap-2 border-t border-white/10">
                      <p className="text-xs text-slate-400 truncate flex-1" title={result.video_url}>
                        {result.video_url}
                      </p>
                      <button
                        onClick={() => navigator.clipboard.writeText(result.video_url)}
                        className="text-xs px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors border border-blue-500/30"
                        title="Copy S3 URL"
                      >
                        Copy S3 URL
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Transcript */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
              <div className="p-4 border-b border-white/5 font-semibold flex items-center gap-2 bg-black/50">
                <FileText size={18} className="text-purple-400" /> Full Transcript
              </div>
              <div className="p-6 space-y-8 bg-black/20">
                {result.transcript_data?.full_transcript?.map((item: any, i: number) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-bold text-sm">
                      Q{i+1}
                    </div>
                    <div className="space-y-3 flex-1">
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 rounded-tl-none">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">AI Interviewer</span>
                        <p className="text-white font-medium">{item.q}</p>
                      </div>
                      <div className="bg-indigo-600/10 p-4 rounded-xl border border-indigo-500/20 rounded-bl-none text-indigo-100">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide block mb-1">Candidate</span>
                        <p className="leading-relaxed">{item.a || '(No response recorded)'}</p>
                      </div>
                      {/* Show follow-up if any */}
                      {item.followUp && (
                        <>
                          <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 rounded-tl-none">
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide block mb-1">Follow-up (Probing)</span>
                            <p className="text-amber-100 font-medium">{item.followUp}</p>
                          </div>
                          {item.followUpAnswer && (
                            <div className="bg-indigo-600/10 p-4 rounded-xl border border-indigo-500/20 rounded-bl-none text-indigo-100">
                              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide block mb-1">Candidate (Follow-up Response)</span>
                              <p className="leading-relaxed">{item.followUpAnswer}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Sidebar: Evaluation & Metadata */}
          <div className="space-y-8">
            
            {/* AI Evaluation */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <h3 className="font-semibold flex items-center gap-2 mb-6">
                <ShieldAlert size={18} className="text-blue-400" /> Evaluator Feedback
              </h3>
              <div className={`prose prose-invert prose-sm ${result.evaluation?.rubric_aspects ? 'mb-6 pb-6 border-b border-white/10' : ''}`}>
                {result.evaluation?.feedback || 'No detailed feedback provided by the AI.'}
              </div>

              {result.evaluation?.rubric_aspects && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Rubric Criteria (50% weight)</h4>
                  
                  {result.evaluation.rubric_aspects.communication && (
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-white text-sm">Communication Clarity</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          result.evaluation.rubric_aspects.communication.score >= 15
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>{result.evaluation.rubric_aspects.communication.score}/25</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{result.evaluation.rubric_aspects.communication.feedback}</p>
                    </div>
                  )}

                  {result.evaluation.rubric_aspects.relevance && (
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-white text-sm">Relevance & Depth</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          result.evaluation.rubric_aspects.relevance.score >= 15
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>{result.evaluation.rubric_aspects.relevance.score}/25</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{result.evaluation.rubric_aspects.relevance.feedback}</p>
                    </div>
                  )}

                  {result.evaluation.rubric_aspects.problem_solving && (
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-white text-sm">Problem-Solving & Critical Thinking</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          result.evaluation.rubric_aspects.problem_solving.score >= 15
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>{result.evaluation.rubric_aspects.problem_solving.score}/25</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{result.evaluation.rubric_aspects.problem_solving.feedback}</p>
                    </div>
                  )}

                  {result.evaluation.rubric_aspects.specificity && (
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-white text-sm">Specificity & Use of Examples</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          result.evaluation.rubric_aspects.specificity.score >= 15
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>{result.evaluation.rubric_aspects.specificity.score}/25</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{result.evaluation.rubric_aspects.specificity.feedback}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Per-question coverage */}
              {scoring?.coverage_score?.per_question?.length > 0 && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Per-Question Key Point Coverage</h4>
                  <div className="space-y-2">
                    {scoring.coverage_score.per_question.map((pq: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 w-8">Q{pq.questionIndex + 1}</span>
                        <div className="flex-1 bg-black/30 rounded-lg h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-lg transition-all ${pq.coverage >= 70 ? 'bg-green-500' : pq.coverage >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${pq.coverage}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-400 w-10 text-right">{pq.coverage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Info */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <h3 className="font-semibold flex items-center gap-2 mb-6">
                <User size={18} className="text-slate-400" /> Details
              </h3>
              
              <ul className="space-y-4">
                <li className="flex flex-col">
                  <span className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Email</span>
                  <span className="text-slate-300 font-medium">{result.candidates?.email}</span>
                </li>
                <li className="flex flex-col">
                  <span className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Interview Date</span>
                  <span className="text-slate-300 font-medium">{new Date(result.created_at).toLocaleString()}</span>
                </li>
                <li className="flex flex-col pt-4 border-t border-white/5">
                  <span className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Passkey Used</span>
                  <span className="font-mono text-sm bg-black/50 px-2 py-1 rounded inline-flex self-start border border-white/10 text-slate-400">
                    {result.candidates?.passkey}
                  </span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
