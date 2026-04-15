'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import * as ExcelJS from 'exceljs';
import { Upload, Plus, FileSpreadsheet, Loader2, ArrowLeft, Trash2, ShieldCheck, GraduationCap, Users } from 'lucide-react';
import Link from 'next/link';

export default function CreateTest() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<{sl_no?: number, category?: string, question: string, answer: string, key_points: string[], follow_up_depth?: number}[]>([{question: '', answer: '', key_points: [], follow_up_depth: 2}]);
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
          row.eachCell((cell, colNumber) => {
            headerMap[colNumber] = String(cell.value || '').toLowerCase().trim();
          });
          return;
        }

        const getCol = (name: string) => {
          const col = Object.entries(headerMap).find(([_, v]) => v === name)?.[0];
          return col ? String(row.getCell(Number(col)).value ?? '').trim() : '';
        };

        const question = getCol('question');
        if (!question) return;

        const keyPoints: string[] = [];
        for (let n = 1; n <= 5; n++) {
          const colEntry = Object.entries(headerMap).find(([_, v]) =>
            v === `coverage point ${n}` || v === `coverage point${n}` || v === `coveragepoint${n}`
          );
          if (colEntry) {
            const val = String(row.getCell(Number(colEntry[0])).value ?? '').trim();
            if (val) keyPoints.push(val);
          }
        }

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
          answer: getCol('answer'), 
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
      const { data: interview, error: iError } = await supabase
        .from('interviews')
        .insert([{
          title,
          question_bank: questions
        }])
        .select()
        .single();
        
      if (iError || !interview) throw iError || new Error('Failed to create interview');

      const candidatesToInsert = candidates.map(c => ({
        ...c,
        interview_id: interview.id,
        is_allowed: true
      }));

      const { error: cError } = await supabase
        .from('candidates')
        .insert(candidatesToInsert);

      if (cError) throw cError;

      router.push(`/admin/interviews/${interview.id}/send-email`);
    } catch (err: any) {
      setError(err.message || 'Error saving test');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin/dashboard" className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Create Assessment</h1>
            <p className="text-slate-500 font-medium">Design your custom interview flow and invite candidates.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-2xl font-bold flex items-center gap-3 animate-in shake duration-300">
           <Trash2 size={20} />
           {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-10">
        {/* Title Section */}
        <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <GraduationCap size={120} />
            </div>
            <h2 className="text-xl font-bold mb-8 text-slate-900 flex items-center gap-3">
               <ShieldCheck size={24} className="text-blue-500" />
               Interview Identity
            </h2>
            <div className="max-w-2xl">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Assessment Title / Role Name</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold text-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-all outline-none shadow-sm"
                placeholder="e.g. Senior Frontend Engineer"
              />
            </div>
        </section>

        {/* Question Bank Section */}
        <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                   <Plus size={24} className="text-blue-500" />
                   Question Bank
                </h2>
                
                <div className="flex items-center gap-3">
                    <label className="cursor-pointer bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-500 px-6 py-3 rounded-[1.25rem] flex items-center gap-3 transition-all active:scale-95 shadow-sm">
                        <FileSpreadsheet className="text-emerald-500" size={20} />
                        <span className="font-bold text-sm text-slate-600">Import Excel</span>
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleQuestionUpload} />
                    </label>

                    <button 
                        onClick={() => setQuestions([...questions, {question: '', answer: '', key_points: [], follow_up_depth: 2}])}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-[1.25rem] font-bold text-sm shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={18} /> New Question
                    </button>
                </div>
            </div>
            
            <div className="space-y-6">
                {questions.map((q, i) => (
                    <div key={i} className="group relative p-8 bg-slate-50 border border-slate-100 rounded-[2rem] hover:border-blue-100 hover:bg-blue-50/10 transition-all">
                        <div className="absolute -left-4 top-8 w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400 text-xs shadow-sm transition-transform group-hover:scale-110">
                            {i + 1}
                        </div>
                        
                        <div className="space-y-6 ml-4">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Interview Question</label>
                                <textarea
                                    value={q.question}
                                    onChange={(e) => {
                                        const newQ = [...questions];
                                        newQ[i] = { ...newQ[i], question: e.target.value };
                                        setQuestions(newQ);
                                    }}
                                    rows={2}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:outline-none focus:border-blue-500 transition-all outline-none"
                                    placeholder="What do you want to ask?"
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ideal Model Answer</label>
                                    <textarea
                                        value={q.answer}
                                        onChange={(e) => {
                                            const newQ = [...questions];
                                            newQ[i] = { ...newQ[i], answer: e.target.value };
                                            setQuestions(newQ);
                                        }}
                                        rows={2}
                                        className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-600 text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all outline-none"
                                        placeholder="The benchmark answer..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Critical Key Points (Semicolon separated)</label>
                                    <textarea
                                        value={q.key_points.join('; ')}
                                        onChange={(e) => {
                                            const newQ = [...questions];
                                            newQ[i] = { ...newQ[i], key_points: e.target.value.split(';').map(kp => kp.trim()).filter(kp => kp) };
                                            setQuestions(newQ);
                                        }}
                                        rows={2}
                                        className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-600 text-sm font-medium focus:outline-none focus:border-orange-500 transition-all outline-none"
                                        placeholder="REST; Stateless; Scalable..."
                                    />
                                </div>
                            </div>
                        </div>

                        {questions.length > 1 && (
                            <button 
                                onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))}
                                className="absolute -right-4 top-8 w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 hover:shadow-lg transition-all"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </section>

        {/* Candidates Section */}
        <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <Users size={120} />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
                <div>
                   <h2 className="text-xl font-bold mb-1 text-slate-900 flex items-center gap-3">
                      <Users size={24} className="text-blue-500" />
                      Candidate Invites
                   </h2>
                   <p className="text-sm text-slate-500 font-medium">Upload Excel with <span className="text-slate-900 font-bold">Name</span> and <span className="text-slate-900 font-bold">Email</span> columns.</p>
                </div>
                <label className="cursor-pointer bg-slate-900 hover:bg-black px-8 py-4 rounded-2xl flex items-center gap-3 transition-all active:scale-95 shadow-xl text-white">
                    <Upload size={20} />
                    <span className="font-bold text-sm">Upload Candidates</span>
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                </label>
            </div>

            {candidates.length > 0 && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl w-fit text-xs font-black uppercase tracking-widest border border-emerald-100">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {candidates.length} Profiles Ready
                </div>
                <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Name</th>
                        <th className="px-6 py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Email Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      {candidates.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{c.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </section>

        <div className="flex justify-center pt-8">
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-[2rem] px-16 py-6 flex items-center gap-4 transition-all shadow-2xl shadow-blue-600/30 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : <>Initialize Assessment & Notify Teams</>}
          </button>
        </div>
      </div>
    </div>
  );
}
