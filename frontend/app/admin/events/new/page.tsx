'use client';
import AdminGuard from '@/components/AdminGuard';
import EventForm from '@/components/EventForm';
export default function NewEvent() { return <AdminGuard><EventForm /></AdminGuard>; }
