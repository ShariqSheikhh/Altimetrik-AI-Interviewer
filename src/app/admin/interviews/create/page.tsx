'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import * as ExcelJS from 'exceljs';
import { Upload, Plus, FileSpreadsheet, Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function CreateTest() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<{ sl_no?: number, category?: string, question: string, answer: string, key_points: string[], follow_up_depth?: number }[]>([{ question: '', answer: '', key_points: [], follow_up_depth: 2 }]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        setError('No worksheet found in Excel file.');
        return;
      }

      // Helper: ExcelJS returns hyperlinked cells (like emails) as objects
      // e.g. { text: 'user@email.com', hyperlink: 'mailto:user@email.com' }
      const getCellText = (cellValue: any): string => {
        if (!cellValue) return '';
        if (typeof cellValue === 'string') return cellValue.trim();
        if (typeof cellValue === 'object' && cellValue.text) return String(cellValue.text).trim();
        if (typeof cellValue === 'object' && cellValue.result) return String(cellValue.result).trim();
        return String(cellValue).trim();
      };

      const parsed: any[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        const name = getCellText(row.getCell(1).value);
        const email = getCellText(row.getCell(2).value);
        if (email) {
          parsed.push({
            email,
            name: name || 'Candidate',
            passkey: Math.random().toString(36).slice(-8).toUpperCase()
          });
        }
      });

      setCandidates(parsed.filter(c => c.email));
    } catch (err) {
      setError('Failed to parse Excel file. Ensure it has Name and Email columns.');
    }
  };

  const handleQuestionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        setError('No worksheet found in Excel file.');
        return;
      }

      const parsed: any[] = [];
      let headerMap: Record<number, string> = {};

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          // Build header map: colNumber → normalized header name
          row.eachCell((cell, colNumber) => {
            headerMap[colNumber] = String(cell.value || '').toLowerCase().trim();
          });
          return;
        }

        // Helper to get cell value by header name
        const getCol = (name: string) => {
          const col = Object.entries(headerMap).find(([_, v]) => v === name)?.[0];
          return col ? String(row.getCell(Number(col)).value ?? '').trim() : '';
        };

        const question = getCol('question');
        if (!question) return;

        // Collect up to 5 coverage points from separate columns
        const keyPoints: string[] = [];
        for (let n = 1; n <= 5; n++) {
          // Matches: "coverage point 1", "coverage point1", "coveragepoint1"
          const colEntry = Object.entries(headerMap).find(([_, v]) =>
            v === `coverage point ${n}` || v === `coverage point${n}` || v === `coveragepoint${n}`
          );
          if (colEntry) {
            const val = String(row.getCell(Number(colEntry[0])).value ?? '').trim();
            if (val) keyPoints.push(val);
          }
        }

        // Fallback: if no coverage point columns found, try KeyPoints (semicolon-separated)
        if (keyPoints.length === 0) {
          const kpCol = Object.entries(headerMap).find(([_, v]) =>
            v === 'keypoints' || v === 'key_points' || v === 'key points'
          )?.[0];
          if (kpCol) {
            const raw = String(row.getCell(Number(kpCol)).value ?? '');
            raw.split(';').map(k => k.trim()).filter(Boolean).forEach(k => keyPoints.push(k));
          }
        }

        const category = getCol('category');
        const slNoRaw = getCol('sl no') || getCol('sl.no') || getCol('slno') || getCol('s.no') || getCol('sno');
        const followUpDepthRaw = getCol('follow_up_depth') || getCol('follow up depth') || getCol('followupdepth');

        parsed.push({
          sl_no: slNoRaw ? Number(slNoRaw) : undefined,
          category: category || undefined,
          question,
          answer: getCol('answer'), // optional, may be empty
          key_points: keyPoints,
          follow_up_depth: followUpDepthRaw ? Number(followUpDepthRaw) : 2,
        });
      });

      if (parsed.length > 0) {
        if (questions.length === 1 && !questions[0].question) {
          setQuestions(parsed);
        } else {
          setQuestions([...questions, ...parsed]);
        }
        setError('');
      } else {
        setError('No questions found. Ensure the sheet has a "Question" column and at least one "Coverage point" column.');
      }
    } catch (err) {
      setError('Failed to parse Excel file. Check the column structure and try again.');
    }
  };

  const handleSave = async () => {
    if (!title) return setError('Title is required');
    if (questions.some(q => !q.question.trim())) return setError('All questions must be filled');
    if (candidates.length === 0) return setError('At least one candidate is required from Excel');

    setLoading(true);
    setError('');

    try {
      // 1. Create Interview
      const { data: interview, error: iError } = await supabase
        .from('interviews')
        .insert([{ title, question_bank: questions }])
        .select()
        .single();

      if (iError || !interview) throw iError || new Error('Failed to create interview');

      // 2. Add Candidates
      const candidatesToInsert = candidates.map(c => ({
        ...c,
        interview_id: interview.id,
        is_allowed: true
      }));

      const { error: cError } = await supabase
        .from('candidates')
        .insert(candidatesToInsert);

      if (cError) throw cError;

      // Redirect to send email page
      router.push(`/admin/interviews/${interview.id}/send-email`);
    } catch (err: any) {
      setError(err.message || 'Error saving test');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-8 selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Create New Interview</h1>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl mb-6">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {/* General Details */}
          <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-6">General Details</h2>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Interview Title / Role</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g. Senior Frontend Engineer"
              />
            </div>
          </div>

          {/* Question Bank */}
          <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Question Bank</h2>

              <div className="flex items-center gap-3">
                <label className="cursor-pointer bg-black/50 hover:bg-black border border-white/10 hover:border-blue-500 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shrink-0">
                  <FileSpreadsheet className="text-blue-400" size={16} />
                  <span className="font-medium text-sm text-slate-300">Upload Excel</span>
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleQuestionUpload} />
                </label>

                <button
                  onClick={() => setQuestions([...questions, { question: '', answer: '', key_points: [], follow_up_depth: 2 }])}
                  className="text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-4">Upload an Excel file (.xlsx) with columns: <span className="text-white font-medium">Sl No, Category, Question, Coverage point 1–5, follow_up_depth</span>. Coverage points are read from separate columns automatically.</p>
            <div className="overflow-x-auto border border-white/10 rounded-2xl bg-black/30 pb-2">
              <table className="w-full text-left text-sm min-w-[1000px]">
                <thead className="bg-[#111827] border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 font-medium text-slate-400 w-12 text-center border-r border-white/5">#</th>
                    <th className="px-4 py-3 font-medium text-slate-400 w-48 border-r border-white/5">Category</th>
                    <th className="px-4 py-3 font-medium text-slate-400 min-w-[300px] border-r border-white/5">Question</th>
                    <th className="px-4 py-3 font-medium text-slate-400 min-w-[250px] border-r border-white/5">Coverage Points</th>
                    <th className="px-4 py-3 font-medium text-slate-400 w-32 border-r border-white/5">Depth</th>
                    <th className="px-4 py-3 font-medium text-slate-400 w-12 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {questions.map((q, i) => (
                    <tr key={i} className="hover:bg-white/5 group transition-colors">
                      <td className="px-4 py-3 text-center text-slate-500 font-medium border-r border-white/5 bg-black/20">
                        {q.sl_no || i + 1}
                      </td>
                      <td className="p-0 border-r border-white/5 relative">
                        <input
                          type="text"
                          value={q.category || ''}
                          onChange={(e) => {
                            const newQ = [...questions];
                            newQ[i] = { ...newQ[i], category: e.target.value };
                            setQuestions(newQ);
                          }}
                          className="w-full h-full min-h-[60px] bg-transparent border-none px-4 py-3 text-white focus:outline-none focus:ring-2 ring-inset ring-blue-500 transition-all font-medium"
                          placeholder="Category"
                        />
                      </td>
                      <td className="p-0 border-r border-white/5 relative">
                        <textarea
                          value={q.question}
                          onChange={(e) => {
                            const newQ = [...questions];
                            newQ[i] = { ...newQ[i], question: e.target.value };
                            setQuestions(newQ);
                          }}
                          className="w-full h-full min-h-[60px] bg-transparent border-none px-4 py-3 text-white focus:outline-none focus:ring-2 ring-inset ring-blue-500 transition-all resize-none"
                          placeholder="Question..."
                        />
                      </td>
                      <td className="p-0 border-r border-white/5 relative">
                        <textarea
                          value={q.key_points.join('; ')}
                          onChange={(e) => {
                            const newQ = [...questions];
                            newQ[i] = { ...newQ[i], key_points: e.target.value.split(';').map(kp => kp.trim()).filter(kp => kp) };
                            setQuestions(newQ);
                          }}
                          className="w-full h-full min-h-[60px] bg-transparent border-none px-4 py-3 text-amber-300/90 focus:outline-none focus:ring-2 ring-inset ring-amber-500 transition-all resize-none"
                          placeholder="Point 1; Point 2; Point 3..."
                        />
                      </td>
                      <td className="p-0 border-r border-white/5 relative">
                        <input
                          type="number"
                          min="0"
                          max="5"
                          value={q.follow_up_depth === undefined ? 2 : q.follow_up_depth}
                          onChange={(e) => {
                            const newQ = [...questions];
                            newQ[i] = { ...newQ[i], follow_up_depth: parseInt(e.target.value) || 0 };
                            setQuestions(newQ);
                          }}
                          className="w-full h-full min-h-[60px] bg-transparent border-none px-4 py-3 text-white focus:outline-none focus:ring-2 ring-inset ring-blue-500 transition-all text-center"
                        />
                      </td>
                      <td className="p-2 text-center bg-black/10">
                        {questions.length > 1 && (
                          <button
                            onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))}
                            className="p-2 w-full flex justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete Row"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Candidates Excel Upload */}
          <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Allowed Candidates</h2>
                <p className="text-sm text-slate-400">Upload an Excel file (.xlsx) with columns: Name, Email.</p>
              </div>
              <label className="cursor-pointer bg-black/50 hover:bg-black border border-white/10 hover:border-blue-500 px-6 py-4 rounded-2xl flex items-center gap-3 transition-colors shrink-0">
                <FileSpreadsheet className="text-blue-400" size={24} />
                <span className="font-medium text-sm">Select Excel File</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            {candidates.length > 0 && (
              <div className="mt-8">
                <div className="text-sm font-medium mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Loaded {candidates.length} candidates
                </div>
                <div className="max-h-64 overflow-y-auto border border-white/5 rounded-xl bg-black/30">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-medium text-slate-400">Name</th>
                        <th className="px-4 py-3 font-medium text-slate-400">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {candidates.map((c, i) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="px-4 py-3">{c.name}</td>
                          <td className="px-4 py-3 text-slate-400">{c.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full px-10 py-4 flex items-center gap-3 transition-all shadow-[0_0_30px_-5px_var(--color-blue-600)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><Upload size={20} /> Create Test & Send Invites</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
