"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import SectionTabs from '@/components/SectionTabs';
import { apiGet, apiPost, authRedirectFor, errorMessage } from '@/lib/client/api';

type Scope = 'world' | 'kingdom';

interface ChatMessage {
  id: number;
  author: string;
  message: string;
  createdAt: string;
}

interface ChatResponse {
  messages: ChatMessage[];
  noKingdom?: boolean;
}

const POLL_MS = 4000;
const MAX_MESSAGES = 200;

export default function Chat() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>('world');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [noKingdom, setNoKingdom] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  // Only messages newer than the last one seen are fetched on each poll.
  const refresh = useCallback(async (full = false) => {
    try {
      const since = full ? 0 : lastId.current;
      const data = await apiGet<ChatResponse>(`/api/chat?scope=${scope}${since ? `&since=${since}` : ''}`);
      setNoKingdom(Boolean(data.noKingdom));
      if (full) {
        setMessages(data.messages);
      } else if (data.messages.length) {
        setMessages(current => [...current, ...data.messages].slice(-MAX_MESSAGES));
      }
      const newest = data.messages[data.messages.length - 1]?.id;
      if (newest) lastId.current = Math.max(lastId.current, newest);
    } catch (caught) {
      const redirect = authRedirectFor(caught);
      if (redirect) router.replace(redirect);
      /* other transient poll failures are ignored */
    }
  }, [router, scope]);

  useEffect(() => {
    lastId.current = 0;
    setMessages([]);
    setLoading(true);
    refresh(true).finally(() => setLoading(false));
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
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
      await apiPost('/api/chat', { scope, message: text });
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setInput(text);
    }
  };

  const kingdomLocked = scope === 'kingdom' && noKingdom;

  return (
    <div className="chat-page">
      <PageBanner image="/game/headers/header-chat.webp" title="Chat" subtitle="Speak with the world and your kingdom." />

      <SectionTabs
        label="Chat channel"
        tabs={[{ id: 'world', label: 'World' }, { id: 'kingdom', label: 'Kingdom' }]}
        active={scope}
        onChange={next => setScope(next)}
      />

      <Notices error={error} />

      <section className="stat-card chat-shell">
        <div ref={scrollRef} className="chat-messages" role="log" aria-live="polite">
          {loading ? (
            <p className="empty-state">Loading…</p>
          ) : kingdomLocked ? (
            <p className="empty-state">You are not in a kingdom, so kingdom chat is unavailable this age.</p>
          ) : messages.length === 0 ? (
            <p className="empty-state">No messages yet. Be the first to speak.</p>
          ) : (
            messages.map(message => (
              <div key={message.id} className="chat-line">
                <span className="chat-author">{message.author}</span>
                <span className="chat-time">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <div className="chat-text">{message.message}</div>
              </div>
            ))
          )}
        </div>
        <div className="chat-composer">
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') void send(); }}
            maxLength={280}
            placeholder={kingdomLocked ? 'Kingdom chat unavailable' : `Message ${scope} chat…`}
            aria-label={`Message ${scope} chat`}
            disabled={kingdomLocked}
          />
          <button type="button" className="btn-primary" onClick={() => void send()} disabled={kingdomLocked || !input.trim()}>Send</button>
        </div>
      </section>
    </div>
  );
}
