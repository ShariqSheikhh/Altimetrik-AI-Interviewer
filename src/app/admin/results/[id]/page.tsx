'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, User, Video, FileText, CheckCircle2, ShieldAlert, Loader2, PlayCircle } from 'lucide-react';
import Link from 'next/link';

export default function ResultDetails() {
  const params = useParams();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
  const isGoodScore = score >= 70;
  const isAverageScore = score >= 40 && score < 70;

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
            isAverageScore ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400' : 
            'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            <span className="font-semibold text-sm uppercase tracking-wide opacity-80">AI Match Score</span>
            <span className="text-3xl font-black">{score}/100</span>
          </div>
        </div>

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
                {result.video_url === 'mock_video_playback_feature_coming_soon.mp4' || !result.video_url ? (
                  <div className="text-center text-slate-500 flex flex-col items-center">
                    <ShieldAlert size={48} className="mb-4 opacity-50 text-red-400" />
                    <p className="font-semibold text-white">Video Recording Not Found</p>
                    <p className="text-sm mt-2 max-w-sm">
                      The video failed to upload. Please ensure you have created a public Storage Bucket named <code className="bg-black/50 px-1 rounded text-blue-400 border border-white/10">videos</code> in Supabase and added an INSERT policy for anon users.
                    </p>
                  </div>
                ) : (
                  <video src={result.video_url} controls className="w-full h-full" />
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
              <div className="prose prose-invert prose-sm">
                {result.evaluation?.feedback || 'No detailed feedback provided by the AI.'}
              </div>
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
