import { useEffect, useMemo, useState } from "react";
import type { NormalizedTransaction } from "./types";
import { loadData } from "./data";
import { useFilters } from "./hooks/useFilters";
import { useGroupedByWeek } from "./hooks/useGroupedByWeek";
import { TopBar } from "./components/TopBar";
import { WeekTable } from "./components/WeekTable";

export function App(): JSX.Element {
  const [data, setData] = useState<NormalizedTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const items = data ?? [];
  const f = useFilters(items);
  const weeks = useGroupedByWeek(f.filtered);

  const availableCurrencies = useMemo(() => {
    const s = new Set<string>();
    for (const t of items) s.add(t.currency);
    return Array.from(s).sort();
  }, [items]);

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <h2>❌ error al cargar data.json</h2>
        <p className="muted">{error}</p>
        <p className="muted">
          ¿corriste <code>npm run build:data</code>?
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40 }} className="muted">
        cargando…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ padding: 40 }}>
        <h2>📭 sin transacciones</h2>
        <p className="muted">
          corré <code>npm run build:data</code> después de poner CSVs en
          src/data-*/
        </p>
      </div>
    );
  }

  return (
    <div>
      <TopBar
        query={f.query}
        setQuery={f.setQuery}
        sources={f.sources}
        setSources={f.setSources}
        currencies={f.currencies}
        setCurrencies={f.setCurrencies}
        availableCurrencies={availableCurrencies}
        hasActiveFilters={f.hasActiveFilters}
        reset={f.reset}
        totalCount={f.filtered.length}
      />
      <WeekTable
        weeks={weeks}
        sortBy={f.sortBy}
        sortDir={f.sortDir}
        toggleSort={f.toggleSort}
      />
    </div>
  );
}
