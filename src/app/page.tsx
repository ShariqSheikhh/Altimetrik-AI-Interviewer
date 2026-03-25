import Link from "next/link";
import { Mic, Video, Users, ArrowRight, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 lg:px-12 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-500 p-2 rounded-xl">
            <Video size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">AI Interviewer</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">

          <Link href="/candidate/login" className="bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all px-4 py-2 rounded-full flex items-center gap-2">
            Candidate Login <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8">
          <ShieldCheck size={14} /> Next-generation recruitment
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 max-w-4xl text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400 leading-tight pb-2">
          Conduct Intelligent Interviews at Scale
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12">
          Empower your hiring process with AI-driven, guardrail-protected interviews. Live transcription, real-time evaluation, and seamless candidate experience.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link 
            href="/candidate/login"
            className="group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold transition-all shadow-[0_0_40px_-5px_var(--color-indigo-600)] hover:shadow-[0_0_60px_-5px_var(--color-indigo-500)] flex items-center justify-center gap-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="relative flex items-center gap-2">Take an Interview <ArrowRight size={18} /></span>
          </Link>

        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { icon: <Video size={24} />, title: 'Full-Screen & Camera', desc: 'Secure evaluation with strict system checks and recording.' },
            { icon: <Mic size={24} />, title: 'Live Voice & Transcript', desc: 'Real-time two-way audio interaction built for human-like flow.' },
            { icon: <ShieldCheck size={24} />, title: 'AI Evaluator & Guardrails', desc: 'Intelligent scoring based on standard question banks.' }
          ].map((feature, i) => (
            <div key={i} className="p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-sm text-left hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-white/5 text-center text-slate-500 text-sm">
        &copy; {new Date().getFullYear()} AI Interviewer System. Built with Next.js and Supabase.
      </footer>
    </div>
  );
}

