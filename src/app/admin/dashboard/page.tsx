'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, Users, Search, FolderClosed, ArrowRight, ShieldCheck, Video, LayoutDashboard, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // For MVP, just fetch everything
      const [interviewsRes, resultsRes] = await Promise.all([
        supabase.from('interviews').select('*').order('created_at', { ascending: false }),
        supabase.from('results').select('*, candidates(name, email), interviews(title)').order('created_at', { ascending: false })
      ]);
      
      if (interviewsRes.data) setInterviews(interviewsRes.data);
      if (resultsRes.data) setResults(resultsRes.data);
      setLoading(false);
    };
    
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white">
      {/* Navbar */}
      <nav className="border-b border-white/10 bg-black/50 p-4 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 text-blue-400 p-2 rounded-xl border border-blue-500/30">
              <LayoutDashboard size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight">Admin Portal</span>
          </div>
          <Link 
            href="/admin/interviews/create"
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full font-semibold flex items-center gap-2 text-sm transition-all shadow-[0_0_20px_-5px_var(--color-blue-600)]"
          >
            <Plus size={16} strokeWidth={3} /> Create Test
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-12">
        
        {/* Recent Evaluations */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck size={24} className="text-blue-400" /> Recent Evaluations
            </h2>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-500 animate-pulse">Loading data...</div>
            ) : results.length === 0 ? (
              <div className="p-16 text-center text-slate-500 flex flex-col items-center">
                <FolderClosed size={48} className="mb-4 opacity-50" />
                <p>No evaluations recorded yet.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-black/50 text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">Candidate</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">Interview</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">AI Score</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">Date</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {results.map((res) => (
                    <tr key={res.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{res.candidates?.name || 'Unknown'}</div>
                        <div className="text-slate-500 mt-0.5 text-xs">{res.candidates?.email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {res.interviews?.title || 'Unknown Test'}
                      </td>
                      <td className="px-6 py-4">
                        {res.evaluation?.score ? (
                          <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            res.evaluation.score >= 80 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                            res.evaluation.score >= 50 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {res.evaluation.score}/100
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(res.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/admin/results/${res.id}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full text-xs font-medium transition-colors border border-white/10"
                        >
                          <Video size={14} /> Review <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Active Tests */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Users size={24} className="text-blue-400" /> Active Interview Links
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[480px] overflow-y-auto">
            {interviews.map(inv => (
              <div key={inv.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 relative group hover:bg-white/10 transition-colors">
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_var(--color-green-500)]" />
                <h3 className="text-lg font-bold text-white mb-2">{inv.title}</h3>
                <p className="text-sm text-slate-400 mb-6">{inv.question_bank.length} Questions Configured</p>
                <div className="text-xs text-slate-500 border-t border-white/10 pt-4 mt-auto flex items-center justify-between">
                  <span>Created {new Date(inv.created_at).toLocaleDateString()}</span>
                  <Link
                    href={`/admin/interviews/${inv.id}/status`}
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-medium"
                  >
                    <BarChart3 size={14} /> View Status
                  </Link>
                </div>
              </div>
            ))}
            {interviews.length === 0 && !loading && (
              <div className="col-span-3 text-slate-500 text-center p-8 bg-white/5 rounded-3xl border border-white/10 border-dashed">
                No active tests found. Create one to get started.
              </div>
            )}
          </div>
        </section>
        
      </main>
    </div>
  );
}
