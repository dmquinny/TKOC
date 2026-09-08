import React from 'react';

export default function PageBanner({
  image,
  title,
  subtitle,
  right,
}: {
  image: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const style = { '--banner': `url(${image})` } as React.CSSProperties;
  return (
    <>
      <header className="page-banner" style={style}>
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {right}
      </header>
      {(subtitle || right) && (
        <div className="mobile-page-context">
          {subtitle && <p>{subtitle}</p>}
          {right && <div className="mobile-page-context-stat">{right}</div>}
        </div>
      )}
    </>
  );
}
