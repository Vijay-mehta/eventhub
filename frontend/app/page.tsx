import Link from 'next/link';
import type { Metadata } from 'next';
import { getEvents } from '@/lib/server';
import { CATEGORIES } from '@/lib/types';
import EventCard from '@/components/EventCard';
import { Empty } from '@/components/States';

export const metadata: Metadata = {
  title: 'Upcoming events',
  description: 'Browse upcoming concerts, workshops, conferences and sports events. Book your seats in seconds.',
  openGraph: { title: 'EventHub - Upcoming events', type: 'website' },
};

type SP = Record<string, string | undefined>;

// SSR: filters come from the URL so every filtered view is shareable & crawlable. Data is cached 30s (ISR-style).
export default async function Home({ searchParams }: { searchParams: SP }) {
  const { items, meta } = await getEvents({ ...searchParams, limit: '9' });
  const link = (page: number) => {
    const p = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]);
    p.set('page', String(page));
    return `/?${p}`;
  };
  const hasFilters = Object.entries(searchParams).some(([k, v]) => v && k !== 'page');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Upcoming events</h1>

      <form method="get" role="search" aria-label="Filter events" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={searchParams.q} placeholder="Artist, title, topic…" className="input" />
        </div>
        <div>
          <label htmlFor="category" className="label">Category</label>
          <select id="category" name="category" defaultValue={searchParams.category ?? ''} className="input capitalize">
            <option value="">All</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="label">Sort by</label>
          <select id="sort" name="sort" defaultValue={searchParams.sort ?? 'date_asc'} className="input">
            <option value="date_asc">Date: soonest</option>
            <option value="date_desc">Date: latest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        <div>
          <label htmlFor="from" className="label">From date</label>
          <input id="from" type="date" name="from" defaultValue={searchParams.from} className="input" />
        </div>
        <div>
          <label htmlFor="to" className="label">To date</label>
          <input id="to" type="date" name="to" defaultValue={searchParams.to} className="input" />
        </div>
        <div>
          <label htmlFor="minPrice" className="label">Min price (₹)</label>
          <input id="minPrice" type="number" min={0} name="minPrice" defaultValue={searchParams.minPrice} className="input" />
        </div>
        <div>
          <label htmlFor="maxPrice" className="label">Max price (₹)</label>
          <input id="maxPrice" type="number" min={0} name="maxPrice" defaultValue={searchParams.maxPrice} className="input" />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button className="btn-primary">Apply filters</button>
          {hasFilters && <Link href="/" className="btn-outline">Clear</Link>}
        </div>
      </form>

      {items.length === 0 ? (
        <Empty title="No events found" hint="Try changing or clearing your filters." />
      ) : (
        <>
          <p className="text-sm text-slate-500" aria-live="polite">{meta.total} events</p>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((e) => (
              <li key={e.id} className="flex"><div className="flex-1"><EventCard e={e} /></div></li>
            ))}
          </ul>
          <nav aria-label="Pagination" className="flex items-center justify-center gap-4">
            {meta.page > 1 ? <Link className="btn-outline" href={link(meta.page - 1)}>Previous</Link> : <span />}
            <span className="text-sm text-slate-500">Page {meta.page} of {meta.totalPages}</span>
            {meta.page < meta.totalPages ? <Link className="btn-outline" href={link(meta.page + 1)}>Next</Link> : <span />}
          </nav>
        </>
      )}
    </div>
  );
}
