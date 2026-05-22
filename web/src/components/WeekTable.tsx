import type { NormalizedTransaction } from "../types";
import type { WeekGroup } from "../hooks/useGroupedByWeek";
import type { SortBy, SortDir } from "../hooks/useFilters";
import { WeekHeader } from "./WeekHeader";
import { TxRow } from "./TxRow";

interface Props {
  weeks: WeekGroup[];
  sortBy: SortBy;
  sortDir: SortDir;
  toggleSort: (col: SortBy) => void;
  isDismissed: (t: NormalizedTransaction) => boolean;
  toggleDismiss: (t: NormalizedTransaction) => void;
}

export function WeekTable({
  weeks,
  sortBy,
  sortDir,
  toggleSort,
  isDismissed,
  toggleDismiss,
}: Props): JSX.Element {
  if (weeks.length === 0) {
    return (
      <div
        style={{ padding: 40, textAlign: "center" }}
        className="muted"
      >
        📭 sin transacciones
      </div>
    );
  }

  return (
    <div>
      <ColumnHeaders
        sortBy={sortBy}
        sortDir={sortDir}
        toggleSort={toggleSort}
      />
      {weeks.map((w) => (
        <div key={w.weekStart}>
          <WeekHeader group={w} />
          {w.transactions.map((tx, i) => (
            <TxRow
              key={`${w.weekStart}-${i}`}
              tx={tx}
              dismissed={isDismissed(tx)}
              onToggleDismiss={() => toggleDismiss(tx)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ColumnHeaders({
  sortBy,
  sortDir,
  toggleSort,
}: {
  sortBy: SortBy;
  sortDir: SortDir;
  toggleSort: (c: SortBy) => void;
}) {
  const arrow = (col: SortBy) =>
    sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <div
      className="tx-grid tx-grid-headers"
      style={{
        color: "var(--text-muted)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
      }}
    >
      <div className="col-check" />
      <button
        onClick={() => toggleSort("date")}
        style={{ textAlign: "left" }}
        className="col-date"
      >
        Fecha{arrow("date")}
      </button>
      <div className="col-source">Fuente</div>
      <div className="col-desc">Descripción</div>
      <button
        onClick={() => toggleSort("amount")}
        style={{ textAlign: "right" }}
        className="col-amount"
      >
        Monto{arrow("amount")}
      </button>
      <div className="col-currency">Mon.</div>
    </div>
  );
}
