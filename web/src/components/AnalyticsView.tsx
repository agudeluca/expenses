import type { NormalizedTransaction } from "../types";
import { formatAmount } from "./TxRow";
import { SourceChip } from "./SourceChip";
import { getWeekStart, formatDate } from "../../../src/shared";

interface Props {
  items: NormalizedTransaction[];
  isDismissed: (t: NormalizedTransaction) => boolean;
  toggleDismiss: (t: NormalizedTransaction) => void;
}

interface WeekBreakdown {
  weekStart: string;
  weekEnd: string;
  total: number;
  count: number;
  top: NormalizedTransaction[];
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
  weeks: WeekBreakdown[];
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
    const weekMap = new Map<
      string,
      { total: number; count: number; items: NormalizedTransaction[] }
    >();
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
      for (const t of active) {
        const ws = formatDate(getWeekStart(new Date(t.date)));
        const entry = weekMap.get(ws);
        if (entry) {
          entry.total += t.amount;
          entry.count += 1;
          entry.items.push(t);
        } else {
          weekMap.set(ws, { total: t.amount, count: 1, items: [t] });
        }
      }
      weekCount = Math.max(1, weekMap.size);
    }

    const visibleItems = [...list].sort((a, b) => b.amount - a.amount);

    const weeks: WeekBreakdown[] = Array.from(weekMap.entries())
      .map(([weekStart, v]) => {
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        const top = [...v.items]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3);
        return {
          weekStart,
          weekEnd: formatDate(end),
          total: v.total,
          count: v.count,
          top,
        };
      })
      .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));

    stats.push({
      currency,
      total,
      dayCount,
      weekCount,
      dailyAvg: dayCount > 0 ? total / dayCount : 0,
      weeklyAvg: dayCount > 0 ? (total / dayCount) * 7 : 0,
      activeCount: active.length,
      visibleItems,
      weeks,
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

      {stats.weeks.length > 0 && (
        <>
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
            Totales semanales
          </div>
          <div style={{ background: "var(--bg)" }}>
            {stats.weeks.map((w) => (
              <div
                key={w.weekStart}
                style={{ borderTop: "1px solid var(--row-border)" }}
              >
                <div
                  className="tabular"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 12,
                    padding: "8px 18px",
                    alignItems: "baseline",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>
                      {w.weekStart} → {w.weekEnd}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {w.count} {w.count === 1 ? "tx" : "txs"}
                  </div>
                  <div
                    style={{
                      fontWeight: 500,
                      minWidth: 130,
                      textAlign: "right",
                    }}
                  >
                    {formatAmount(w.total, stats.currency)}
                  </div>
                </div>
                {w.top.length > 0 && (
                  <div style={{ padding: "0 18px 8px" }}>
                    {w.top.map((tx, i) => (
                      <div
                        key={i}
                        className="tabular"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "20px 1fr auto",
                          gap: 12,
                          padding: "3px 0",
                          fontSize: 12,
                          color: "var(--text-muted)",
                          alignItems: "baseline",
                        }}
                        title={tx.description}
                      >
                        <div style={{ textAlign: "right" }}>{i + 1}.</div>
                        <div
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {tx.description}
                        </div>
                        <div
                          style={{
                            minWidth: 130,
                            textAlign: "right",
                            color:
                              tx.amount < 0
                                ? "var(--accent-positive)"
                                : "var(--text)",
                          }}
                        >
                          {formatAmount(tx.amount, stats.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

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
