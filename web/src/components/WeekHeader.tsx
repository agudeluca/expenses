import type { WeekGroup } from "../hooks/useGroupedByWeek";
import { formatAmount } from "./TxRow";

export function WeekHeader({ group }: { group: WeekGroup }): JSX.Element {
  const currencies = Object.keys(group.totals).sort();
  return (
    <div className="week-header">
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
