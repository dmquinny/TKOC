"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ChecklistItem } from '@/lib/checklist';
import { readChecklistDismissed, writeChecklistDismissed } from '@/lib/client/events';

export default function FirstStepsChecklist({ items }: { items: ChecklistItem[] }) {
  // Hidden until mounted so a dismissed list never flashes on load. On phones
  // the steps start folded so the resource numbers stay near the top.
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setDismissed(readChecklistDismissed());
    if (window.matchMedia('(max-width: 640px)').matches) setOpen(false);
  }, []);

  const remaining = items.filter(item => !item.done).length;
  if (dismissed || !items.length || remaining === 0) return null;
  const next = items.find(item => !item.done);

  return (
    <section className="game-panel checklist" aria-labelledby="checklist-heading">
      <div className="game-panel-heading">
        <div>
          <p className="eyebrow">First steps</p>
          <h2 id="checklist-heading">Your first hours as ruler</h2>
        </div>
        <span className="activity-status">{items.length - remaining} of {items.length} done</span>
      </div>
      {!open && next && (
        <p className="checklist-next">
          Next: <Link href={next.href}>{next.label}</Link>
        </p>
      )}
      {open && (
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
      )}
      <div className="game-action-bar checklist-actions">
        <button type="button" className="btn-secondary" aria-expanded={open} onClick={() => setOpen(current => !current)}>
          {open ? 'Fold the list' : `Show all ${items.length} steps`}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            writeChecklistDismissed();
            setDismissed(true);
          }}
        >
          Hide for good
        </button>
      </div>
    </section>
  );
}
