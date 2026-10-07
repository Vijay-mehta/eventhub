'use client';
import { useEffect, useState } from 'react';

/** Counts down from `seconds` (server-provided, so no clock skew). Calls onExpire once at zero. */
export default function Countdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        onExpire();
      }
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className={`text-center ${left <= 60 ? 'text-red-600' : 'text-slate-800'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">Seats held for</p>
      <p className="font-mono text-4xl font-bold" role="timer" aria-label={`${mm} minutes ${ss} seconds left`}>
        {mm}:{ss}
      </p>
    </div>
  );
}
