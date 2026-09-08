"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';

export default function Chat() {
  const router = useRouter();
  const [scope, setScope] = useState<'world' | 'kingdom'>('world');
  const [messages, setMessages] = useState<any[]>([]);
  const [noKingdom, setNoKingdom] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?scope=${scope}`);
      if (res.status === 401) { router.push('/'); return; }
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
        setNoKingdom(!!data.noKingdom);
      }
    } catch {
      /* transient poll failure — ignore */
    }
  }, [scope, router]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setError('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/chat" />
      <main id="main-content" className="dashboard-content chat-page">
        <PageBanner image="/game/headers/header-chat.webp" title="Chat" subtitle="Speak with the world and your kingdom." />

        <div className="mobile-tab-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['world', 'kingdom'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className="btn-primary"
              style={{ margin: 0, padding: '0.5rem 1.25rem', textTransform: 'capitalize', opacity: scope === s ? 1 : 0.5 }}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <FeedbackNotice tone="error">{error}</FeedbackNotice>
        )}

        <section className="stat-card chat-shell" style={{ padding: 0, overflow: 'hidden' }}>
          <div ref={scrollRef} className="chat-messages" style={{ height: '52vh', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {loading ? (
              <p className="empty-state">Loading…</p>
            ) : scope === 'kingdom' && noKingdom ? (
              <p className="empty-state">You are not in a kingdom. Join or found one to use kingdom chat.</p>
            ) : messages.length === 0 ? (
              <p className="empty-state">No messages yet. Be the first to speak.</p>
            ) : (
              messages.map(m => (
                <div key={m.id} style={{ lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--gold-bright)', fontFamily: 'var(--font-display)' }}>{m.author}</span>
                  <span style={{ color: '#6b6353', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={{ color: 'var(--parchment)' }}>{m.message}</div>
                </div>
              ))
            )}
          </div>
          <div className="mobile-composer" style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--stone-border)', padding: '0.75rem' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              maxLength={280}
              placeholder={scope === 'kingdom' && noKingdom ? 'Join a kingdom to chat here' : `Message ${scope} chat…`}
              disabled={scope === 'kingdom' && noKingdom}
              style={{ flex: 1, padding: '0.6rem', borderRadius: '4px', border: '1px solid #33333d', backgroundColor: '#121214', color: '#fff' }}
            />
            <button onClick={send} className="btn-primary" style={{ margin: 0 }} disabled={scope === 'kingdom' && noKingdom}>Send</button>
          </div>
        </section>
      </main>
    </div>
  );
}
