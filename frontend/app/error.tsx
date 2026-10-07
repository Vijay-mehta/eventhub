'use client';
import { ErrorBox } from '@/components/States';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorBox message={error.message || 'Something went wrong. Is the API running?'} retry={reset} />;
}
