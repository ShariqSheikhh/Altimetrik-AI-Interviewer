'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Mail, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function EmailProgressPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;

  const [progress, setProgress] = useState<{
    total: number;
    sent: number;
    failed: number;
    results: Array<{ email: string; success: boolean; error?: string }>;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('emailProgress');
    if (stored) {
      try {
        setProgress(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse progress data');
      }
    }
    setLoading(false);
  }, []);

  const handleViewStatus = () => {
    router.push(`/admin/interviews/${interviewId}/status`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center p-10 font-sans">
        <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-[2.5rem] p-12 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
             <Mail size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">No Active Dispatch</h2>
          <p className="text-slate-500 font-medium mb-8">We couldn't find any recent email broadcast data for this session.</p>
          <Link
            href={`/admin/interviews/${interviewId}/send-email`}
            className="w-full inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <Send size={18} /> Initialize Dispatch
          </Link>
        </div>
      </div>
    );
  }

  const successRate = Math.round((progress.sent / progress.total) * 100);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-6">
        <Link href="/admin/dashboard" className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm">
          <ArrowLeft size={20} />
        </Link>
        <div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dispatch Report</h1>
           <p className="text-slate-500 font-medium">Monitoring the status of your invitation broadcast.</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total Batch</p>
             <div className="text-3xl font-black text-slate-900">{progress.total}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2rem] shadow-sm">
             <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Successfully Sent</p>
             <div className="text-3xl font-black text-emerald-700">{progress.sent}</div>
          </div>
          <div className="bg-red-50 border border-red-100 p-8 rounded-[2rem] shadow-sm">
             <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3">Delivery Failures</p>
             <div className="text-3xl font-black text-red-700">{progress.failed}</div>
          </div>
          <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Success Index</p>
             <div className="text-3xl font-black">{successRate}%</div>
          </div>
      </div>

      {/* Overall Progress */}
      <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
          <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  Transmission Analytics
              </h2>
              <span className="text-sm font-black text-slate-900">{progress.sent} of {progress.total} Completed</span>
          </div>
          <div className="h-6 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-200/50 shadow-inner">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
              style={{ width: `${successRate}%` }}
            />
          </div>
      </section>

      {/* Detailed Table */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Individual Logs</h2>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/20">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transmission Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipient</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Server Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white font-sans">
                {progress.results.map((result, i) => (
                  <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      {result.success ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100/50">
                           <CheckCircle size={14} /> Delivered
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100/50">
                           <XCircle size={14} /> Rejection
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-5">
                        <p className="font-black text-slate-900 leading-none">{result.email}</p>
                    </td>
                    <td className="px-8 py-5">
                      {result.success ? (
                        <p className="text-xs text-slate-400 font-medium tracking-tight italic">200 OK: Broadcast Successful</p>
                      ) : (
                        <p className="text-xs text-red-500 font-bold tracking-tight">{result.error}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>

      {/* Final Actions */}
      <div className="flex flex-col md:flex-row gap-6 items-center justify-center pt-8">
          <button
            onClick={handleViewStatus}
            className="bg-slate-900 hover:bg-black text-white font-black text-sm rounded-2xl px-12 py-5 flex items-center gap-3 transition-all shadow-xl active:scale-95"
          >
            <RefreshCw size={18} /> Master Status Console
          </button>

          <Link
            href={`/admin/interviews/${interviewId}/send-email`}
            className="bg-white border border-slate-200 hover:border-blue-500 text-slate-600 font-bold text-sm px-10 py-5 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center gap-2"
          >
            <Send size={18} className="text-blue-500" /> Resubmit Failed Batches
          </Link>
      </div>
    </div>
  );
}
