import { NormalizedTransaction } from "../shared";
import { extractRows, TextRow, rowText } from "../pdf/extract";
import { parseSpanishAmount } from "../csv";

export interface GaliciaTransaction {
  date: string;
  description: string;
  debit: number; // gasto, valor absoluto
  credit: number; // ingreso
  balance: number; // saldo parcial
}

// Columna de montos: Crédito ~308, Débito ~423, Saldo ~540. La descripción está
// en ~82 (e ítems de detalle, CBU, nombres) — por debajo de este umbral no se
// considera "monto" para no confundir un CBU con un número.
const AMOUNT_MIN_X = 270;
// La descripción (y sus líneas de detalle) arrancan en x≈82.
const DESC_MIN_X = 74;
const DESC_MAX_X = 100;

function parseGaliciaDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const yyyy = yy.length === 2 ? `20${yy}` : yy;
  return `${yyyy}-${mm}-${dd}`;
}

function isHeaderRow(row: TextRow): boolean {
  const t = rowText(row);
  return /Fecha/.test(t) && /Descripci/.test(t) && /Saldo/.test(t);
}

function isNoiseRow(row: TextRow): boolean {
  const t = rowText(row);
  return (
    /Página/.test(t) ||
    /Resumen de Caja/.test(t) ||
    /^\d{15,}[A-Z]?$/.test(t.replace(/\s/g, ""))
  );
}

function isTotalRow(row: TextRow): boolean {
  const first = row.tokens[0];
  return !!first && first.x < 70 && /^Total$/i.test(first.str.trim());
}

interface Amount {
  x: number;
  value: number;
}

function amountTokens(row: TextRow): Amount[] {
  const out: Amount[] = [];
  for (const tok of row.tokens) {
    if (tok.x < AMOUNT_MIN_X) continue;
    const v = parseSpanishAmount(tok.str);
    if (v !== null) out.push({ x: tok.x, value: v });
  }
  return out;
}

// De los montos de una fila: el más a la derecha es el saldo; el otro es el
// movimiento (negativo = débito, positivo = crédito).
function classifyAmounts(amounts: Amount[]): {
  credit: number;
  debit: number;
  balance: number;
} {
  const sorted = [...amounts].sort((a, b) => a.x - b.x);
  const balance = sorted.length > 0 ? sorted[sorted.length - 1].value : 0;
  const movement = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  let debit = 0;
  let credit = 0;
  if (movement) {
    if (movement.value < 0) debit = Math.abs(movement.value);
    else credit = movement.value;
  }
  return { credit, debit, balance };
}

// Texto de la descripción: tokens entre la columna de descripción (~82) y la de
// montos (~270). Excluye la fecha (~38) y los montos.
function descriptionText(row: TextRow): string {
  return row.tokens
    .filter((t) => t.x >= DESC_MIN_X && t.x < AMOUNT_MIN_X)
    .map((t) => t.str.trim())
    .filter((s) => s.length > 0)
    .join(" ")
    .trim();
}

// ¿La fila es una línea de detalle (continuación de la descripción)? Tiene su
// primer token en la columna de descripción y no arranca con fecha.
function isContinuationRow(row: TextRow): boolean {
  const first = row.tokens[0];
  if (!first) return false;
  return first.x >= DESC_MIN_X && first.x <= DESC_MAX_X;
}

export function parseGaliciaRows(rows: TextRow[]): GaliciaTransaction[] {
  const out: GaliciaTransaction[] = [];
  let current: GaliciaTransaction | null = null;

  const push = () => {
    if (current) out.push(current);
    current = null;
  };

  for (const row of rows) {
    if (isHeaderRow(row) || isNoiseRow(row)) continue;
    if (isTotalRow(row)) {
      push();
      break; // los movimientos terminan en la fila Total
    }

    const first = row.tokens[0];
    if (!first) continue;

    const date = first.x < 70 ? parseGaliciaDate(first.str) : null;
    if (date) {
      push();
      const { credit, debit, balance } = classifyAmounts(amountTokens(row));
      current = {
        date,
        description: descriptionText(row),
        debit,
        credit,
        balance,
      };
      continue;
    }

    if (current && isContinuationRow(row)) {
      const extra = descriptionText(row);
      if (extra) current.description += ` | ${extra}`;
    }
  }
  push();
  return out;
}

export function toNormalized(
  rows: GaliciaTransaction[]
): NormalizedTransaction[] {
  const out: NormalizedTransaction[] = [];
  for (const row of rows) {
    const meta = { balance: row.balance };
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

// Suma de créditos/débitos para validar contra la fila "Total" del PDF.
export function galiciaTotals(rows: GaliciaTransaction[]): {
  credit: number;
  debit: number;
} {
  return rows.reduce(
    (acc, r) => ({
      credit: acc.credit + r.credit,
      debit: acc.debit + r.debit,
    }),
    { credit: 0, debit: 0 }
  );
}

// Lee la fila "Total" del extracto (crédito/débito declarados por el banco).
// La fila Total trae 3 montos: crédito (+), débito (-) y saldo (el más a la
// derecha), así que no usamos la lógica de movimiento de 1 monto.
export function findGaliciaTotal(
  rows: TextRow[]
): { credit: number; debit: number } | null {
  for (const row of rows) {
    if (!isTotalRow(row)) continue;
    const amounts = amountTokens(row).sort((a, b) => a.x - b.x);
    const movements = amounts.slice(0, -1); // descarta el saldo (rightmost)
    let credit = 0;
    let debit = 0;
    for (const a of movements) {
      if (a.value < 0) debit += Math.abs(a.value);
      else credit += a.value;
    }
    return { credit, debit };
  }
  return null;
}

export interface GaliciaParseResult {
  transactions: GaliciaTransaction[];
  warnings: string[];
}

export async function loadGaliciaPdf(
  data: Buffer
): Promise<GaliciaParseResult> {
  const rows = await extractRows(data);
  const transactions = parseGaliciaRows(rows);
  const warnings: string[] = [];

  const declared = findGaliciaTotal(rows);
  if (declared) {
    const sum = galiciaTotals(transactions);
    if (Math.abs(sum.credit - declared.credit) > 1) {
      warnings.push(
        `crédito parseado ${sum.credit.toFixed(2)} ≠ Total PDF ${declared.credit.toFixed(2)}`
      );
    }
    if (Math.abs(sum.debit - declared.debit) > 1) {
      warnings.push(
        `débito parseado ${sum.debit.toFixed(2)} ≠ Total PDF ${declared.debit.toFixed(2)}`
      );
    }
  }

  return { transactions, warnings };
}
