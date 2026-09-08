"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem', borderRadius: '4px',
  border: '1px solid #33333d', backgroundColor: '#121214', color: '#fff',
};

export default function Messages() {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/messages');
      if (res.status === 401) return router.push('/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(data.messages || []);
      setUnread(data.unread || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [router]);

  const openMessage = async (m: any) => {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.readAt) {
      await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', id: m.id }) });
      load();
    }
  };

  const send = async () => {
    setSending(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotice(data.message);
      setTo(''); setSubject(''); setBody('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="loading-screen">Opening the Post…</div>;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/messages" />
      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-messages.webp"
          title="Messages"
          subtitle="Private word between rulers."
          right={<div className="networth-badge">{unread} unread</div>}
        />

        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
        {notice && <FeedbackNotice tone="success">{notice}</FeedbackNotice>}

        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
          <section className="stat-card">
            <h2>Inbox</h2>
            {messages.length === 0 ? (
              <p className="empty-state">No messages.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {messages.map(m => (
                  <div key={m.id} style={{ borderBottom: '1px solid #2a2419', padding: '0.6rem 0' }}>
                    <button type="button" className="message-summary" onClick={() => openMessage(m)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: m.readAt ? 'var(--parchment-dim)' : 'var(--gold-bright)', fontWeight: m.readAt ? 400 : 700 }}>
                        {m.subject}
                      </span>
                      <span style={{ color: '#6b6353', fontSize: '0.8rem' }}>from {m.fromName}</span>
                    </button>
                    {openId === m.id && (
                      <div style={{ marginTop: '0.5rem', color: 'var(--parchment)', whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="stat-card">
            <h2>Compose</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input placeholder="To (province name)" value={to} onChange={(e) => setTo(e.target.value)} style={fieldStyle} />
              <input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={fieldStyle} />
              <textarea placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={6} style={{ ...fieldStyle, resize: 'vertical' }} />
              <button onClick={send} className="btn-primary" style={{ margin: 0 }} disabled={sending || !to.trim() || !subject.trim() || !body.trim()}>
                {sending ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
