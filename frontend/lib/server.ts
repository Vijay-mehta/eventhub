import { EventItem, Meta } from './types';

const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';

/** Server-side fetchers used by SSR/ISR pages. Cached 30s by Next, plus Redis on the API side. */
export async function getEvents(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && qs.set(k, v));
  const res = await fetch(`${API}/events?${qs}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error('Failed to load events');
  const json = await res.json();
  return { items: json.data as EventItem[], meta: json.meta as Meta };
}

export async function getEvent(id: string): Promise<EventItem | null> {
  const res = await fetch(`${API}/events/${id}`, { next: { revalidate: 30 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load event');
  return (await res.json()).data;
}
