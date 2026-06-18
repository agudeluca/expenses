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
  statements: StatementSummary[]
): XLSX.WorkSheet {
  const cols = ym.columns;

  const header = [
    `Consumo tarjeta crédito ${ym.year}`,
    ...cols.map((c) => `${c.label} (${c.currency})`),
    "Total ARS",
    "Total USD",
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
    annualARS += totalARS;
    annualUSD += totalUSD;
    aoa.push(row);
  }

  const totalRow: (string | number)[] = ["Total anual"];
  for (const c of cols) totalRow.push(round2(annual.get(c.key) ?? 0));
  totalRow.push(round2(annualARS), round2(annualUSD));
  aoa.push(totalRow);

  const debt = debtForYear(statements, ym.year);
  const debtRow: (string | number)[] = [
    debt ? `Deuda al cierre (${debt.period})` : "Deuda al cierre",
  ];
  for (const _ of cols) debtRow.push("");
  debtRow.push(debt ? round2(debt.ars) : "", debt ? round2(debt.usd) : "");
  aoa.push(debtRow);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Ancho de columnas para que se lea.
  ws["!cols"] = [
    { wch: 26 },
    ...cols.map(() => ({ wch: 18 })),
    { wch: 16 },
    { wch: 14 },
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

  const written: string[] = [];
  for (const ym of matrices) {
    const wb = XLSX.utils.book_new();
    const ws = buildYearSheet(ym, statements);
    XLSX.utils.book_append_sheet(wb, ws, ym.year);
    const file = path.join(outDir, `contador-${ym.year}.xlsx`);
    XLSX.writeFile(wb, file);
    written.push(file);
  }
  return written;
}
