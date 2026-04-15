'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Users, ArrowRight, FolderClosed, Loader2, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function AllInterviewsPage() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInterviews = async () => {
      // Fetch interviews and then fetch results to count engagements
      const [interviewsRes, resultsRes] = await Promise.all([
        supabase.from('interviews').select('*').order('created_at', { ascending: false }),
        supabase.from('results').select('interview_id')
      ]);
      
      if (interviewsRes.data) {
        const interviewData = interviewsRes.data.map(inv => {
          // Count results that belong to this interview
          const engagementCount = resultsRes.data?.filter(r => r.interview_id === inv.id).length || 0;
          return {
            ...inv,
            engagementCount
          };
        });
        setInterviews(interviewData);
      }
      setLoading(false);
    };
    
    fetchInterviews();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Assessment Tests</h1>
          <p className="text-slate-500 font-medium tracking-tight">Manage and track all interview configurations across the organization.</p>
        </div>
        <Link 
            href="/admin/interviews/create"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
        >
            <Plus size={20} strokeWidth={3} />
            Create New Test
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        {interviews.length === 0 ? (
          <div className="p-32 text-center flex flex-col items-center">
            <FileText size={64} className="text-slate-100 mb-6" />
            <h3 className="text-xl font-black text-slate-900 mb-2">No Assessments Found</h3>
            <p className="text-slate-500 font-medium mb-8">You haven't created any interview tests yet.</p>
            <Link href="/admin/interviews/create" className="text-blue-600 font-bold hover:underline">Create your first test</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Context / Role</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Created Date</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No of Questions</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Engagement</th>
                  <th className="px-10 py-6 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {interviews.map((inv) => (
                  <tr key={inv.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-10 py-8">
                       <div className="font-black text-slate-900 text-lg leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight">{inv.title}</div>
                       <div className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          Authorized
                       </div>
                    </td>
                    <td className="px-10 py-8">
                        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                            <Calendar size={16} className="text-slate-300" />
                            {new Date(inv.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                        </div>
                    </td>
                    <td className="px-10 py-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-slate-600 font-black text-[10px] uppercase tracking-widest border border-slate-200 shadow-sm">
                            <CheckCircle2 size={14} className="text-blue-500" />
                            {inv.question_bank?.length || 0} Questions
                        </div>
                    </td>
                    <td className="px-10 py-8">
                        <div className="flex items-center gap-2 text-slate-700 font-black">
                            <Users size={18} className="text-blue-500" />
                            <span className="text-xl tracking-tight">{inv.engagementCount}</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest ml-1 font-bold">Attended</span>
                        </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <Link 
                        href={`/admin/interviews/${inv.id}/status`}
                        className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95"
                      >
                        Manage <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
