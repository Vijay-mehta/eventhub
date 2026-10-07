'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API, ApiError, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Booking } from '@/lib/types';
import { money } from '@/lib/format';
import { ErrorBox } from './States';

export default function BookingPanel({ eventId, price, priceLabel, initialSeats }: { eventId: string; price: number; priceLabel: string; initialSeats: number }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [seats, setSeats] = useState(initialSeats);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Bonus: live seat updates over Server-Sent Events
  useEffect(() => {
    const es = new EventSource(`${API}/events/${eventId}/stream`);
    es.onmessage = (m) => setSeats(JSON.parse(m.data).availableSeats);
    return () => es.close();
  }, [eventId]);

  const maxQty = Math.min(6, seats);
  useEffect(() => { if (qty > maxQty && maxQty > 0) setQty(maxQty); }, [maxQty, qty]);

  async function hold() {
    setBusy(true);
    setError('');
    try {
      const b = await post<Booking>('/bookings/hold', { eventId, quantity: qty });
      router.push(`/checkout/${b.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not hold seats');
      setBusy(false);
    }
  }

  return (
    <div className="card sticky top-4 space-y-4 p-5">
      <p className="text-2xl font-bold">{priceLabel}</p>
      <p className={`text-sm font-medium ${seats === 0 ? 'text-red-600' : 'text-slate-600'}`} aria-live="polite">
        {seats === 0 ? 'Sold out' : `${seats} seats left (live)`}
      </p>

      {seats > 0 && (
        <div>
          <label htmlFor="qty" className="label">Tickets</label>
          <select id="qty" className="input" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
          </select>
          <p className="mt-2 text-sm text-slate-500">Total: <strong>{money(price * qty)}</strong></p>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {loading ? null : !user ? (
        <Link href="/login" className="btn-primary w-full">Log in to book</Link>
      ) : (
        <button className="btn-primary w-full" disabled={busy || seats === 0} onClick={hold}>
          {busy ? 'Holding seats…' : seats === 0 ? 'Sold out' : 'Hold seats & checkout'}
        </button>
      )}
      <p className="text-xs text-slate-500">Seats are held for 5 minutes while you pay.</p>
    </div>
  );
}
