import type { NormalizedTransaction } from "../types";
import { SourceChip } from "./SourceChip";

const FORMATTERS: Record<string, Intl.NumberFormat> = {};

export function formatAmount(amount: number, currency: string): string {
  if (!FORMATTERS[currency]) {
    try {
      FORMATTERS[currency] = new Intl.NumberFormat(
        currency === "ARS" ? "es-AR" : "en-US",
        {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      );
    } catch {
      FORMATTERS[currency] = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }
  return FORMATTERS[currency].format(amount);
}

interface TxRowProps {
  tx: NormalizedTransaction;
  dismissed: boolean;
  onToggleDismiss: () => void;
}

export function TxRow({
  tx,
  dismissed,
  onToggleDismiss,
}: TxRowProps): JSX.Element {
  const isRefund = tx.amount < 0;
  return (
    <div
      className="tx-grid tabular"
      style={{
        borderBottom: "1px solid var(--row-border)",
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
      <div className="col-date">{tx.date}</div>
      <div className="col-source">
        <SourceChip source={tx.source} />
      </div>
      {/* col-meta only visible on mobile */}
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
      <div className="col-currency">{tx.currency}</div>
    </div>
  );
}
