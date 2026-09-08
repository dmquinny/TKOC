"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ChecklistItem } from '@/lib/checklist';
import { readChecklistDismissed, writeChecklistDismissed } from '@/lib/client/events';

export default function FirstStepsChecklist({ items }: { items: ChecklistItem[] }) {
  // Hidden until mounted so a dismissed list never flashes on load.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(readChecklistDismissed());
  }, []);

  const remaining = items.filter(item => !item.done).length;
  if (dismissed || !items.length || remaining === 0) return null;

  return (
    <section className="game-panel checklist" aria-labelledby="checklist-heading">
      <div className="game-panel-heading">
        <div>
          <p className="eyebrow">First steps</p>
          <h2 id="checklist-heading">Your first hours as ruler</h2>
        </div>
        <span className="activity-status">{items.length - remaining} of {items.length} done</span>
      </div>
      <ol className="checklist-items">
        {items.map(item => (
          <li key={item.id} className={item.done ? 'is-done' : ''}>
            <span className="checklist-mark" aria-hidden="true">{item.done ? '✓' : ''}</span>
            <div>
              <Link href={item.href}>{item.label}</Link>
              <small>{item.detail}</small>
            </div>
          </li>
        ))}
      </ol>
      <div className="game-action-bar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            writeChecklistDismissed();
            setDismissed(true);
          }}
        >
          Hide this list
        </button>
      </div>
    </section>
  );
}
