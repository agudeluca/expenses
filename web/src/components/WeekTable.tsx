import type { WeekGroup } from "../hooks/useGroupedByWeek";
import type { SortBy, SortDir } from "../hooks/useFilters";
import { WeekHeader } from "./WeekHeader";
import { TxRow } from "./TxRow";

interface Props {
  weeks: WeekGroup[];
  sortBy: SortBy;
  sortDir: SortDir;
  toggleSort: (col: SortBy) => void;
}

export function WeekTable({
  weeks,
  sortBy,
  sortDir,
  toggleSort,
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
            <TxRow key={`${w.weekStart}-${i}`} tx={tx} />
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
      style={{
        padding: "8px 18px",
        display: "grid",
        gridTemplateColumns: "96px 90px 1fr 130px 60px",
        gap: 12,
        color: "var(--text-muted)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 51,
        background: "var(--bg)",
        zIndex: 6,
      }}
    >
      <button
        onClick={() => toggleSort("date")}
        style={{ textAlign: "left" }}
      >
        Fecha{arrow("date")}
      </button>
      <div>Fuente</div>
      <div>Descripción</div>
      <button
        onClick={() => toggleSort("amount")}
        style={{ textAlign: "right" }}
      >
        Monto{arrow("amount")}
      </button>
      <div>Mon.</div>
    </div>
  );
}
