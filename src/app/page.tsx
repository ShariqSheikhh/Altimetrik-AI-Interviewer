import Link from "next/link";
import Image from "next/image";
import logoImg from "./icon.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-800 font-sans selection:bg-blue-500/20 overflow-x-hidden relative flex flex-col">
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 bg-dot-pattern opacity-70 pointer-events-none z-0" />

      {/* Top Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-5 lg:px-16 border-b border-slate-200/50 bg-white/70 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Image src={logoImg} alt="Altimetrik" width={32} height={32} className="w-8 h-8 rounded-lg" />
          <span className="text-xl font-bold tracking-tight text-slate-900 ml-1">Altimetrik</span>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="/candidate/login" className="bg-white border border-slate-200 hover:border-slate-300 shadow-sm text-slate-700 transition-all px-5 py-2 rounded-xl flex items-center gap-2">
            Candidate Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-12 pb-32 flex-1 flex flex-col items-center justify-center text-center">
        
        {/* Floating Center Icon */}
        <div className="w-24 h-24 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-center mb-8 z-20">
           <Image src={logoImg} alt="Altimetrik" width={72} height={72} className="w-16 h-16 rounded-2xl" />
        </div>
        
        {/* Main Heading */}
        <h1 className="text-5xl md:text-[5.5rem] font-bold tracking-tight text-slate-900 leading-[1.05] mb-6 z-20">
          AI-Powered Interviews <br />
          <span className="text-slate-400 font-light">simplified</span>
        </h1>
        
        <p className="text-lg text-slate-500 mb-10 max-w-xl z-20">
          The smartest way to screen candidates. Fast, fair, and fully automated.
        </p>

        <Link 
          href="/candidate/login"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-medium transition-all shadow-[0_8px_20px_rgb(37,99,235,0.25)] hover:shadow-[0_8px_25px_rgb(37,99,235,0.35)] z-20"
        >
          Take an Interview
        </Link>
      </main>

      {/* Footer */}
      <footer className="relative py-8 border-t border-slate-200 bg-white text-center text-slate-500 text-sm">
        &copy; {new Date().getFullYear()} Altimetrik AI Interviewer System. All rights reserved.
      </footer>
    </div>
  );
}
