"use client";

import { useEffect, useRef, useState } from 'react';
import { formatCountdown } from '@/lib/time';

type Props = {
  nextTickAt: string | null;
  compact?: boolean;
  /** Called once each time the countdown reaches zero. */
  onElapsed?: () => void;
};

export default function TickCountdown({ nextTickAt, compact = false, onElapsed }: Props) {
  // Start unset so the server and first client render agree; the clock
  // starts ticking after hydration.
  const [now, setNow] = useState<number | null>(null);
  const elapsedFor = useRef<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!nextTickAt || now === null) return;
    const remaining = new Date(nextTickAt).getTime() - now;
    if (remaining <= 0 && elapsedFor.current !== nextTickAt) {
      elapsedFor.current = nextTickAt;
      onElapsed?.();
    }
  }, [now, nextTickAt, onElapsed]);

  if (!nextTickAt) return null;
  const target = new Date(nextTickAt).getTime();
  const remaining = now === null ? null : target - now;
  const processing = remaining !== null && remaining <= 0;
  const label = remaining === null ? '—' : processing ? 'Processing…' : formatCountdown(remaining);

  return (
    <span
      className={`tick-countdown${compact ? ' is-compact' : ''}${processing ? ' is-processing' : ''}`}
      title={`Next tick at ${new Date(target).toLocaleTimeString()}`}
      aria-live="off"
    >
      <small>Next tick</small>
      <strong>{label}</strong>
    </span>
  );
}
