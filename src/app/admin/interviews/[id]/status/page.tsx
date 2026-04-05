'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle, Clock, XCircle, Users, Mail, BarChart3, Loader2, RefreshCw } from 'lucide-react';
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
      // Fetch interview details
      const { data: interviewData } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single();

      setInterview(interviewData);

      // Fetch all candidates for this interview
      const { data: candidatesData } = await supabase
        .from('candidates')
        .select('*')
        .eq('interview_id', interviewId);

      // Fetch all results for this interview
      const { data: resultsData } = await supabase
        .from('results')
        .select('*')
        .eq('interview_id', interviewId);

      // Create a map of candidate results
      const resultsMap = new Map();
      if (resultsData) {
        resultsData.forEach((result) => {
          resultsMap.set(result.candidate_id, result);
        });
      }

      // Merge candidates with their results status
      const candidatesWithStatus: CandidateWithStatus[] = (candidatesData || []).map((candidate) => {
        const result = resultsMap.get(candidate.id);
        let status: CandidateStatus = 'not_started';

        if (result) {
          status = 'completed';
        }

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
    in_progress: candidates.filter((c) => c.status === 'in_progress').length,
    not_started: candidates.filter((c) => c.status === 'not_started').length,
  };

  const completedPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const filteredCandidates = (filter: CandidateStatus | 'all') => {
    if (filter === 'all') return candidates;
    return candidates.filter((c) => c.status === filter);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-blue-400" size={48} />
          <p className="text-slate-400">Loading interview status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{interview?.title || 'Interview'} Status</h1>
              <p className="text-slate-400 mt-1">Track candidate progress and completion status</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors border border-white/10 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users size={20} className="text-slate-400" />
              <span className="text-slate-400 text-sm">Total Candidates</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle size={20} className="text-green-400" />
              <span className="text-green-400 text-sm">Completed</span>
            </div>
            <div className="text-3xl font-bold text-green-400">{stats.completed}</div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock size={20} className="text-yellow-400" />
              <span className="text-yellow-400 text-sm">In Progress</span>
            </div>
            <div className="text-3xl font-bold text-yellow-400">{stats.in_progress}</div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <XCircle size={20} className="text-red-400" />
              <span className="text-red-400 text-sm">Not Started</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.not_started}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-400" />
              <span className="text-sm font-medium text-slate-300">Completion Progress</span>
            </div>
            <span className="text-sm text-slate-400">{completedPercentage}% Complete</span>
          </div>
          <div className="h-4 bg-black/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${completedPercentage}%` }}
            />
          </div>
        </div>

        {/* Candidates Table with Filter */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Candidate List</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Filter:</span>
              <select
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    setCandidates([...candidates]);
                  } else {
                    setCandidates(candidates.filter((c) => c.status === value));
                  }
                }}
                className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All ({candidates.length})</option>
                <option value="completed">Completed ({stats.completed})</option>
                <option value="in_progress">In Progress ({stats.in_progress})</option>
                <option value="not_started">Not Started ({stats.not_started})</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 font-medium text-slate-400">Status</th>
                  <th className="px-6 py-4 font-medium text-slate-400">Name</th>
                  <th className="px-6 py-4 font-medium text-slate-400">Email</th>
                  <th className="px-6 py-4 font-medium text-slate-400">Passkey</th>
                  <th className="px-6 py-4 font-medium text-slate-400">Score</th>
                  <th className="px-6 py-4 font-medium text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-white/5">
                    <td className="px-6 py-4">
                      {candidate.status === 'completed' && (
                        <span className="inline-flex items-center gap-2 text-green-400">
                          <CheckCircle size={16} /> Completed
                        </span>
                      )}
                      {candidate.status === 'in_progress' && (
                        <span className="inline-flex items-center gap-2 text-yellow-400">
                          <Clock size={16} /> In Progress
                        </span>
                      )}
                      {candidate.status === 'not_started' && (
                        <span className="inline-flex items-center gap-2 text-red-400">
                          <XCircle size={16} /> Not Started
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{candidate.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-slate-300">{candidate.email}</td>
                    <td className="px-6 py-4">
                      <code className="bg-white/5 px-2 py-1 rounded text-xs text-slate-300">
                        {candidate.passkey}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      {candidate.result?.evaluation?.score ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            candidate.result.evaluation.score >= 60
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {candidate.result.evaluation.score}/100
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {candidate.status === 'completed' && candidate.result?.id && (
                        <Link
                          href={`/admin/results/${candidate.result.id}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-full text-xs font-medium transition-colors border border-blue-500/20"
                        >
                          View Result
                        </Link>
                      )}
                      {candidate.status === 'not_started' && (
                        <span className="text-slate-500 text-xs">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
                {candidates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No candidates found for this interview.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link
            href={`/admin/interviews/${interviewId}/send-email`}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full px-8 py-4 flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_-5px_var(--color-blue-600)]"
          >
            <Mail size={20} /> Send/Resend Invites
          </Link>

          <Link
            href="/admin/dashboard"
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full px-8 py-4 flex items-center justify-center gap-3 transition-all border border-white/10"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
