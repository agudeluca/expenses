import { useMemo, useState } from "react";
import type { NormalizedTransaction, Source } from "../types";

export type SortBy = "date" | "amount";
export type SortDir = "asc" | "desc";

export interface FilterState {
  query: string;
  sources: Set<Source>;
  currencies: Set<string>;
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
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<Set<Source>>(new Set());
  const [currencies, setCurrencies] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const state: FilterState = { query, sources, currencies, sortBy, sortDir };

  const filtered = useMemo(() => applyFilters(items, state), [
    items,
    query,
    sources,
    currencies,
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
  }

  const hasActiveFilters =
    query.length > 0 || sources.size > 0 || currencies.size > 0;

  return {
    filtered,
    query,
    setQuery,
    sources,
    setSources,
    currencies,
    setCurrencies,
    sortBy,
    sortDir,
    toggleSort,
    reset,
    hasActiveFilters,
  };
}
