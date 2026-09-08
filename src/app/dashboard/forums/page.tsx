"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import SectionTabs from '@/components/SectionTabs';
import { apiGet, apiPost, authRedirectFor, errorMessage } from '@/lib/client/api';
import { useGameAction } from '@/lib/client/useGameData';

type Scope = 'world' | 'kingdom';

interface ThreadSummary {
  id: number;
  title: string;
  author: string;
  updatedAt: string;
  _count: { posts: number };
}

interface Post {
  id: number;
  author: string;
  body: string;
  createdAt: string;
}

interface Thread {
  id: number;
  title: string;
  posts: Post[];
}

export default function ForumsPage() {
  const router = useRouter();
  const action = useGameAction();
  const [scope, setScope] = useState<Scope>('world');
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (threadId?: number) => {
    setError('');
    const query = new URLSearchParams({ scope });
    if (threadId) query.set('threadId', String(threadId));
    try {
      const data = await apiGet<{ thread?: Thread; threads?: ThreadSummary[] }>(`/api/forums?${query}`);
      if (threadId) setThread(data.thread ?? null);
      else {
        setThreads(data.threads ?? []);
        setThread(null);
      }
    } catch (caught) {
      const redirect = authRedirectFor(caught);
      if (redirect) {
        router.replace(redirect);
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [router, scope]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const submit = async (kind: 'createThread' | 'reply') => {
    await action.run(kind, () => apiPost<{ message: string; threadId?: number }>('/api/forums', {
      action: kind,
      scope,
      title,
      body,
      threadId: thread?.id,
    }), result => {
      setTitle('');
      setBody('');
      void load(kind === 'reply' ? thread?.id : result.threadId);
      return result.message;
    });
  };

  return (
    <>
      <PageBanner image="/game/headers/header-messages.webp" title="Forums" subtitle="Councils of the kingdom and the wider world." />

      <div className="row row-between mb-1">
        <SectionTabs
          label="Forum"
          tabs={[{ id: 'world', label: 'World forum' }, { id: 'kingdom', label: 'Kingdom forum' }]}
          active={scope}
          onChange={next => setScope(next)}
        />
        {thread && <button type="button" className="btn-secondary" onClick={() => void load()}>Back to threads</button>}
      </div>

      <Notices error={error || action.error} notice={action.notice} />

      {thread ? (
        <>
          <section className="stat-card">
            <h2>{thread.title}</h2>
            <div className="divided">
              {thread.posts.map(post => (
                <article key={post.id} className="post">
                  <strong className="post-author">{post.author}</strong>
                  <small className="post-time">{new Date(post.createdAt).toLocaleString()}</small>
                  <p className="post-body">{post.body}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="stat-card mt-1">
            <h2>Reply</h2>
            <div className="compose-form">
              <textarea aria-label="Reply" value={body} onChange={event => setBody(event.target.value)} rows={6} maxLength={10000} />
              <button type="button" className="btn-primary" disabled={action.busy !== null || !body.trim()} onClick={() => void submit('reply')}>
                {action.busy === 'reply' ? 'Posting…' : 'Post reply'}
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="stat-card">
            <h2>{scope === 'world' ? 'World Threads' : 'Kingdom Threads'}</h2>
            {loading ? (
              <p className="empty-state">Loading…</p>
            ) : threads.length === 0 ? (
              <p className="empty-state">There are no threads yet.</p>
            ) : (
              <div className="divided">
                {threads.map(item => (
                  <button key={item.id} type="button" className="thread-row" onClick={() => void load(item.id)}>
                    <strong>{item.title}</strong>
                    <span>{item._count.posts} post{item._count.posts === 1 ? '' : 's'} · {item.author}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="stat-card mt-1">
            <h2>Start a Thread</h2>
            <div className="compose-form">
              <input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="Thread title" aria-label="Thread title" />
              <textarea value={body} onChange={event => setBody(event.target.value)} rows={6} maxLength={10000} placeholder="Opening post" aria-label="Opening post" />
              <button type="button" className="btn-primary" disabled={action.busy !== null || !title.trim() || !body.trim()} onClick={() => void submit('createThread')}>
                {action.busy === 'createThread' ? 'Creating…' : 'Create thread'}
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
