'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { EventItem } from '@/lib/types';
import { dateOnly, money } from '@/lib/format';
import AdminGuard from '@/components/AdminGuard';
import { Empty, ErrorBox, Spinner } from '@/components/States';

interface Stats { events: number; users: number; confirmedBookings: number; ticketsSold: number; revenue: number }
interface Top { eventId: string; title: string; bookings: number; tickets: number; revenue: number }
interface AdminBooking { id: string; status: string; quantity: number; totalAmount: number; createdAt: string; userEmail: string; eventTitle: string }

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [top, setTop] = useState<Top[]>([]);
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api<Stats>('/admin/stats'),
      api<Top[]>('/admin/reports/top-events'),
      api<AdminBooking[]>('/admin/bookings'),
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/events?limit=50&sort=date_asc`).then((r) => r.json()),
    ])
      .then(([s, t, b, ev]) => { setStats(s); setTop(t); setBookings(b); setEvents(ev.data); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function remove(e: EventItem) {
    if (!confirm(`Delete "${e.title}"?`)) return;
    try { await api(`/events/${e.id}`, { method: 'DELETE' }); load(); }
    catch (err) { alert((err as Error).message); }
  }

  if (error) return <ErrorBox message={error} retry={load} />;
  if (!stats || !events) return <Spinner />;

  const cards = [
    ['Events', stats.events], ['Users', stats.users], ['Confirmed bookings', stats.confirmedBookings],
    ['Tickets sold', stats.ticketsSold], ['Revenue', money(stats.revenue)],
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
        <Link href="/admin/events/new" className="btn-primary">+ New event</Link>
      </div>

      <section aria-label="Stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([l, v]) => (
          <div key={l as string} className="card p-4"><p className="text-sm text-slate-500">{l}</p><p className="text-2xl font-bold">{v}</p></div>
        ))}
      </section>

      <section aria-labelledby="top-h" className="card p-4">
        <h2 id="top-h" className="mb-3 font-semibold">Top 5 events by revenue</h2>
        {top.length === 0 ? <p className="text-sm text-slate-500">No confirmed bookings yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-slate-500"><tr><th className="py-2">Event</th><th>Bookings</th><th>Tickets</th><th>Revenue</th></tr></thead>
            <tbody>{top.map((t) => <tr key={t.eventId} className="border-t"><td className="py-2">{t.title}</td><td>{t.bookings}</td><td>{t.tickets}</td><td className="font-semibold">{money(t.revenue)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      <section aria-labelledby="ev-h">
        <h2 id="ev-h" className="mb-3 text-xl font-semibold">Events</h2>
        {events.length === 0 ? <Empty title="No events" /> : (
          <div className="card overflow-x-auto"><table className="w-full text-left text-sm">
            <caption className="sr-only">All events</caption>
            <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Title</th><th>Category</th><th>Date</th><th>Price</th><th>Seats</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{events.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3 font-medium">{e.title}</td><td className="capitalize">{e.category}</td><td>{dateOnly(e.date)}</td>
                <td>{money(e.price)}</td><td>{e.availableSeats}/{e.totalSeats}</td>
                <td className="space-x-2 p-3 text-right whitespace-nowrap">
                  <Link href={`/admin/events/${e.id}`} className="btn-outline px-3 py-1">Edit</Link>
                  <button onClick={() => remove(e)} className="btn-danger px-3 py-1">Delete</button>
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>

      <section aria-labelledby="bk-h">
        <h2 id="bk-h" className="mb-3 text-xl font-semibold">Recent bookings</h2>
        <div className="card overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">User</th><th>Event</th><th>Qty</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{bookings.map((b) => <tr key={b.id} className="border-t"><td className="p-3">{b.userEmail}</td><td>{b.eventTitle}</td><td>{b.quantity}</td><td>{money(b.totalAmount)}</td><td>{b.status}</td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return <AdminGuard><Dashboard /></AdminGuard>;
}
