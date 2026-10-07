import Link from 'next/link';
import { EventItem } from '@/lib/types';
import { dateTime, money } from '@/lib/format';

const badge: Record<string, string> = {
  concert: 'bg-pink-100 text-pink-700',
  workshop: 'bg-amber-100 text-amber-700',
  conference: 'bg-sky-100 text-sky-700',
  sports: 'bg-emerald-100 text-emerald-700',
};

export default function EventCard({ e }: { e: EventItem }) {
  const soldOut = e.availableSeats === 0;
  return (
    <article className="card flex flex-col overflow-hidden transition hover:shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={e.imageUrl ?? 'https://picsum.photos/seed/eventhub/800/450'}
        alt=""
        loading="lazy"
        className="h-40 w-full bg-slate-100 object-cover"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${badge[e.category]}`}>{e.category}</span>
        <h3 className="text-lg font-semibold leading-snug">
          <Link href={`/events/${e.id}`} className="hover:text-indigo-600 focus:outline-none focus-visible:underline">
            {e.title}
          </Link>
        </h3>
        <p className="text-sm text-slate-500">{dateTime(e.date)}</p>
        <p className="text-sm text-slate-500">{e.venue}, {e.city}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-bold">{e.price === 0 ? 'Free' : money(e.price)}</span>
          <span className={`text-xs font-medium ${soldOut ? 'text-red-600' : 'text-slate-500'}`}>
            {soldOut ? 'Sold out' : `${e.availableSeats} seats left`}
          </span>
        </div>
      </div>
    </article>
  );
}
