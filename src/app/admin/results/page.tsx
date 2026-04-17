'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, ArrowRight, Loader2, Calendar, User, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function AllResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      const { data, error } = await supabase
        .from('results')
        .select('*, candidates(name, email), interviews(title)')
        .order('created_at', { ascending: false });
      
      if (data) setResults(data);
      setLoading(false);
    };
    
    fetchResults();
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
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Assessment Results</h1>
          <p className="text-slate-500 font-medium tracking-tight">Full historical archive of candidate evaluations and performance metrics.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        {results.length === 0 ? (
          <div className="p-32 text-center flex flex-col items-center">
            <FileText size={64} className="text-slate-100 mb-6" />
            <h3 className="text-xl font-black text-slate-900 mb-2">No Results Processed</h3>
            <p className="text-slate-500 font-medium mb-8">Completed candidate evaluations will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Candidate Profile</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Test Identity</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Timestamp</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recommendation</th>
                  <th className="px-10 py-6 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {results.map((res) => (
                  <tr key={res.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-10 py-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black group-hover:bg-blue-600 group-hover:text-white transition-all">
                                {res.candidates?.name?.charAt(0) || 'C'}
                            </div>
                            <div>
                                <div className="font-black text-slate-900 leading-none uppercase tracking-tight">{res.candidates?.name || 'Anonymous User'}</div>
                                <div className="text-[11px] text-slate-400 font-bold mt-1.5 uppercase tracking-widest">{res.candidates?.email}</div>
                            </div>
                        </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="font-black text-slate-600 text-sm tracking-tight">{res.interviews?.title}</div>
                    </td>
                    <td className="px-10 py-8">
                        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                            <Calendar size={14} className="text-slate-300" />
                            {new Date(res.created_at).toLocaleDateString()}
                        </div>
                    </td>
                    <td className="px-10 py-8">
                        {(res.evaluation?.score !== undefined && res.evaluation?.score !== null) ? (
                            <div className={`inline-flex items-center px-4 py-2 rounded-2xl text-xs font-black tracking-widest uppercase border shadow-sm ${
                                res.evaluation.score > 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                res.evaluation.score < 50 ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                                {res.evaluation.score > 80 ? 'Accept' : res.evaluation.score < 50 ? 'Reject' : 'Human Eval'} ({res.evaluation.score}%)
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100">
                                <Loader2 size={12} className="animate-spin" /> Analyzing
                            </div>
                        )}
                    </td>
                    <td className="px-10 py-8 text-right">
                      <Link 
                        href={`/admin/results/${res.id}`}
                        className="w-12 h-12 bg-white border border-slate-200 hover:border-blue-500 hover:shadow-lg rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all active:scale-95"
                      >
                        <ArrowRight size={20} />
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
