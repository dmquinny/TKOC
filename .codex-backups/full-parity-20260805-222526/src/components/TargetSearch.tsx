type TargetSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function TargetSearch({
  value,
  onChange,
  placeholder = 'Search province or ruler…',
}: TargetSearchProps) {
  return (
    <label className="target-search">
      <span className="target-search-label">Find a target</span>
      <span className="target-search-control">
        <svg className="target-search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          type="search"
          className="target-search-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </span>
    </label>
  );
}
