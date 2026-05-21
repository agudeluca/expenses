export interface WeeklyGroup<T> {
  weekStart: string;
  weekEnd: string;
  total: number;
  transactionCount: number;
  transactions: T[];
}

export type Source = "deel" | "galicia-extracto" | "galicia-credito";

export interface NormalizedTransaction {
  date: string;
  description: string;
  amount: number;
  currency: string;
  source: Source;
  meta?: Record<string, unknown>;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDay();

  if (day === 0) {
    d.setUTCDate(d.getUTCDate() + 1);
  } else if (day > 1) {
    d.setUTCDate(d.getUTCDate() - (day - 1));
  }

  return d;
}

export function getWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function groupByWeek<T>(
  items: T[],
  getDate: (t: T) => Date,
  getAmount: (t: T) => number
): WeeklyGroup<T>[] {
  const weeklyMap = new Map<string, WeeklyGroup<T>>();

  items.forEach((item) => {
    const weekStart = getWeekStart(getDate(item));
    const weekKey = formatDate(weekStart);

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, {
        weekStart: formatDate(weekStart),
        weekEnd: formatDate(getWeekEnd(weekStart)),
        total: 0,
        transactionCount: 0,
        transactions: [],
      });
    }

    const group = weeklyMap.get(weekKey)!;
    group.total += getAmount(item);
    group.transactionCount += 1;
    group.transactions.push(item);
  });

  return Array.from(weeklyMap.values()).sort(
    (a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  );
}
