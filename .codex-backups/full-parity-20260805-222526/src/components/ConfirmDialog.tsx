"use client";

import { useEffect, useId, useRef, useState } from 'react';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmationText?: string;
  tone?: 'default' | 'warning' | 'danger';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (confirmation?: string) => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmationText,
  tone = 'default',
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setConfirmation('');
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`confirm-dialog confirm-dialog-${tone}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClose={() => {
        if (open && !busy) onCancel();
      }}
    >
      <div className="confirm-dialog-mark" aria-hidden="true">
        {tone === 'danger' ? '!' : tone === 'warning' ? '!' : '?'}
      </div>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      {confirmationText && (
        <label className="confirm-dialog-field">
          <span>Type <strong>{confirmationText}</strong> to continue</span>
          <input
            type="text"
            autoComplete="off"
            autoFocus
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
          />
        </label>
      )}
      <div className="confirm-dialog-actions">
        <button className="btn-secondary" type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          className={`btn-primary ${tone === 'danger' ? 'btn-danger' : tone === 'warning' ? 'btn-warning' : ''}`}
          type="button"
          disabled={busy || Boolean(confirmationText && confirmation !== confirmationText)}
          onClick={() => onConfirm(confirmationText ? confirmation : undefined)}
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
