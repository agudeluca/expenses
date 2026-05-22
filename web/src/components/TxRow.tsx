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

export const ROW_GRID =
  "grid-template-columns: 96px 90px 1fr 130px 60px; gap: 12px;";

export function TxRow({ tx }: { tx: NormalizedTransaction }): JSX.Element {
  const isRefund = tx.amount < 0;
  return (
    <div
      style={{
        padding: "8px 18px",
        display: "grid",
        gridTemplateColumns: "96px 90px 1fr 130px 60px",
        gap: 12,
        borderBottom: "1px solid var(--row-border)",
      }}
      className="tabular"
    >
      <div>{tx.date}</div>
      <div>
        <SourceChip source={tx.source} />
      </div>
      <div
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
        style={{
          textAlign: "right",
          color: isRefund ? "var(--accent-positive)" : undefined,
        }}
      >
        {formatAmount(tx.amount, tx.currency)}
      </div>
      <div className="muted">{tx.currency}</div>
    </div>
  );
}
