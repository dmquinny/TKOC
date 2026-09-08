export default function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="skeleton-page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading realm data</span>
      <div className="skeleton skeleton-banner" />
      <div className="skeleton-grid">
        {Array.from({ length: cards }, (_, index) => <div key={index} className="skeleton skeleton-card" />)}
      </div>
    </div>
  );
}
