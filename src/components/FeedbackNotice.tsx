import React from 'react';

export default function FeedbackNotice({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'warning' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div
      className={`feedback-notice is-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  );
}
