import type { Source } from "../types";

const ALL_SOURCES: Source[] = ["deel", "galicia-extracto", "galicia-credito"];
const SOURCE_LABEL: Record<Source, string> = {
  deel: "Deel",
  "galicia-extracto": "Extracto",
  "galicia-credito": "Crédito",
};

const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const name = MONTH_NAMES[Number(m) - 1] ?? m;
  return `${name} ${y}`;
}

interface Props {
  query: string;
  setQuery: (q: string) => void;
  sources: Set<Source>;
  setSources: (s: Set<Source>) => void;
  currencies: Set<string>;
  setCurrencies: (s: Set<string>) => void;
  months: Set<string>;
  setMonths: (s: Set<string>) => void;
  availableMonths: string[];
  hideIncome: boolean;
  setHideIncome: (v: boolean) => void;
  availableCurrencies: string[];
  hasActiveFilters: boolean;
  reset: () => void;
  totalCount: number;
  dismissedCount: number;
  showDismissed: boolean;
  setShowDismissed: (v: boolean) => void;
  clearDismissed: () => void;
}

export function TopBar({
  query,
  setQuery,
  sources,
  setSources,
  currencies,
  setCurrencies,
  months,
  setMonths,
  availableMonths,
  hideIncome,
  setHideIncome,
  availableCurrencies,
  hasActiveFilters,
  reset,
  totalCount,
  dismissedCount,
  showDismissed,
  setShowDismissed,
  clearDismissed,
}: Props): JSX.Element {
  function toggle<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  return (
    <div className="topbar">
      <div className="topbar-row">
        <div className="brand">💸 expenses</div>
        <input
          className="search"
          placeholder="Buscar por descripción…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="filter-group">
        <span className="filter-group-label">Fuente</span>
        <ChipGroup
          all={ALL_SOURCES}
          labels={SOURCE_LABEL}
          selected={sources}
          onToggle={(v) => setSources(toggle(sources, v))}
        />
      </div>

      <div className="filter-group">
        <span className="filter-group-label">Moneda</span>
        <ChipGroup
          all={availableCurrencies}
          selected={currencies}
          onToggle={(v) => setCurrencies(toggle(currencies, v))}
        />
      </div>

      {availableMonths.length > 0 && (
        <div className="filter-group">
          <span className="filter-group-label">Período</span>
          <ChipGroup
            all={availableMonths}
            labels={Object.fromEntries(
              availableMonths.map((m) => [m, monthLabel(m)])
            )}
            selected={months}
            onToggle={(v) => setMonths(toggle(months, v))}
          />
        </div>
      )}

      <div className="topbar-row">
        <label className="pill">
          <input
            type="checkbox"
            checked={hideIncome}
            onChange={(e) => setHideIncome(e.target.checked)}
            style={{ margin: 0 }}
          />
          Sólo gastos
        </label>

        {dismissedCount > 0 && (
          <label className="pill">
            <input
              type="checkbox"
              checked={showDismissed}
              onChange={(e) => setShowDismissed(e.target.checked)}
              style={{ margin: 0 }}
            />
            Ver descartados ({dismissedCount})
          </label>
        )}

        <span className="muted" style={{ fontSize: 12 }}>
          {totalCount} txs
        </span>

        {hasActiveFilters && (
          <button onClick={reset} style={{ fontSize: 12 }}>
            Reset
          </button>
        )}
        {dismissedCount > 0 && (
          <button
            onClick={clearDismissed}
            style={{ fontSize: 12 }}
            title="Restaurar todos los descartados"
          >
            Limpiar descartes
          </button>
        )}
      </div>
    </div>
  );
}

interface ChipGroupProps<T extends string> {
  all: readonly T[];
  labels?: Record<string, string>;
  selected: Set<T>;
  onToggle: (value: T) => void;
}

function ChipGroup<T extends string>({
  all,
  labels,
  selected,
  onToggle,
}: ChipGroupProps<T>): JSX.Element {
  return (
    <div className="chip-group">
      {all.map((v) => {
        const active = selected.has(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            className="filter-chip"
            data-active={active ? "true" : undefined}
          >
            {labels?.[v] ?? v}
          </button>
        );
      })}
    </div>
  );
}
