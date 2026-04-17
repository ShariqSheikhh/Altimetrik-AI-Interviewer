'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle, Clock, XCircle, Users, Mail, BarChart3, Loader2, RefreshCw, GraduationCap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

type CandidateStatus = 'completed' | 'in_progress' | 'not_started';

interface CandidateWithStatus {
  id: string;
  name: string;
  email: string;
  passkey: string;
  status: CandidateStatus;
  result?: any;
  created_at?: string;
}

export default function InterviewStatusPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  const [interview, setInterview] = useState<any>(null);
  const [candidates, setCandidates] = useState<CandidateWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      const { data: interviewData } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single();

      setInterview(interviewData);

      const { data: candidatesData } = await supabase
        .from('candidates')
        .select('*')
        .eq('interview_id', interviewId);

      const { data: resultsData } = await supabase
        .from('results')
        .select('*')
        .eq('interview_id', interviewId);

      const resultsMap = new Map();
      if (resultsData) {
        resultsData.forEach((result) => {
          resultsMap.set(result.candidate_id, result);
        });
      }

      const candidatesWithStatus: CandidateWithStatus[] = (candidatesData || []).map((candidate) => {
        const result = resultsMap.get(candidate.id);
        let status: CandidateStatus = 'not_started';
        if (result) status = 'completed';

        return {
          ...candidate,
          status,
          result,
        };
      });

      setCandidates(candidatesWithStatus);
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [interviewId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  const stats = {
    total: candidates.length,
    completed: candidates.filter((c) => c.status === 'completed').length,
    not_started: candidates.filter((c) => c.status === 'not_started').length,
  };

  const completedPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link href="/admin/dashboard" className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{interview?.title}</h1>
            <p className="text-slate-500 font-medium">Real-time candidate progress and result tracking.</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-white hover:bg-slate-50 border border-slate-200 px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all active:scale-95 shadow-sm"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin text-blue-500' : 'text-slate-400'} />
          {refreshing ? 'Syncing...' : 'Sync Status'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total Invited</p>
             <div className="flex items-baseline gap-2">
                 <span className="text-3xl font-black text-slate-900">{stats.total}</span>
                 <span className="text-slate-400 font-bold text-sm">Candidates</span>
             </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2rem] shadow-sm">
             <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Completed Sessions</p>
             <div className="flex items-baseline gap-2">
                 <span className="text-3xl font-black text-emerald-700">{stats.completed}</span>
                 <span className="text-emerald-600 font-bold text-sm">Success</span>
             </div>
          </div>
          <div className="bg-blue-600 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
             <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest mb-3">Completion Rate</p>
             <div className="flex items-baseline gap-2">
                 <span className="text-3xl font-black">{completedPercentage}%</span>
             </div>
             <div className="h-1.5 bg-white/20 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-white transition-all duration-1000" style={{ width: `${completedPercentage}%` }} />
             </div>
             <GraduationCap className="absolute -bottom-6 -right-6 text-white/10" size={120} />
          </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  Live Enrollment List
              </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/20">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enrollment Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate Detail</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Passkey</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Evaluation</th>
                  <th className="px-8 py-5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      {candidate.status === 'completed' ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100/50">
                           <CheckCircle size={14} /> Finalized
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 shadow-sm">
                           <Clock size={14} /> Awaiting Login
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-5">
                        <p className="font-black text-slate-900 leading-none">{candidate.name || 'Anonymous'}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1.5">{candidate.email}</p>
                    </td>
                    <td className="px-8 py-5">
                      <code className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-slate-600">
                        {candidate.passkey}
                      </code>
                    </td>
                    <td className="px-8 py-5">
                      {(candidate.result?.evaluation?.score !== undefined && candidate.result?.evaluation?.score !== null) ? (
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase border ${
                            candidate.result.evaluation.score > 80 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            candidate.result.evaluation.score < 50 ? 'bg-red-50 text-red-600 border border-red-100' :
                            'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                            {candidate.result.evaluation.score > 80 ? 'Accept' : candidate.result.evaluation.score < 50 ? 'Reject' : 'Human Eval'} ({candidate.result.evaluation.score}%)
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium text-xs tracking-tight italic">No result yet</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {candidate.status === 'completed' && candidate.result?.id && (
                        <Link
                          href={`/admin/results/${candidate.result.id}`}
                          className="w-10 h-10 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 rounded-xl flex items-center justify-center transition-all shadow-sm group-hover:scale-110"
                        >
                          <ArrowRight size={18} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
          <Link
            href={`/admin/interviews/${interviewId}/send-email`}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl px-10 py-5 flex items-center gap-3 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
          >
            <Mail size={18} /> Broadcast Invites to Candidates
          </Link>
          <Link
            href="/admin/dashboard"
            className="text-slate-400 hover:text-slate-600 font-bold text-sm px-8 py-4 transition-colors"
          >
            Return to Overview
          </Link>
      </div>
    </div>
  );
}
