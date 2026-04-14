'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, LayoutDashboard, Users, FileText, Settings, LogOut, Bell, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import logoImg from '../icon.png';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/admin/login') {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
      } else {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (pathname !== '/admin/login') {
          router.push('/admin/login');
        }
      } else if (event === 'SIGNED_IN') {
        if (pathname === '/admin/login') {
          router.push('/admin/dashboard');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (loading && pathname !== '/admin/login') {
    return (
      <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const navLinks = [
    { href: '/admin/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', active: pathname === '/admin/dashboard' },
    { href: '/admin/interviews', icon: <Users size={18} />, label: 'Tests', active: pathname.includes('/admin/interviews') },
    { href: '/admin/results', icon: <FileText size={18} />, label: 'Results', active: pathname.includes('/admin/results') },
  ];

  return (
    <div className="min-h-screen bg-[#fcfdfd] flex flex-col text-slate-800 font-sans">
      {/* Top Header */}
      <header className="h-20 bg-white/70 backdrop-blur-md border-b border-slate-200 px-10 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-12">
            {/* Logo */}
            <Link href="/admin/dashboard" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <Image src={logoImg} alt="Altimetrik" width={32} height={32} className="rounded-lg" />
                </div>
                <span className="text-xl font-black tracking-tight text-slate-900 uppercase">Admin</span>
            </Link>

            {/* Top Navigation */}
            <nav className="flex items-center gap-2">
                {navLinks.map((link) => (
                    <Link 
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl transition-all font-bold text-sm ${
                            link.active 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        {link.icon}
                        <span>{link.label}</span>
                    </Link>
                ))}
            </nav>
        </div>

        <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-black text-slate-900 leading-none">Super Admin</p>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Administrator</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                    <User size={20} />
                </div>
            </div>

            <button
                onClick={async () => {
                    await supabase.auth.signOut();
                    router.push('/admin/login');
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-sm"
                title="Sign Out"
            >
                <LogOut size={20} />
                <span className="hidden md:inline">Sign Out</span>
            </button>
        </div>
      </header>

      {/* Content Section */}
      <main className="flex-1 p-10 bg-dot-pattern max-w-[1600px] mx-auto w-full">
          {children}
      </main>
    </div>
  );
}
