import { NormalizedTransaction } from "../shared";
import { tokenizeCSV, stripBOM } from "../csv";

export { getWeekStart, getWeekEnd, formatDate, groupByWeek } from "../shared";
export type { WeeklyGroup } from "../shared";

import type { WeeklyGroup } from "../shared";

export interface Transaction {
  originalCurrency: string;
  originalAmount: number;
  USDAmount: number;
  date: string;
  mcc: string;
  merchantName: string;
  merchantCountry: string;
  status: string;
  declineReason: string;
  authCode: string;
  type: string;
  externalTxId: string;
  externalRootTxId: string;
  apiTransaction: string;
  last4: string;
}

export type WeeklyExpense = WeeklyGroup<Transaction>;

// Mapea por nombre de columna (no por índice) para ser robusto al orden y a las
// comas internas del blob JSON de `apiTransaction` (que tokenizeCSV respeta).
export function parseCSV(csvContent: string): Transaction[] {
  const rows = tokenizeCSV(stripBOM(csvContent.trim()), ",");
  if (rows.length <= 1) return [];

  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const ci = {
    originalCurrency: col("originalCurrency"),
    originalAmount: col("originalAmount"),
    USDAmount: col("USDAmount"),
    date: col("date"),
    mcc: col("mcc"),
    merchantName: col("merchantName"),
    merchantCountry: col("merchantCountry"),
    status: col("status"),
    declineReason: col("declineReason"),
    authCode: col("authCode"),
    type: col("type"),
    externalTxId: col("externalTxId"),
    externalRootTxId: col("externalRootTxId"),
    apiTransaction: col("apiTransaction"),
    last4: col("last4"),
  };

  const at = (values: string[], i: number) => (i >= 0 ? values[i] ?? "" : "");
  const num = (values: string[], i: number) => parseFloat(at(values, i)) || 0;

  return rows.slice(1).map((values) => ({
    originalCurrency: at(values, ci.originalCurrency),
    originalAmount: num(values, ci.originalAmount),
    USDAmount: num(values, ci.USDAmount),
    date: at(values, ci.date),
    mcc: at(values, ci.mcc),
    merchantName: at(values, ci.merchantName),
    merchantCountry: at(values, ci.merchantCountry),
    status: at(values, ci.status),
    declineReason: at(values, ci.declineReason),
    authCode: at(values, ci.authCode),
    type: at(values, ci.type),
    externalTxId: at(values, ci.externalTxId),
    externalRootTxId: at(values, ci.externalRootTxId),
    apiTransaction: at(values, ci.apiTransaction),
    last4: at(values, ci.last4),
  }));
}

export function toNormalized(rows: Transaction[]): NormalizedTransaction[] {
  return rows.map((t) => {
    const signedAmount =
      t.type === "REFUND" ? -t.originalAmount : t.originalAmount;
    return {
      date: t.date.slice(0, 10),
      description: t.merchantName,
      amount: signedAmount,
      currency: t.originalCurrency,
      source: "deel",
      meta: {
        mcc: t.mcc,
        merchantCountry: t.merchantCountry,
        status: t.status,
        last4: t.last4,
        type: t.type,
        USDAmount: t.USDAmount,
      },
    };
  });
}
