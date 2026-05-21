import * as fs from "fs";
import * as path from "path";
import {
  WeeklyGroup,
  groupByWeek,
  NormalizedTransaction,
} from "../shared";
import { tokenizeCSV } from "../galicia/index";

const DATA_DIR = path.join(__dirname, "..", "data-credito");
const EXPECTED_HEADER = [
  "Fecha",
  "Tarjeta/Tipo",
  "Descripcion",
  "Monto ARS",
  "Monto USD",
];

export interface CreditoTransaction {
  date: string;
  card: string;
  description: string;
  amountARS: number;
  amountUSD: number;
}

function parseDDMMYYYY(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

function isHeader(row: string[]): boolean {
  if (row.length < EXPECTED_HEADER.length) return false;
  return EXPECTED_HEADER.every((h, idx) => row[idx]?.trim() === h);
}

function stripBOM(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCreditoCSV(text: string): CreditoTransaction[] {
  const rows = tokenizeCSV(stripBOM(text));
  const headerIdx = rows.findIndex(isHeader);
  if (headerIdx === -1) {
    throw new Error(
      "header no encontrado, ¿es un resumen de tarjeta crédito Galicia? (esperaba 'Fecha,Tarjeta/Tipo,Descripcion,Monto ARS,Monto USD')"
    );
  }

  const out: CreditoTransaction[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < EXPECTED_HEADER.length) continue;

    const date = parseDDMMYYYY(row[0] ?? "");
    if (!date) continue;

    const amountARS = parseDecimal(row[3] ?? "");
    const amountUSD = parseDecimal(row[4] ?? "");
    if (amountARS === null || amountUSD === null) continue;

    out.push({
      date,
      card: (row[1] ?? "").trim(),
      description: (row[2] ?? "").trim(),
      amountARS,
      amountUSD,
    });
  }

  return out;
}

export function toNormalized(
  rows: CreditoTransaction[]
): NormalizedTransaction[] {
  const out: NormalizedTransaction[] = [];
  for (const row of rows) {
    if (row.card === "-") continue;
    const meta = { card: row.card };
    if (row.amountARS !== 0) {
      out.push({
        date: row.date,
        description: row.description,
        amount: row.amountARS,
        currency: "ARS",
        source: "galicia-credito",
        meta,
      });
    }
    if (row.amountUSD !== 0) {
      out.push({
        date: row.date,
        description: row.description,
        amount: row.amountUSD,
        currency: "USD",
        source: "galicia-credito",
        meta,
      });
    }
  }
  return out;
}

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(currency: string, n: number): string {
  return currency === "ARS" ? arsFormatter.format(n) : usdFormatter.format(n);
}

function displayPass(
  currency: string,
  nts: NormalizedTransaction[]
): void {
  console.log(`\n📊 Weekly Summary (${currency}) — Tarjeta Crédito Galicia\n`);
  console.log("=".repeat(80));

  if (nts.length === 0) {
    console.log(`📭 sin movimientos en ${currency}`);
    return;
  }

  const weeks = groupByWeek(
    nts,
    (t) => new Date(t.date),
    (t) => t.amount
  );

  weeks.forEach((week) => {
    console.log(`\n📅 Week of ${week.weekStart} to ${week.weekEnd}`);
    console.log(`💰 Total: ${formatCurrency(currency, week.total)}`);
    console.log(`📝 Transactions: ${week.transactionCount}`);

    const sorted = [...week.transactions].sort((a, b) => b.amount - a.amount);
    if (sorted.length > 0) {
      console.log("All transactions:");
      sorted.forEach((tx, index) => {
        const card =
          tx.meta && typeof tx.meta.card === "string" ? tx.meta.card : "-";
        console.log(
          `   ${index + 1}. ${card} — ${tx.description} — ${formatCurrency(
            currency,
            tx.amount
          )} — ${tx.date}`
        );
      });
    }
    console.log("-".repeat(40));
  });

  const totalAmount = weeks.reduce((sum, w) => sum + w.total, 0);
  const totalCount = weeks.reduce((sum, w) => sum + w.transactionCount, 0);
  const avg = weeks.length > 0 ? totalAmount / weeks.length : 0;

  console.log(`\n📈 Summary Statistics (${currency}):`);
  console.log(`💰 Total amount: ${formatCurrency(currency, totalAmount)}`);
  console.log(`📝 Total transactions: ${totalCount}`);
  console.log(`📊 Average per week: ${formatCurrency(currency, avg)}`);
  console.log(`📅 Number of weeks: ${weeks.length}`);
}

export function displayCreditoWeekly(nts: NormalizedTransaction[]): void {
  displayPass("ARS", nts.filter((n) => n.currency === "ARS"));
  displayPass("USD", nts.filter((n) => n.currency === "USD"));
}

export function main(): void {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ directorio no encontrado: ${DATA_DIR}`);
    process.exit(1);
  }

  const csvFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort();

  if (csvFiles.length === 0) {
    console.error("❌ no hay csv en src/data-credito/");
    process.exit(1);
  }

  const all: CreditoTransaction[] = [];
  csvFiles.forEach((file) => {
    const content = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
    all.push(...parseCreditoCSV(content));
  });

  if (all.length === 0) {
    console.log("📭 el resumen está vacío");
    return;
  }

  const nts = toNormalized(all);
  console.log(
    `📄 Loaded ${all.length} rows from CSV (${nts.length} normalized transactions after filtering pagos)`
  );

  displayCreditoWeekly(nts);
}

if (require.main === module) {
  main();
}
