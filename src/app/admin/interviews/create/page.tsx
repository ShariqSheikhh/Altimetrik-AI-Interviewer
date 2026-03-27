'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Upload, Plus, FileSpreadsheet, Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function CreateTest() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<{question: string, answer: string}[]>([{question: '', answer: ''}]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        // Assume Excel has headers: Email, Name
        const parsed = json.map(row => ({
          email: row.Email || row.email,
          name: row.Name || row.name || 'Candidate',
          // Generate a passkey
          passkey: Math.random().toString(36).slice(-8).toUpperCase()
        })).filter(c => c.email);
        
        setCandidates(parsed);
      } catch (err) {
        setError('Failed to parse Excel file. Ensure it has Email columns.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleQuestionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Assume Excel has headers: Question, Answer
        const parsed = json.map(row => ({
          question: row.Question || row.question || '',
          answer: row.Answer || row.answer || ''
        })).filter(q => q.question.trim());

        if (parsed.length > 0) {
          if (questions.length === 1 && !questions[0].question) {
            setQuestions(parsed);
          } else {
            setQuestions([...questions, ...parsed]);
          }
        }
      } catch (err) {
        setError('Failed to parse Excel file. Ensure it has Question and Answer columns.');
      }
    };
    reader.readAsArrayBuffer(file);
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

      // Automatically download the passkeys list for the recruiter
      const ws = XLSX.utils.json_to_sheet(candidatesToInsert.map(c => ({
        Name: c.name,
        Email: c.email,
        Passkey: c.passkey,
        LoginLink: window.location.origin + '/candidate/login'
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Candidates");
      XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_Credentials.xlsx`);

      router.push('/admin/dashboard');
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
                  onClick={() => setQuestions([...questions, {question: '', answer: ''}])}
                  className="text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Plus size={16} /> Add 
                </button>
              </div>
            </div>
            
            <p className="text-sm text-slate-400 mb-4">Upload an Excel file (.xlsx) with columns: Question, Answer.</p>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-8 h-10 mt-1 flex items-center justify-center shrink-0 bg-white/5 rounded-lg text-slate-500 font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={q.question}
                      onChange={(e) => {
                        const newQ = [...questions];
                        newQ[i] = { ...newQ[i], question: e.target.value };
                        setQuestions(newQ);
                      }}
                      rows={2}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Enter interview question..."
                    />
                    <textarea
                      value={q.answer}
                      onChange={(e) => {
                        const newQ = [...questions];
                        newQ[i] = { ...newQ[i], answer: e.target.value };
                        setQuestions(newQ);
                      }}
                      rows={2}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-green-500 transition-colors"
                      placeholder="Enter expected answer..."
                    />
                  </div>
                  {questions.length > 1 && (
                    <button 
                      onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))}
                      className="p-3 mt-1 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors text-slate-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Candidates Excel Upload */}
          <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Allowed Candidates</h2>
                <p className="text-sm text-slate-400">Upload an Excel file (.xlsx) with columns: Email, Name.</p>
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
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><Upload size={20} /> Create Test & Export Keys</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
