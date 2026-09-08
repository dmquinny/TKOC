"use client";

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export type CatalogFact = { label: string; value: ReactNode };

type Props = {
  image?: string;
  imageAlt?: string;
  imageStyle?: 'cover' | 'portrait' | 'contain';
  title: string;
  /** Right-aligned detail next to the title on desktop. */
  meta?: ReactNode;
  /** One-line status shown under the title; the whole mobile summary. */
  summary?: ReactNode;
  description?: ReactNode;
  facts?: CatalogFact[];
  warning?: string;
  muted?: boolean;
  highlighted?: boolean;
  children?: ReactNode;
};

/**
 * One card that renders as an expanded tile on desktop and a collapsible
 * row on phones, replacing the duplicated desktop and mobile lists.
 */
export default function CatalogCard({
  image,
  imageAlt = '',
  imageStyle = 'cover',
  title,
  meta,
  summary,
  description,
  facts,
  warning,
  muted = false,
  highlighted = false,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const hideOnError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.visibility = 'hidden';
  };

  return (
    <article className={`catalog-card${open ? ' is-open' : ''}${muted ? ' is-muted' : ''}${highlighted ? ' is-highlighted' : ''}`}>
      {image && (
        <div className={`catalog-media is-${imageStyle}`}>
          <img src={image} alt={imageAlt} loading="lazy" decoding="async" onError={hideOnError} />
        </div>
      )}
      <button
        type="button"
        className="catalog-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(current => !current)}
      >
        {image && <img className="catalog-thumb" src={image} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={hideOnError} />}
        <span className="catalog-heading">
          <strong>{title}</strong>
          {summary && <span className="catalog-summary">{summary}</span>}
        </span>
        {meta && <span className="catalog-meta">{meta}</span>}
        <ChevronDown className="catalog-chevron" aria-hidden="true" />
      </button>
      <div id={bodyId} className="catalog-body">
        {description && <p className="catalog-description">{description}</p>}
        {facts && facts.length > 0 && (
          <dl className="catalog-facts">
            {facts.map(fact => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {warning && <p className="catalog-warning">{warning}</p>}
        {children && <div className="catalog-actions">{children}</div>}
      </div>
    </article>
  );
}
