"use client";

import { useId, type ReactNode } from 'react';

type Props = {
  label: string;
  hint?: string;
  children: (id: string, hintId?: string) => ReactNode;
};

export default function FormField({ label, hint, children }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="game-field">
      <label htmlFor={id}>{label}</label>
      {children(id, hintId)}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}
