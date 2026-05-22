import { useMemo } from "react";
import type { NormalizedTransaction } from "../types";
import { getWeekStart, getWeekEnd, formatDate } from "../../../src/shared";

export interface WeekGroup {
  weekStart: string;
  weekEnd: string;
  transactions: NormalizedTransaction[];
  totals: Record<string, number>;
  count: number;
}

export function groupByWeek(
  items: NormalizedTransaction[]
): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  for (const t of items) {
    const ws = getWeekStart(new Date(t.date));
    const key = formatDate(ws);
    let g = map.get(key);
    if (!g) {
      g = {
        weekStart: formatDate(ws),
        weekEnd: formatDate(getWeekEnd(ws)),
        transactions: [],
        totals: {},
        count: 0,
      };
      map.set(key, g);
    }
    g.transactions.push(t);
    g.totals[t.currency] = (g.totals[t.currency] ?? 0) + t.amount;
    g.count += 1;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0
  );
}

export function useGroupedByWeek(items: NormalizedTransaction[]): WeekGroup[] {
  return useMemo(() => groupByWeek(items), [items]);
}
