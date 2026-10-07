'use client';
import { useEffect, useState } from 'react';
import AdminGuard from '@/components/AdminGuard';
import EventForm from '@/components/EventForm';
import { ErrorBox, Spinner } from '@/components/States';
import { api } from '@/lib/api';
import { EventItem } from '@/lib/types';

export default function EditEvent({ params }: { params: { id: string } }) {
  const [ev, setEv] = useState<EventItem | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<EventItem>(`/events/${params.id}`).then(setEv).catch((e) => setError(e.message)); }, [params.id]);
  return (
    <AdminGuard>
      {error ? <ErrorBox message={error} /> : ev ? <EventForm event={ev} /> : <Spinner />}
    </AdminGuard>
  );
}
