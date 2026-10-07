'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={user ? '/' : '/login'} className="text-xl font-bold text-indigo-600">
          EventHub
        </Link>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {user && <Link href="/" className="hover:text-indigo-600">Events</Link>}
          {user && <Link href="/bookings" className="hover:text-indigo-600">My Bookings</Link>}
          {user?.role === 'admin' && <Link href="/admin" className="hover:text-indigo-600">Admin</Link>}
          {loading ? null : user ? (
            <>
              <span className="text-slate-500">{user.name}</span>
              <button
                className="btn-outline"
                onClick={async () => {
                  await logout();
                  router.push('/login');
                  router.refresh();
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-outline">Log in</Link>
              <Link href="/register" className="btn-primary">Sign up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
