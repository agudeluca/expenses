import type { Source } from "../types";

const ALL_SOURCES: Source[] = ["deel", "galicia-extracto", "galicia-credito"];
const SOURCE_LABEL: Record<Source, string> = {
  deel: "Deel",
  "galicia-extracto": "Extracto",
  "galicia-credito": "Crédito",
};

interface Props {
  query: string;
  setQuery: (q: string) => void;
  sources: Set<Source>;
  setSources: (s: Set<Source>) => void;
  currencies: Set<string>;
  setCurrencies: (s: Set<string>) => void;
  availableCurrencies: string[];
  hasActiveFilters: boolean;
  reset: () => void;
  totalCount: number;
}

export function TopBar({
  query,
  setQuery,
  sources,
  setSources,
  currencies,
  setCurrencies,
  availableCurrencies,
  hasActiveFilters,
  reset,
  totalCount,
}: Props): JSX.Element {
  function toggle<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  return (
    <div
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        position: "sticky",
        top: 0,
        background: "var(--bg)",
        zIndex: 10,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 15 }}>💸 expenses</div>
      <input
        style={{ flex: 1, minWidth: 200 }}
        placeholder="Buscar por descripción…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <FilterDropdown
        label="Fuente"
        all={ALL_SOURCES}
        labels={SOURCE_LABEL}
        selected={sources}
        onToggle={(v) => setSources(toggle(sources, v))}
      />

      <FilterDropdown
        label="Moneda"
        all={availableCurrencies}
        selected={currencies}
        onToggle={(v) => setCurrencies(toggle(currencies, v))}
      />

      <span className="muted" style={{ fontSize: 12 }}>
        {totalCount} txs
      </span>

      {hasActiveFilters && (
        <button onClick={reset} style={{ fontSize: 12 }}>
          Reset
        </button>
      )}
    </div>
  );
}

interface FilterDropdownProps<T extends string> {
  label: string;
  all: readonly T[];
  labels?: Record<string, string>;
  selected: Set<T>;
  onToggle: (value: T) => void;
}

function FilterDropdown<T extends string>({
  label,
  all,
  labels,
  selected,
  onToggle,
}: FilterDropdownProps<T>): JSX.Element {
  return (
    <details
      style={{ position: "relative" }}
      onToggle={(e) => {
        // close on outside click is handled by browser
        void e;
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          background: "var(--bg-input)",
          border: "1px solid var(--border-strong)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 12,
          userSelect: "none",
        }}
      >
        {label}
        {selected.size > 0 ? ` (${selected.size})` : ""} ▾
      </summary>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 4px)",
          background: "var(--bg-elev)",
          border: "1px solid var(--border-strong)",
          borderRadius: 6,
          padding: 6,
          minWidth: 150,
          zIndex: 20,
          boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        }}
      >
        {all.map((v) => {
          const checked = selected.has(v);
          return (
            <label
              key={v}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 6px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--bg-input)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "transparent")
              }
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(v)}
                style={{ margin: 0 }}
              />
              {labels?.[v] ?? v}
            </label>
          );
        })}
      </div>
    </details>
  );
}
