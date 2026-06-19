import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { NormalizedTransaction } from "../shared";
import { StatementSummary } from "../credito/index";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

interface Cell {
  label: string; // identidad de tarjeta (columna)
  currency: string; // "ARS" | "USD"
  value: number; // monto con signo (consumo +, devolución -)
  year: string;
  month: number; // 0-11
}

// Proyecta una transacción normalizada al consumo de tarjeta correspondiente.
// Solo tarjetas: galicia-credito y deel. Deel se reporta en USD (se factura en USD).
function toCell(tx: NormalizedTransaction): Cell | null {
  const year = tx.date.slice(0, 4);
  const month = parseInt(tx.date.slice(5, 7), 10) - 1;
  if (!year || Number.isNaN(month)) return null;

  if (tx.source === "galicia-credito") {
    const card =
      tx.meta && typeof tx.meta.card === "string" ? tx.meta.card : "";
    const num = card.replace(/^Visa\s+/i, "").trim();
    const label = num ? `Visa Galicia ${num}` : "Visa Galicia";
    return { label, currency: tx.currency, value: tx.amount, year, month };
  }

  if (tx.source === "deel") {
    const usd =
      tx.meta && typeof tx.meta.USDAmount === "number" ? tx.meta.USDAmount : 0;
    const signed = tx.amount < 0 ? -usd : usd;
    return { label: "Deel", currency: "USD", value: signed, year, month };
  }

  return null;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const colKey = (label: string, currency: string) => `${label}__${currency}`;

export interface YearMatrix {
  year: string;
  columns: { key: string; label: string; currency: string }[];
  // sums[month][colKey] = total
  sums: Map<number, Map<string, number>>;
}

export function buildYearMatrices(txs: NormalizedTransaction[]): YearMatrix[] {
  const byYear = new Map<string, YearMatrix>();

  for (const tx of txs) {
    const cell = toCell(tx);
    if (!cell) continue;

    let ym = byYear.get(cell.year);
    if (!ym) {
      ym = { year: cell.year, columns: [], sums: new Map() };
      byYear.set(cell.year, ym);
    }

    const key = colKey(cell.label, cell.currency);
    if (!ym.columns.some((c) => c.key === key)) {
      ym.columns.push({ key, label: cell.label, currency: cell.currency });
    }

    let monthMap = ym.sums.get(cell.month);
    if (!monthMap) {
      monthMap = new Map();
      ym.sums.set(cell.month, monthMap);
    }
    monthMap.set(key, (monthMap.get(key) ?? 0) + cell.value);
  }

  for (const ym of byYear.values()) {
    ym.columns.sort(
      (a, b) =>
        a.label.localeCompare(b.label) || a.currency.localeCompare(b.currency)
    );
  }

  return Array.from(byYear.values()).sort((a, b) =>
    a.year.localeCompare(b.year)
  );
}

// Saldo de cierre de la caja de ahorro por año/mes: el balance del último
// movimiento (cronológico) de cada mes. `meta.balance` es el saldo parcial que
// trae cada movimiento del extracto. El último de cada mes = saldo al cierre.
export function closingBalancesByYear(
  txs: NormalizedTransaction[]
): Map<string, Map<number, number>> {
  const byYear = new Map<string, Map<number, number>>();

  // Orden cronológico ascendente; el sort es estable, así que para movimientos
  // de la misma fecha se preserva el orden del extracto (ya cronológico) y el
  // último en ganar es el más reciente del mes.
  const extracto = txs
    .filter(
      (t) =>
        t.source === "galicia-extracto" && typeof t.meta?.balance === "number"
    )
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const tx of extracto) {
    const year = tx.date.slice(0, 4);
    const month = parseInt(tx.date.slice(5, 7), 10) - 1;
    if (!year || Number.isNaN(month)) continue;
    let months = byYear.get(year);
    if (!months) {
      months = new Map();
      byYear.set(year, months);
    }
    months.set(month, tx.meta!.balance as number); // último gana
  }

  return byYear;
}

