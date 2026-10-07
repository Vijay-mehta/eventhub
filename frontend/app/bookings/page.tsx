'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Booking } from '@/lib/types';
import { dateTime, money } from '@/lib/format';
import { Empty, ErrorBox, Spinner } from '@/components/States';

const color: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-slate-200 text-slate-600',
  EXPIRED: 'bg-slate-200 text-slate-600',
};

export default function MyBookings() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Booking[] | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setError('');
    api<Booking[]>('/bookings/me').then(setItems).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login');
    else load();
  }, [authLoading, user, load, router]);

  async function cancel(id: string) {
    if (!confirm('Cancel this booking? Seats are released and payment is refunded.')) return;
    setMsg('');
    try { await post(`/bookings/${id}/cancel`); setMsg('Booking cancelled.'); load(); }
    catch (e) { setMsg((e as Error).message); }
  }

  if (authLoading || (!items && !error)) return <Spinner />;
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">My bookings</h1>
      {msg && <p role="status" className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">{msg}</p>}
      {error && <ErrorBox message={error} retry={load} />}
      {items && items.length === 0 && (
        <Empty title="No bookings yet" hint="Find something to go to.">
          <Link href="/" className="btn-primary mt-2">Browse events</Link>
        </Empty>
      )}
      <ul className="space-y-3">
        {items?.map((b) => (
          <li key={b.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="space-y-1">
              <Link href={`/events/${b.eventId}`} className="font-semibold hover:text-indigo-600">{b.eventTitle}</Link>
              <p className="text-sm text-slate-500">{dateTime(b.eventDate)} · {b.quantity} ticket{b.quantity > 1 ? 's' : ''} · {money(b.totalAmount)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${color[b.status]}`}>{b.status}</span>
              {b.status === 'PENDING' && <Link href={`/checkout/${b.id}`} className="btn-primary">Complete payment</Link>}
              {b.status === 'CONFIRMED' && (
                <button className="btn-outline" onClick={() => cancel(b.id)} disabled={!b.canCancel} title={b.canCancel ? '' : 'Cancellation closes 24h before the event'}>
                  {b.canCancel ? 'Cancel' : 'Cancel closed'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
