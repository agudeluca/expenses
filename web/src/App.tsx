import { useEffect, useMemo, useState } from "react";
import type { NormalizedTransaction } from "./types";
import { loadData } from "./data";
import { useFilters } from "./hooks/useFilters";
import { useGroupedByWeek } from "./hooks/useGroupedByWeek";
import { useDismissed } from "./hooks/useDismissed";
import { usePersistedState } from "./hooks/usePersistedState";
import { TopBar } from "./components/TopBar";
import { WeekTable } from "./components/WeekTable";
import { Tabs, type Tab } from "./components/Tabs";
import { AnalyticsView } from "./components/AnalyticsView";

export function App(): JSX.Element {
  const [data, setData] = useState<NormalizedTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = usePersistedState<Tab>(
    "expenses.tab.v1",
    "transactions"
  );

  useEffect(() => {
    loadData()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const items = data ?? [];
  const f = useFilters(items);
  const d = useDismissed();

  const visibleFiltered = useMemo(() => {
    if (d.showDismissed) return f.filtered;
    return f.filtered.filter((t) => !d.isDismissed(t));
  }, [f.filtered, d.showDismissed, d.isDismissed]);

  const weeks = useGroupedByWeek(visibleFiltered);

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
          ¿corriste <code>npm run build</code>?
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
          corré <code>npm run build</code> después de poner los PDFs/CSV en
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
        hideIncome={f.hideIncome}
        setHideIncome={f.setHideIncome}
        availableCurrencies={availableCurrencies}
        hasActiveFilters={f.hasActiveFilters}
        reset={f.reset}
        totalCount={visibleFiltered.length}
        dismissedCount={d.count}
        showDismissed={d.showDismissed}
        setShowDismissed={d.setShowDismissed}
        clearDismissed={d.clearAll}
      />
      <Tabs active={tab} setActive={setTab} />
      {tab === "transactions" ? (
        <WeekTable
          weeks={weeks}
          sortBy={f.sortBy}
          sortDir={f.sortDir}
          toggleSort={f.toggleSort}
          isDismissed={d.isDismissed}
          toggleDismiss={d.toggle}
        />
      ) : (
        <AnalyticsView
          items={visibleFiltered}
          isDismissed={d.isDismissed}
          toggleDismiss={d.toggle}
        />
      )}
    </div>
  );
}
