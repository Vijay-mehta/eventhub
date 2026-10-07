import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getEvent } from '@/lib/server';
import { dateTime, money } from '@/lib/format';
import BookingPanel from '@/components/BookingPanel';

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getEvent(params.id).catch(() => null);
  if (!e) return { title: 'Event not found' };
  return {
    title: e.title,
    description: e.description.slice(0, 155),
    openGraph: { title: e.title, description: e.description.slice(0, 155), images: e.imageUrl ? [e.imageUrl] : [], type: 'website' },
  };
}

const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export default async function EventPage({ params }: Props) {
  const e = await getEvent(params.id);
  if (!e) notFound();
  const details = Object.entries(e.details ?? {});

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <article className="space-y-5 lg:col-span-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e.imageUrl ?? 'https://picsum.photos/seed/eventhub/800/450'} alt={`Banner for ${e.title}`} className="h-64 w-full rounded-xl bg-slate-100 object-cover" />
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{e.category}</p>
        <h1 className="text-3xl font-bold">{e.title}</h1>
        <p className="text-slate-600">{dateTime(e.date)} · {e.venue}, {e.city}</p>
        <p className="whitespace-pre-line">{e.description}</p>
        {details.length > 0 && (
          <section aria-labelledby="details-h" className="card p-4">
            <h2 id="details-h" className="mb-2 font-semibold">Details</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-slate-500">{label(k)}</dt>
                  <dd className="font-medium">{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </article>
      <aside>
        <BookingPanel eventId={e.id} price={e.price} initialSeats={e.availableSeats} priceLabel={e.price === 0 ? 'Free' : money(e.price)} />
      </aside>
    </div>
  );
}
