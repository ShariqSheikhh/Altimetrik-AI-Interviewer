'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, Users, ShieldCheck, Video, ArrowRight, FolderClosed, BarChart3, Clock, TrendingUp, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
    const router = useRouter();
    const [interviews, setInterviews] = useState<any[]>([]);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const [interviewsRes, resultsRes, candidatesRes] = await Promise.all([
                supabase.from('interviews').select('*').order('created_at', { ascending: false }),
                supabase.from('results').select('*, candidates(name, email), interviews(title)').order('created_at', { ascending: false }),
                supabase.from('candidates').select('interview_id')
            ]);

            if (interviewsRes.data) {
                // Calculate candidate count for each interview
                const interviewsWithCount = interviewsRes.data.map(inv => ({
                    ...inv,
                    candidate_count: candidatesRes.data?.filter(c => c.interview_id === inv.id).length || 0
                }));
                setInterviews(interviewsWithCount);
            }
            if (resultsRes.data) setResults(resultsRes.data);
            setLoading(false);
        };

        fetchData();
    }, []);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
                    <p className="text-slate-500 mt-1 font-medium tracking-tight">Altimetrik Assessment Management Portal</p>
                </div>
                <Link
                    href="/admin/interviews/create"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                >
                    <Plus size={20} strokeWidth={3} />
                    Initialize New Assessment
                </Link>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* Recent Evaluations Table */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            Latest Performance Data
                        </h2>
                        <Link href="/admin/results" className="text-xs font-black text-blue-600 hover:text-blue-700 tracking-widest uppercase">View Full Archive</Link>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                        {loading ? (
                            <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={32} /></div>
                        ) : results.length === 0 ? (
                            <div className="p-24 text-center flex flex-col items-center">
                                <FolderClosed size={48} className="text-slate-200 mb-6" />
                                <p className="text-slate-400 font-bold tracking-tight">No evaluation records found yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Candidate Profile</th>
                                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Applied Context</th>
                                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Score</th>
                                            <th className="px-10 py-6 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {results.slice(0, 10).map((res) => (
                                            <tr key={res.id} className="group hover:bg-slate-50/50 transition-all">
                                                <td className="px-10 py-6">
                                                    <div className="font-black text-slate-900 leading-none">{res.candidates?.name || 'N/A'}</div>
                                                    <div className="text-[11px] text-slate-400 font-bold mt-1.5">{res.candidates?.email}</div>
                                                </td>
                                                <td className="px-10 py-6">
                                                    <span className="text-sm font-bold text-slate-600">{res.interviews?.title}</span>
                                                </td>
                                                <td className="px-10 py-6">
                                                    {(res.evaluation?.score !== undefined && res.evaluation?.score !== null) ? (
                                                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${res.evaluation.score >= 70 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                res.evaluation.score >= 50 ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                    'bg-red-50 text-red-600 border-red-100'
                                                            }`}>
                                                            {res.evaluation.score}%
                                                        </div>
                                                    ) : <span className="text-slate-300 italic text-xs font-bold tracking-tight">Analyzing...</span>}
                                                </td>
                                                <td className="px-10 py-6 text-right">
                                                    <Link
                                                        href={`/admin/results/${res.id}`}
                                                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-all group-active:scale-95 shadow-sm"
                                                    >
                                                        <ArrowRight size={18} />
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

                {/* Active Interview Templates Sidebar */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            Live Assessment Flows
                        </h2>
                        <Link href="/admin/interviews" className="text-xs font-black text-emerald-600 hover:text-emerald-700 tracking-widest uppercase">View All</Link>
                    </div>
                    <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                        {interviews.length === 0 ? (
                            <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[2rem]">
                                <p className="text-slate-400 font-bold text-sm italic">No active assessments found.</p>
                            </div>
                        ) : (
                            interviews.map(inv => (
                                <Link key={inv.id} href={`/admin/interviews/${inv.id}/status`} className="block bg-white border border-slate-200 p-8 rounded-[2rem] hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all group relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Active</div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(inv.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">{inv.title}</h3>
                                    <div className="mt-6 flex items-center gap-6">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <Users size={14} className="text-blue-400" />
                                            <span>{inv.candidate_count || 0} Registered</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <FolderClosed size={14} className="text-slate-300" />
                                            <span>{inv.question_bank?.length || 0} Modules</span>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
