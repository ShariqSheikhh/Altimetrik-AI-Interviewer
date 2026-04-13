'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip protection for login page so it renders quickly
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

    // Listen for sign-outs and token expiry automatically
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

  // Prevent flashing of admin interface while checking session
  if (loading && pathname !== '/admin/login') {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return <>{children}</>;
}
