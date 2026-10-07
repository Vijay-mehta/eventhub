'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Booking } from '@/lib/types';
import { dateTime, money } from '@/lib/format';
import Countdown from '@/components/Countdown';
import { Empty, ErrorBox, Spinner } from '@/components/States';

export default function Checkout({ params }: { params: { bookingId: string } }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [b, setB] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<Booking>(`/bookings/${params.bookingId}`)
      .then((d) => { setB(d); setExpired(d.status === 'EXPIRED'); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.bookingId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login');
    else load();
  }, [authLoading, user, load, router]);

  async function pay() {
    setBusy(true);
    setError('');
    try {
      await post(`/bookings/${params.bookingId}/pay`);
      router.push('/bookings');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Payment failed');
      if (e instanceof ApiError && e.code === 'HOLD_EXPIRED') setExpired(true);
      setBusy(false);
    }
  }

  async function release() {
    setBusy(true);
    try { await post(`/bookings/${params.bookingId}/cancel`); router.push('/'); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  if (loading || authLoading) return <Spinner />;
  if (!b) return <ErrorBox message={error || 'Booking not found'} />;
  if (b.status === 'CONFIRMED') return <Empty title="This booking is already confirmed"><Link href="/bookings" className="btn-primary mt-2">My bookings</Link></Empty>;

  if (expired || b.status !== 'PENDING')
    return (
      <Empty title="Your seat hold has expired" hint="The seats were released so others can book them.">
        <Link href={`/events/${b.eventId}`} className="btn-primary mt-2">Try again</Link>
      </Empty>
    );

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <div className="card space-y-4 p-6">
        <Countdown seconds={b.secondsLeft ?? 0} onExpire={() => setExpired(true)} />
        <hr />
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Event</dt><dd className="text-right font-medium">{b.eventTitle}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">When</dt><dd>{dateTime(b.eventDate)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Tickets</dt><dd>{b.quantity}</dd></div>
          <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{money(b.totalAmount)}</dd></div>
        </dl>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={busy} onClick={pay}>{busy ? 'Processing…' : `Pay ${money(b.totalAmount)}`}</button>
        <button className="btn-outline w-full" disabled={busy} onClick={release}>Release seats</button>
        <p className="text-center text-xs text-slate-500">Mock payment: succeeds ~70% of the time. If it fails, retry before the timer ends.</p>
      </div>
    </div>
  );
}
