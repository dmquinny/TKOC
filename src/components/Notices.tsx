import type { ReactNode } from 'react';
import FeedbackNotice from '@/components/FeedbackNotice';

type Props = {
  error?: string;
  notice?: string;
  info?: ReactNode;
  warnings?: string[];
};

/** Renders the standard error, success, warning, and info banners in order. */
export default function Notices({ error, notice, info, warnings = [] }: Props) {
  return (
    <>
      {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
      {notice && <FeedbackNotice tone="success">{notice}</FeedbackNotice>}
      {warnings.map(warning => <FeedbackNotice key={warning} tone="warning">{warning}</FeedbackNotice>)}
      {info && <FeedbackNotice tone="info">{info}</FeedbackNotice>}
    </>
  );
}
