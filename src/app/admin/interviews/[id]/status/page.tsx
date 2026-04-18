'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle, Clock, XCircle, Users, Mail, BarChart3, Loader2, RefreshCw, GraduationCap, ArrowRight, Filter, Download } from 'lucide-react';
import * as ExcelJS from 'exceljs';
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
  const [filterStatus, setFilterStatus] = useState('all');

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

  const filteredCandidates = candidates.filter((candidate) => {
    if (filterStatus === 'all') return true;
    
    const score = candidate.result?.evaluation?.score;
    const hasResult = score !== undefined && score !== null;

    if (filterStatus === 'accept') return hasResult && score > 80;
    if (filterStatus === 'reject') return hasResult && score < 50;
    if (filterStatus === 'human_eval') return hasResult && score >= 50 && score <= 80;
    if (filterStatus === 'no_result') return !hasResult;
    
    return true;
  });

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Enrollment Results');

    worksheet.columns = [
        { header: 'Candidate ID', key: 'id', width: 36 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Email ID', key: 'email', width: 30 },
        { header: 'Passkey', key: 'passkey', width: 15 },
        { header: 'Score Obtained', key: 'score', width: 15 },
        { header: 'Evaluation Result', key: 'evaluation', width: 20 },
        { header: 'Results Page', key: 'link', width: 70 }
    ];

    filteredCandidates.forEach(candidate => {
        const score = candidate.result?.evaluation?.score;
        const evaluation = (score !== undefined && score !== null)
            ? (score > 80 ? 'Accept' : score < 50 ? 'Reject' : 'Human Eval')
            : 'No Result Yet';
        
        const link = candidate.result?.id 
            ? `${window.location.origin}/admin/results/${candidate.result.id}`
            : 'N/A';

        worksheet.addRow({
            id: candidate.id,
            name: candidate.name || 'Anonymous',
            email: candidate.email,
            passkey: candidate.passkey,
            score: score !== undefined && score !== null ? `${score}%` : 'N/A',
            evaluation: evaluation,
            link: link
        });
    });

    // Styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' } // Slate-800
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${interview?.title || 'Interview'}_Candidates_Report.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
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
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  Live Enrollment List
              </h2>
              
              <div className="flex items-center gap-3">
                  <button
                      onClick={handleExportExcel}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 text-[11px] font-black uppercase tracking-wider"
                  >
                      <Download size={14} />
                      Export Excel
                  </button>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-200 transition-colors">
                      <Filter size={14} className="text-slate-400" />
                      <select 
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="text-[11px] font-black uppercase tracking-wider text-slate-600 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                      >
                          <option value="all">Default / All</option>
                          <option value="accept">Pass / Accept</option>
                          <option value="reject">Reject</option>
                          <option value="human_eval">Human Eval</option>
                          <option value="no_result">No Result Yet</option>
                      </select>
                  </div>
              </div>
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
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                             <Filter size={32} className="mb-4 opacity-20" />
                             <p className="text-sm font-bold">No candidates match this filter.</p>
                             <button 
                                onClick={() => setFilterStatus('all')}
                                className="mt-2 text-blue-500 text-xs font-black uppercase tracking-widest hover:underline"
                             >
                                Clear Filter
                             </button>
                        </div>
                    </td>
                  </tr>
                ) : filteredCandidates.map((candidate) => (
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
