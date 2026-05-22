import { useCallback, useEffect, useState } from "react";
import type { NormalizedTransaction } from "../types";
import { usePersistedState } from "./usePersistedState";

const STORAGE_KEY = "expenses.dismissed.v1";
const SHOW_KEY = "expenses.dismissed.show.v1";

export function dismissKey(t: NormalizedTransaction): string {
  return [t.source, t.date, t.currency, t.amount, t.description].join("|");
}

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function persist(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage may be disabled — silent fail is fine for personal tool
  }
}

export function useDismissed() {
  const [dismissed, setDismissed] = useState<Set<string>>(() => load());
  const [showDismissed, setShowDismissed] = usePersistedState<boolean>(
    SHOW_KEY,
    false
  );

  useEffect(() => {
    persist(dismissed);
  }, [dismissed]);

  const toggle = useCallback((t: NormalizedTransaction) => {
    setDismissed((prev) => {
      const k = dismissKey(t);
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const isDismissed = useCallback(
    (t: NormalizedTransaction) => dismissed.has(dismissKey(t)),
    [dismissed]
  );

  const clearAll = useCallback(() => setDismissed(new Set()), []);

  return {
    dismissed,
    isDismissed,
    toggle,
    showDismissed,
    setShowDismissed,
    clearAll,
    count: dismissed.size,
  };
}
