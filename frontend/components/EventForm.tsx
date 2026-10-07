'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { CATEGORIES, Category, EventItem } from '@/lib/types';
import { ErrorBox } from './States';

// Category-specific fields stored in Mongo `details` (flexible schema)
const DETAIL_FIELDS: Record<Category, { key: string; label: string; list?: boolean }[]> = {
  concert: [{ key: 'artist', label: 'Artist' }, { key: 'genre', label: 'Genre' }],
  workshop: [{ key: 'speaker', label: 'Speaker' }, { key: 'level', label: 'Level' }],
  conference: [{ key: 'speakers', label: 'Speakers (comma separated)', list: true }, { key: 'tracks', label: 'Tracks' }],
  sports: [{ key: 'teams', label: 'Teams (comma separated)', list: true }, { key: 'sport', label: 'Sport' }],
};

const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function EventForm({ event }: { event?: EventItem }) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>(event?.category ?? 'concert');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

    const dateText = String(f.get('date') ?? '');
    const dateValue = new Date(dateText);
    if (!dateText || Number.isNaN(dateValue.getTime())) {
      setError('Please fix the highlighted fields');
      setFieldErrors({ date: ['Please choose a date and time'] });
      return;
    }

    const details: Record<string, unknown> = {};
    DETAIL_FIELDS[category].forEach(({ key, list }) => {
      const v = String(f.get(`d_${key}`) ?? '').trim();
      if (v) details[key] = list ? v.split(',').map((s) => s.trim()).filter(Boolean) : v;
    });
    const body = {
      title: f.get('title'), description: f.get('description'), category,
      date: dateValue.toISOString(),
      venue: f.get('venue'), city: f.get('city'),
      price: Number(f.get('price')), totalSeats: Number(f.get('totalSeats')),
      imageUrl: f.get('imageUrl') || undefined, details,
    };
  
    setBusy(true); setError(''); setFieldErrors({});
    try {
      await api(event ? `/events/${event.id}` : '/events', { method: event ? 'PUT' : 'POST', body: JSON.stringify(body) });
      router.push('/admin');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.code === 'VALIDATION_ERROR') setFieldErrors(err.details as Record<string, string[]>);
      }
      setBusy(false);
    }
  }

  const input = (name: string, label: string, type = 'text', value?: string | number, extra = {}) => (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} defaultValue={value} className="input" required={name !== 'imageUrl'} aria-invalid={!!fieldErrors[name]} {...extra} />
      {fieldErrors[name] && <p className="mt-1 text-xs text-red-600">{fieldErrors[name].join(', ')}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-4 p-6" noValidate>
      <h1 className="text-2xl font-bold">{event ? 'Edit event' : 'New event'}</h1>
      {error && <ErrorBox message={error} />}
      {input('title', 'Title', 'text', event?.title)}
      <div>
        <label htmlFor="description" className="label">Description</label>
        <textarea id="description" name="description" rows={4} required defaultValue={event?.description} className="input" />
        {fieldErrors.description && <p className="mt-1 text-xs text-red-600">{fieldErrors.description.join(', ')}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="label">Category</label>
          <select id="category" className="input capitalize" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {input('date', 'Date & time', 'datetime-local', toLocalInput(event?.date))}
        {input('venue', 'Venue', 'text', event?.venue)}
        {input('city', 'City', 'text', event?.city)}
        {input('price', 'Price (₹)', 'number', event?.price, { min: 0 })}
        {input('totalSeats', 'Total seats', 'number', event?.totalSeats, { min: 1 })}
      </div>
      {input('imageUrl', 'Image URL (optional)', 'url', event?.imageUrl ?? '')}
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-2 text-sm font-semibold capitalize">{category} details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {DETAIL_FIELDS[category].map(({ key, label, list }) => {
            const cur = event?.details?.[key];
            return (
              <div key={`${category}-${key}`}>
                <label htmlFor={`d_${key}`} className="label">{label}</label>
                <input id={`d_${key}`} name={`d_${key}`} className="input" defaultValue={Array.isArray(cur) ? cur.join(', ') : (cur as string) ?? ''} />
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save event'}</button>
        <button type="button" className="btn-outline" onClick={() => router.push('/admin')}>Cancel</button>
      </div>
    </form>
  );
}
