"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleHelp, X } from 'lucide-react';

type Props = {
  id: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
};

export default function OnboardingTip({ id, title, description, href, linkLabel }: Props) {
  const storageKey = `tkoc-tip:${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(storageKey) !== 'dismissed');
  }, [storageKey]);

  if (!visible) return null;
  return (
    <aside className="onboarding-tip" aria-label={`Tip: ${title}`}>
      <CircleHelp aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        {href && <Link href={href}>{linkLabel ?? 'Learn more'}</Link>}
      </div>
      <button
        type="button"
        aria-label={`Dismiss ${title} tip`}
        onClick={() => {
          window.localStorage.setItem(storageKey, 'dismissed');
          setVisible(false);
        }}
      >
        <X aria-hidden="true" />
      </button>
    </aside>
  );
}
