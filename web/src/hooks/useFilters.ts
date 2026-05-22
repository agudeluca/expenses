import { useMemo } from "react";
import type { NormalizedTransaction, Source } from "../types";
import { usePersistedState, setCodec } from "./usePersistedState";

const K = {
  query: "expenses.filters.query.v1",
  sources: "expenses.filters.sources.v1",
  currencies: "expenses.filters.currencies.v1",
  hideIncome: "expenses.filters.hideIncome.v1",
  sortBy: "expenses.filters.sortBy.v1",
  sortDir: "expenses.filters.sortDir.v1",
};

export type SortBy = "date" | "amount";
export type SortDir = "asc" | "desc";

export interface FilterState {
  query: string;
  sources: Set<Source>;
  currencies: Set<string>;
  hideIncome: boolean;
  sortBy: SortBy;
  sortDir: SortDir;
}

export function applyFilters(
  items: NormalizedTransaction[],
  f: FilterState
): NormalizedTransaction[] {
  const q = f.query.trim().toLowerCase();
  const filtered = items.filter((t) => {
    if (f.sources.size > 0 && !f.sources.has(t.source)) return false;
    if (f.currencies.size > 0 && !f.currencies.has(t.currency)) return false;
    if (f.hideIncome && t.amount <= 0) return false;
    if (q && !t.description.toLowerCase().includes(q)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (f.sortBy === "date") {
      cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    } else {
      cmp = a.amount - b.amount;
    }
    return f.sortDir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export function useFilters(items: NormalizedTransaction[]) {
  const [query, setQuery] = usePersistedState<string>(K.query, "");
  const [sources, setSources] = usePersistedState<Set<Source>>(
    K.sources,
    new Set(),
    setCodec<Source>()
  );
  const [currencies, setCurrencies] = usePersistedState<Set<string>>(
    K.currencies,
    new Set(),
    setCodec<string>()
  );
  const [hideIncome, setHideIncome] = usePersistedState<boolean>(
    K.hideIncome,
    false
  );
  const [sortBy, setSortBy] = usePersistedState<SortBy>(K.sortBy, "date");
  const [sortDir, setSortDir] = usePersistedState<SortDir>(K.sortDir, "desc");

  const state: FilterState = {
    query,
    sources,
    currencies,
    hideIncome,
    sortBy,
    sortDir,
  };

  const filtered = useMemo(() => applyFilters(items, state), [
    items,
    query,
    sources,
    currencies,
    hideIncome,
    sortBy,
    sortDir,
  ]);

  function toggleSort(col: SortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "date" ? "desc" : "desc");
    }
  }

  function reset() {
    setQuery("");
    setSources(new Set());
    setCurrencies(new Set());
    setHideIncome(false);
  }

  const hasActiveFilters =
    query.length > 0 ||
    sources.size > 0 ||
    currencies.size > 0 ||
    hideIncome;

  return {
    filtered,
    query,
    setQuery,
    sources,
    setSources,
    currencies,
    setCurrencies,
    hideIncome,
    setHideIncome,
    sortBy,
    sortDir,
    toggleSort,
    reset,
    hasActiveFilters,
  };
}
