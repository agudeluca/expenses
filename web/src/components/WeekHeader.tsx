import type { WeekGroup } from "../hooks/useGroupedByWeek";
import { formatAmount } from "./TxRow";

export function WeekHeader({ group }: { group: WeekGroup }): JSX.Element {
  const currencies = Object.keys(group.totals).sort();
  return (
    <div
      style={{
        padding: "12px 18px",
        background: "var(--bg-elev)",
        borderBottom: "1px solid var(--border)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        flexWrap: "wrap",
        position: "sticky",
        top: 51,
        zIndex: 5,
      }}
    >
      <div>
        <span style={{ fontWeight: 600 }}>
          Semana {group.weekStart} → {group.weekEnd}
        </span>
        <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
          {group.count} transacciones
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          fontSize: 12,
        }}
        className="tabular"
      >
        {currencies.map((c) => (
          <span key={c}>
            <span className="muted">{c}</span>{" "}
            <span>{formatAmount(group.totals[c], c)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
