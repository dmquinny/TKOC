"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, authRedirectFor, errorMessage } from '@/lib/client/api';

type Options = {
  /** Poll the endpoint on this interval while the tab is visible. */
  refreshMs?: number;
};

/**
 * Load a game endpoint for the current province. Handles the loading flag,
 * error text, expired sessions, and missing-province redirects in one place.
 */
export function useGameData<T>(url: string | null, options: Options = {}) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(url));
  const active = useRef(true);
  const refreshMs = options.refreshMs;

  const refresh = useCallback(async (showLoading = false): Promise<T | null> => {
    if (!url) return null;
    if (showLoading) setLoading(true);
    try {
      const result = await apiGet<T>(url);
      if (!active.current) return result;
      setData(result);
      setError('');
      return result;
    } catch (caught) {
      const redirect = authRedirectFor(caught);
      if (redirect) {
        router.replace(redirect);
        return null;
      }
      if (active.current) setError(errorMessage(caught));
      return null;
    } finally {
      if (active.current) setLoading(false);
    }
  }, [router, url]);

  useEffect(() => {
    active.current = true;
    setLoading(Boolean(url));
    void refresh();
    if (!url || !refreshMs) {
      return () => {
        active.current = false;
      };
    }
    const poll = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(poll, refreshMs);
    document.addEventListener('visibilitychange', poll);
    return () => {
      active.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [refresh, refreshMs, url]);

  return { data, error, loading, refresh, setData, setError };
}

/**
 * Track a mutating request: which action is busy, its error, and its notice.
 * Pages call `run('key', () => apiPost(...), result => 'Saved.')`.
 */
export function useGameAction() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const run = useCallback(async <R,>(
    key: string,
    work: () => Promise<R>,
    onSuccess?: (result: R) => string | void | undefined,
  ): Promise<R | null> => {
    setBusy(key);
    setError('');
    setNotice('');
    setWarnings([]);
    try {
      const result = await work();
      const message = onSuccess?.(result);
      if (message) setNotice(message);
      const extra = (result as { warnings?: unknown } | null)?.warnings;
      if (Array.isArray(extra)) setWarnings(extra.filter((item): item is string => typeof item === 'string'));
      return result;
    } catch (caught) {
      const redirect = authRedirectFor(caught);
      if (redirect) {
        router.replace(redirect);
        return null;
      }
      setError(errorMessage(caught));
      return null;
    } finally {
      setBusy(null);
    }
  }, [router]);

  const clear = useCallback(() => {
    setError('');
    setNotice('');
    setWarnings([]);
  }, []);

  return { busy, error, notice, warnings, run, clear, setError, setNotice };
}
