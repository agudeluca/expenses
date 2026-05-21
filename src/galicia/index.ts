import * as fs from "fs";
import * as path from "path";
import { WeeklyGroup, groupByWeek, NormalizedTransaction } from "../shared";

const DATA_DIR = path.join(__dirname, "..", "data-galicia");
const EXPECTED_HEADER = [
  "Fecha",
  "Movimiento",
  "Débito",
  "Crédito",
  "Saldo Parcial",
  "Comentarios",
];

export interface GaliciaTransaction {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  comments: string;
}

export function tokenizeCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    field += ch;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseSpanishAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseSpanishDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeDescription(raw: string): string {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join(" | ");
}

function isHeader(row: string[]): boolean {
  if (row.length < EXPECTED_HEADER.length) return false;
  return EXPECTED_HEADER.every(
    (h, idx) => row[idx]?.trim() === h
  );
}

export function parseGaliciaCSV(text: string): GaliciaTransaction[] {
  const rows = tokenizeCSV(text);
  const headerIdx = rows.findIndex(isHeader);
  if (headerIdx === -1) {
    throw new Error(
      "header no encontrado, ¿es un extracto de Galicia? (esperaba 'Fecha,Movimiento,Débito,Crédito,Saldo Parcial,Comentarios')"
    );
  }

  const out: GaliciaTransaction[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 5) continue;

    const date = parseSpanishDate(row[0] ?? "");
    if (!date) continue;

    const debitRaw = parseSpanishAmount(row[2] ?? "");
    const creditRaw = parseSpanishAmount(row[3] ?? "");
    const balance = parseSpanishAmount(row[4] ?? "");
    if (debitRaw === null || creditRaw === null || balance === null) continue;

    out.push({
      date,
      description: normalizeDescription(row[1] ?? ""),
      debit: Math.abs(debitRaw),
      credit: creditRaw,
      balance,
      comments: (row[5] ?? "").trim(),
    });
  }

  return out;
}

export function toNormalized(
  rows: GaliciaTransaction[]
): NormalizedTransaction[] {
  const out: NormalizedTransaction[] = [];
  for (const row of rows) {
    const meta = { balance: row.balance, comments: row.comments };
    if (row.debit > 0) {
      out.push({
        date: row.date,
        description: row.description,
        amount: row.debit,
        currency: "ARS",
        source: "galicia-extracto",
        meta,
      });
    }
    if (row.credit > 0) {
      out.push({
        date: row.date,
        description: row.description,
        amount: -row.credit,
        currency: "ARS",
        source: "galicia-extracto",
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

function formatARS(n: number): string {
  return arsFormatter.format(n);
}

function firstLine(description: string): string {
  const idx = description.indexOf(" | ");
  return idx === -1 ? description : description.slice(0, idx);
}

export function displayGaliciaWeekly(
  weeks: WeeklyGroup<GaliciaTransaction>[]
): void {
  console.log("\n📊 Weekly Expenses Summary (ARS) — Banco Galicia\n");
  console.log("=".repeat(80));

  weeks.forEach((week) => {
    console.log(`\n📅 Week of ${week.weekStart} to ${week.weekEnd}`);
    console.log(`💰 Total: ${formatARS(week.total)}`);
    console.log(`📝 Transactions: ${week.transactionCount}`);

    const sorted = week.transactions.sort((a, b) => b.debit - a.debit);
    if (sorted.length > 0) {
      console.log("All transactions:");
      sorted.forEach((tx, index) => {
        console.log(
          `   ${index + 1}. ${tx.description} - ${formatARS(
            tx.debit
          )} (ARS ${tx.debit.toFixed(2)}) - ${tx.date}`
        );
      });
    }
    console.log("-".repeat(40));
  });

  const totalAmount = weeks.reduce((sum, week) => sum + week.total, 0);
  const totalTransactions = weeks.reduce(
    (sum, week) => sum + week.transactionCount,
    0
  );
  const averagePerWeek = weeks.length > 0 ? totalAmount / weeks.length : 0;

  console.log("\n📈 Summary Statistics:");
  console.log(`💰 Total amount: ${formatARS(totalAmount)}`);
  console.log(`📝 Total transactions: ${totalTransactions}`);
  console.log(`📊 Average per week: ${formatARS(averagePerWeek)}`);
  console.log(`📅 Number of weeks: ${weeks.length}`);

  const allDebits = weeks
    .flatMap((w) => w.transactions)
    .sort((a, b) => b.debit - a.debit);
  const topN = Math.min(10, allDebits.length);
  if (topN > 0) {
    console.log(`\n🏆 Top ${topN} transactions of the period:`);
    for (let i = 0; i < topN; i++) {
      const tx = allDebits[i];
      console.log(
        `   ${i + 1}. ${formatARS(tx.debit)} - ${tx.date} - ${tx.description}`
      );
    }
  }
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
    console.error(
      "❌ no hay csv en src/data-galicia/. ¿Corriste 'npm run galicia:convert'?"
    );
    process.exit(1);
  }

  const all: GaliciaTransaction[] = [];
  csvFiles.forEach((file) => {
    const content = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
    all.push(...parseGaliciaCSV(content));
  });

  if (all.length === 0) {
    console.log("📭 el extracto está vacío");
    return;
  }

  const debits = all.filter((t) => t.debit > 0);

  console.log(`📄 Loaded ${debits.length} transactions from CSV`);

  const weeks = groupByWeek(
    debits,
    (t) => new Date(t.date),
    (t) => t.debit
  );
  displayGaliciaWeekly(weeks);
}

if (require.main === module) {
  main();
}
