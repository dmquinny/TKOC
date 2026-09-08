"use client";

import { useState } from 'react';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { apiPost } from '@/lib/client/api';
import { requestNotificationRefresh } from '@/lib/client/events';
import { useGameAction, useGameData } from '@/lib/client/useGameData';

interface Message {
  id: number;
  fromName: string;
  subject: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface MessagesData {
  messages: Message[];
  unread: number;
}

export default function Messages() {
  const { data, error, loading, refresh, setData } = useGameData<MessagesData>('/api/messages');
  const action = useGameAction();
  const [openId, setOpenId] = useState<number | null>(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  if (!data) {
    return loading ? <PageSkeleton cards={2} /> : <Notices error={error || 'The post could not be opened.'} />;
  }

  const openMessage = async (message: Message) => {
    setOpenId(openId === message.id ? null : message.id);
    if (message.readAt) return;
    const readAt = new Date().toISOString();
    setData(current => current ? {
      unread: Math.max(0, current.unread - 1),
      messages: current.messages.map(item => (item.id === message.id ? { ...item, readAt } : item)),
    } : current);
    try {
      await apiPost('/api/messages', { action: 'read', id: message.id });
      requestNotificationRefresh();
    } catch {
      void refresh();
    }
  };

  const send = async () => {
    await action.run('send', () => apiPost<{ message: string }>('/api/messages', { to, subject, body }), result => {
      setTo('');
      setSubject('');
      setBody('');
      return result.message;
    });
  };

  return (
    <>
      <PageBanner
        image="/game/headers/header-messages.webp"
        title="Messages"
        subtitle="Private word between rulers."
        right={<div className="networth-badge">{data.unread} unread</div>}
      />

      <Notices error={error || action.error} notice={action.notice} />

      <div className="responsive-grid page-grid is-inbox">
        <section className="stat-card">
          <h2>Inbox</h2>
          {data.messages.length === 0 ? (
            <p className="empty-state">No messages.</p>
          ) : (
            <div className="divided">
              {data.messages.map(message => (
                <div key={message.id} className="inbox-item">
                  <button type="button" className="message-summary" aria-expanded={openId === message.id} onClick={() => void openMessage(message)}>
                    <span className={`inbox-subject${message.readAt ? '' : ' is-unread'}`}>{message.subject}</span>
                    <span className="inbox-from">from {message.fromName} · {new Date(message.createdAt).toLocaleDateString()}</span>
                  </button>
                  {openId === message.id && <div className="inbox-body">{message.body}</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="stat-card">
          <h2>Compose</h2>
          <div className="compose-form">
            <input placeholder="To (province name)" aria-label="Recipient province" value={to} maxLength={40} onChange={event => setTo(event.target.value)} />
            <input placeholder="Subject" aria-label="Subject" value={subject} maxLength={120} onChange={event => setSubject(event.target.value)} />
            <textarea placeholder="Message" aria-label="Message" value={body} rows={6} maxLength={5000} onChange={event => setBody(event.target.value)} />
            <button type="button" className="btn-primary" onClick={() => void send()} disabled={action.busy !== null || !to.trim() || !subject.trim() || !body.trim()}>
              {action.busy === 'send' ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
