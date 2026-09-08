import type { HTMLAttributes } from 'react';

export default function ActionBar({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`game-action-bar ${className}`.trim()} {...props} />;
}