// Deuda al cierre: TOTAL A PAGAR del último resumen del año (best-effort).
function debtForYear(
  statements: StatementSummary[],
  year: string
): { ars: number; usd: number; period: string } | null {
  const ofYear = statements
    .filter((s) => s.period.startsWith(year))
    .sort((a, b) => a.period.localeCompare(b.period));
  if (ofYear.length === 0) return null;
  const last = ofYear[ofYear.length - 1];
  return { ars: last.totalARS, usd: last.totalUSD, period: last.period };
}

export function buildYearSheet(
  ym: YearMatrix,
  statements: StatementSummary[],
  closingBalances?: Map<number, number>
): XLSX.WorkSheet {
  const cols = ym.columns;
  // Columna de saldo de caja de ahorro: solo si hay extracto para el año.
  const hasSaldo = !!closingBalances && closingBalances.size > 0;

  const header = [
    `Consumo tarjeta crédito ${ym.year}`,
    ...cols.map((c) => `${c.label} (${c.currency})`),
    "Total ARS",
    "Total USD",
    ...(hasSaldo ? ["Saldo caja de ahorro (ARS)"] : []),
  ];

  const aoa: (string | number)[][] = [header];

  const annual = new Map<string, number>();
  let annualARS = 0;
  let annualUSD = 0;

  for (let m = 0; m < 12; m++) {
    const monthMap = ym.sums.get(m);
    const row: (string | number)[] = [MESES[m]];
    let totalARS = 0;
    let totalUSD = 0;
    for (const c of cols) {
      const v = round2(monthMap?.get(c.key) ?? 0);
      row.push(v);
      annual.set(c.key, (annual.get(c.key) ?? 0) + v);
      if (c.currency === "ARS") totalARS += v;
      else if (c.currency === "USD") totalUSD += v;
    }
    row.push(round2(totalARS), round2(totalUSD));
    if (hasSaldo) {
      const saldo = closingBalances!.get(m);
      row.push(saldo === undefined ? "" : round2(saldo));
    }
    annualARS += totalARS;
    annualUSD += totalUSD;
    aoa.push(row);
  }

  const totalRow: (string | number)[] = ["Total anual"];
  for (const c of cols) totalRow.push(round2(annual.get(c.key) ?? 0));
  totalRow.push(round2(annualARS), round2(annualUSD));
  // El saldo no es una suma: en "Total anual" mostramos el saldo al cierre del
  // año (el último mes con movimiento).
  if (hasSaldo) {
    const lastMonth = Math.max(...closingBalances!.keys());
    totalRow.push(round2(closingBalances!.get(lastMonth)!));
  }
  aoa.push(totalRow);

  const debt = debtForYear(statements, ym.year);
  const debtRow: (string | number)[] = [
    debt ? `Deuda al cierre (${debt.period})` : "Deuda al cierre",
  ];
  for (const _ of cols) debtRow.push("");
  debtRow.push(debt ? round2(debt.ars) : "", debt ? round2(debt.usd) : "");
  if (hasSaldo) debtRow.push("");
  aoa.push(debtRow);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Ancho de columnas para que se lea.
  ws["!cols"] = [
    { wch: 26 },
    ...cols.map(() => ({ wch: 18 })),
    { wch: 16 },
    { wch: 14 },
    ...(hasSaldo ? [{ wch: 24 }] : []),
  ];
  return ws;
}

// Escribe un .xlsx por año en outDir. Devuelve las rutas escritas.
export function writeContadorReports(
  txs: NormalizedTransaction[],
  statements: StatementSummary[],
  outDir: string
): string[] {
  const matrices = buildYearMatrices(txs);
  if (matrices.length === 0) return [];

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const closing = closingBalancesByYear(txs);

  const written: string[] = [];
  for (const ym of matrices) {
    const wb = XLSX.utils.book_new();
    const ws = buildYearSheet(ym, statements, closing.get(ym.year));
    XLSX.utils.book_append_sheet(wb, ws, ym.year);
    const file = path.join(outDir, `contador-${ym.year}.xlsx`);
    XLSX.writeFile(wb, file);
    written.push(file);
  }
  return written;
}
