import type { NormalizedTransaction } from "../types";
import { formatAmount } from "./TxRow";
import { SourceChip } from "./SourceChip";
import { getWeekStart, formatDate } from "../../../src/shared";

interface Props {
  items: NormalizedTransaction[];
  isDismissed: (t: NormalizedTransaction) => boolean;
  toggleDismiss: (t: NormalizedTransaction) => void;
}

interface CurrencyStats {
  currency: string;
  total: number;
  dayCount: number;
  weekCount: number;
  dailyAvg: number;
  weeklyAvg: number;
  activeCount: number;
  visibleItems: NormalizedTransaction[];
}

function computeStats(
  items: NormalizedTransaction[],
  isDismissed: (t: NormalizedTransaction) => boolean
): CurrencyStats[] {
  const byCurrency = new Map<string, NormalizedTransaction[]>();
  for (const t of items) {
    const arr = byCurrency.get(t.currency);
    if (arr) arr.push(t);
    else byCurrency.set(t.currency, [t]);
  }

  const stats: CurrencyStats[] = [];
  for (const [currency, list] of byCurrency) {
    if (list.length === 0) continue;

    const active = list.filter((t) => !isDismissed(t));

    let total = 0;
    let dayCount = 0;
    let weekCount = 0;
    if (active.length > 0) {
      total = active.reduce((s, t) => s + t.amount, 0);
      const dates = active.map((t) => t.date).sort();
      const minDate = new Date(dates[0]);
      const maxDate = new Date(dates[dates.length - 1]);
      dayCount = Math.max(
        1,
        Math.floor(
          (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      );
      const weeks = new Set<string>();
      for (const t of active) {
        weeks.add(formatDate(getWeekStart(new Date(t.date))));
      }
      weekCount = Math.max(1, weeks.size);
    }

    const visibleItems = [...list].sort((a, b) => b.amount - a.amount);

    stats.push({
      currency,
      total,
      dayCount,
      weekCount,
      dailyAvg: dayCount > 0 ? total / dayCount : 0,
      weeklyAvg: weekCount > 0 ? total / weekCount : 0,
      activeCount: active.length,
      visibleItems,
    });
  }

  return stats.sort((a, b) => a.currency.localeCompare(b.currency));
}

export function AnalyticsView({
  items,
  isDismissed,
  toggleDismiss,
}: Props): JSX.Element {
  const stats = computeStats(items, isDismissed);

  if (stats.length === 0) {
    return (
      <div style={{ padding: 40 }} className="muted">
        📭 sin transacciones para analizar (con los filtros aplicados)
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 18px 60px" }}>
      {stats.map((s) => (
        <CurrencyBlock
          key={s.currency}
          stats={s}
          isDismissed={isDismissed}
          toggleDismiss={toggleDismiss}
        />
      ))}
    </div>
  );
}

function CurrencyBlock({
  stats,
  isDismissed,
  toggleDismiss,
}: {
  stats: CurrencyStats;
  isDismissed: (t: NormalizedTransaction) => boolean;
  toggleDismiss: (t: NormalizedTransaction) => void;
}): JSX.Element {
  return (
    <section
      style={{
        marginBottom: 28,
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg-elev)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>{stats.currency}</div>
        <div className="muted" style={{ fontSize: 11 }}>
          {stats.activeCount} txs · {stats.dayCount} días · {stats.weekCount}{" "}
          {stats.weekCount === 1 ? "semana" : "semanas"}
          {stats.visibleItems.length > stats.activeCount && (
            <>
              {" "}
              ·{" "}
              <span style={{ opacity: 0.7 }}>
                ({stats.visibleItems.length - stats.activeCount} descartados)
              </span>
            </>
          )}
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 1,
          background: "var(--border)",
        }}
      >
        <StatCard
          label="Total"
          value={formatAmount(stats.total, stats.currency)}
        />
        <StatCard
          label="Promedio diario"
          value={formatAmount(stats.dailyAvg, stats.currency)}
        />
        <StatCard
          label="Promedio semanal"
          value={formatAmount(stats.weeklyAvg, stats.currency)}
        />
      </div>

      <div
        style={{
          padding: "12px 18px",
          background: "var(--bg)",
          borderTop: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Top gastos (de mayor a menor)
      </div>

      <div>
        {stats.visibleItems.map((tx, i) => (
          <CompactRow
            key={i}
            tx={tx}
            rank={i + 1}
            dismissed={isDismissed(tx)}
            onToggleDismiss={() => toggleDismiss(tx)}
          />
        ))}
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "14px 18px", background: "var(--bg-elev)" }}>
      <div
        className="muted"
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        className="tabular"
        style={{ fontSize: 16, fontWeight: 600 }}
      >
        {value}
      </div>
    </div>
  );
}

function CompactRow({
  tx,
  rank,
  dismissed,
  onToggleDismiss,
}: {
  tx: NormalizedTransaction;
  rank: number;
  dismissed: boolean;
  onToggleDismiss: () => void;
}): JSX.Element {
  const isRefund = tx.amount < 0;
  return (
    <div
      className="cx-grid tabular"
      style={{
        borderBottom: "1px solid var(--row-border)",
        background: "var(--bg)",
        opacity: dismissed ? 0.4 : 1,
        textDecoration: dismissed ? "line-through" : "none",
      }}
    >
      <div className="col-check" style={{ display: "flex", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={dismissed}
          onChange={onToggleDismiss}
          title={dismissed ? "Restaurar" : "Descartar"}
          style={{ margin: 0, cursor: "pointer" }}
        />
      </div>
      <div className="col-rank muted" style={{ textAlign: "right" }}>
        {rank}.
      </div>
      <div className="col-date muted">{tx.date}</div>
      <div className="col-source">
        <SourceChip source={tx.source} />
      </div>
      <div className="col-meta">
        <span>{tx.date}</span>
        <SourceChip source={tx.source} />
      </div>
      <div
        className="col-desc"
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={tx.description}
      >
        {tx.description}
      </div>
      <div
        className="col-amount"
        style={{
          textAlign: "right",
          color: isRefund && !dismissed ? "var(--accent-positive)" : undefined,
          whiteSpace: "nowrap",
        }}
      >
        {formatAmount(tx.amount, tx.currency)}
      </div>
    </div>
  );
}
