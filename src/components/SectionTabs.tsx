type Tab<T extends string> = { id: T; label: string; count?: number };

type Props<T extends string> = {
  tabs: Array<Tab<T>>;
  active: T;
  onChange: (id: T) => void;
  label: string;
};

/** Segmented tab bar used for scope and category switches. */
export default function SectionTabs<T extends string>({ tabs, active, onChange, label }: Props<T>) {
  return (
    <div className="section-tabs" role="tablist" aria-label={label}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? 'is-active' : ''}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && <em>{tab.count}</em>}
        </button>
      ))}
    </div>
  );
}
