import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLElement> & {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
};

export default function GamePanel({
  title,
  eyebrow,
  actions,
  className = '',
  children,
  ...props
}: Props) {
  return (
    <section className={`game-panel ${className}`.trim()} {...props}>
      {(title || eyebrow || actions) && (
        <header className="game-panel-heading">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2>{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
