'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner } from './States';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user?.role !== 'admin') router.replace(user ? '/' : '/login');
  }, [loading, user, router]);
  if (loading || user?.role !== 'admin') return <Spinner />;
  return <>{children}</>;
}
