"use client";

import FeedbackNotice from '@/components/FeedbackNotice';

type Props = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function DashboardError({ error, unstable_retry: retry }: Props) {
  return (
    <section className="game-panel">
      <p className="eyebrow">Something went wrong</p>
      <h2>This page could not be displayed</h2>
      <FeedbackNotice tone="error">
        {error.message || 'An unexpected error occurred.'}
        {error.digest ? ` Reference: ${error.digest}` : ''}
      </FeedbackNotice>
      <div className="game-action-bar">
        <button type="button" className="btn-primary" onClick={() => retry()}>Try again</button>
      </div>
    </section>
  );
}
