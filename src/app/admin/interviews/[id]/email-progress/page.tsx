'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Mail, RefreshCw } from 'lucide-react';
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
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-blue-400" size={48} />
          <p className="text-slate-400">Loading progress...</p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white/5 border border-white/10 rounded-3xl p-8">
          <Mail size={48} className="mx-auto mb-4 text-slate-500" />
          <h2 className="text-xl font-bold text-white mb-2">No Progress Data</h2>
          <p className="text-slate-400 mb-6">No email sending progress found. Please send invites first.</p>
          <Link
            href={`/admin/interviews/${interviewId}/send-email`}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-full transition-colors"
          >
            <Mail size={18} /> Send Invites
          </Link>
        </div>
      </div>
    );
  }

  const successRate = Math.round((progress.sent / progress.total) * 100);

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Email Sending Progress</h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="text-slate-400 text-sm mb-1">Total</div>
            <div className="text-3xl font-bold text-white">{progress.total}</div>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6">
            <div className="text-green-400 text-sm mb-1 flex items-center gap-2">
              <CheckCircle size={16} /> Sent
            </div>
            <div className="text-3xl font-bold text-green-400">{progress.sent}</div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
            <div className="text-red-400 text-sm mb-1 flex items-center gap-2">
              <XCircle size={16} /> Failed
            </div>
            <div className="text-3xl font-bold text-red-400">{progress.failed}</div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
            <div className="text-blue-400 text-sm mb-1">Success Rate</div>
            <div className="text-3xl font-bold text-blue-400">{successRate}%</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Overall Progress</span>
            <span className="text-sm text-slate-400">{progress.sent} / {progress.total}</span>
          </div>
          <div className="h-4 bg-black/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        {/* Detailed Results */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Mail size={20} className="text-blue-400" /> Detailed Results
            </h2>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-medium text-slate-400">Status</th>
                  <th className="px-6 py-4 font-medium text-slate-400">Email</th>
                  <th className="px-6 py-4 font-medium text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {progress.results.map((result, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="px-6 py-4">
                      {result.success ? (
                        <span className="inline-flex items-center gap-2 text-green-400">
                          <CheckCircle size={16} /> Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-red-400">
                          <XCircle size={16} /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-white">{result.email}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {result.success ? (
                        <span className="text-slate-500">Delivered successfully</span>
                      ) : (
                        <span className="text-red-400 text-xs">{result.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button
            onClick={handleViewStatus}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full px-8 py-4 flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_-5px_var(--color-blue-600)]"
          >
            <RefreshCw size={20} /> View Interview Status
          </button>

          <Link
            href={`/admin/interviews/${interviewId}/send-email`}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full px-8 py-4 flex items-center justify-center gap-3 transition-all border border-white/10"
          >
            <Mail size={20} /> Resend Failed
          </Link>
        </div>
      </div>
    </div>
  );
}
