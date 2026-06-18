import { NormalizedTransaction } from "../shared";
import { extractRows, TextRow, rowText } from "../pdf/extract";
import { parseSpanishAmount } from "../csv";

export interface CreditoTransaction {
  date: string;
  card: string; // "Visa 0234"
  description: string;
  amountARS: number;
  amountUSD: number;
  cuota?: string;
  period: string; // "YYYY-MM" — mes de cierre del resumen
}

export interface StatementSummary {
  period: string;
  totalARS: number; // TOTAL A PAGAR pesos
  totalUSD: number; // TOTAL A PAGAR dólares
}

export interface CreditoParseResult {
  transactions: CreditoTransaction[];
  statement: StatementSummary;
  warnings: string[];
}

// Columnas del DETALLE DEL CONSUMO:
// FECHA(~23)  flag(~74)  REFERENCIA(~86)  CUOTA(~320)  COMPROBANTE(~365)  PESOS(~460)  DÓLARES(~553)
const DESC_MIN_X = 80;
const DESC_MAX_X = 355;
const CUOTA_MIN_X = 300;
const CUOTA_MAX_X = 355;
const AMOUNT_MIN_X = 420; // por debajo: importe en moneda original / comprobante
const USD_MIN_X = 510; // >= USD; entre AMOUNT_MIN_X y esto: ARS

function parseCreditoDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  return `20${yy}-${mm}-${dd}`;
}

// "RESUMEN_VISA26_2_2026pdf.pdf" → "2026-02" (día_mes_año de cierre).
export function deriveCreditoPeriod(filename: string): string | null {
  const m = filename.match(/VISA(\d{1,2})_(\d{1,2})_(\d{4})/i);
  if (!m) return null;
  const [, , mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}`;
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

function splitAmounts(row: TextRow): { ars: number; usd: number } {
  let ars = 0;
  let usd = 0;
  for (const a of amountTokens(row)) {
    if (a.x >= USD_MIN_X) usd += a.value;
    else ars += a.value;
  }
  return { ars, usd };
}

function descriptionAndCuota(row: TextRow): {
  description: string;
  cuota?: string;
} {
  const descToks: string[] = [];
  const cuotaToks: string[] = [];
  for (const tok of row.tokens) {
    if (tok.x >= CUOTA_MIN_X && tok.x <= CUOTA_MAX_X) {
      cuotaToks.push(tok.str.trim());
    } else if (tok.x >= DESC_MIN_X && tok.x < DESC_MAX_X) {
      descToks.push(tok.str.trim());
    }
  }
  let description = descToks.join(" ").trim();
  // Quita el sufijo "<MON> <importe>" de compras en el exterior (queda el comercio).
  description = description.replace(/\s+[A-Z]{3}\s+[\d.,]+$/, "").trim();
  const cuota = cuotaToks.join(" ").trim();
  return cuota ? { description, cuota } : { description };
}

const TARJETA_TOTAL_RE = /TARJETA\s+(\d{3,4})\s+Total\s+Consumos/i;

export function parseCreditoRows(
  rows: TextRow[],
  period: string
): CreditoParseResult {
  const transactions: CreditoTransaction[] = [];
  const warnings: string[] = [];
  let buffer: CreditoTransaction[] = []; // consumos sin tarjeta asignada todavía
  let inDetalle = false;
  let totalARS = 0;
  let totalUSD = 0;

  for (const row of rows) {
    const text = rowText(row);

    if (/DETALLE DEL CONSUMO/i.test(text)) {
      inDetalle = true;
      continue;
    }

    // Subtotal por tarjeta: cierra el grupo de consumos previos.
    const mTar = text.match(TARJETA_TOTAL_RE);
    if (mTar) {
      const card = `Visa ${mTar[1]}`;
      const sum = buffer.reduce(
        (acc, t) => ({
          ars: acc.ars + t.amountARS,
          usd: acc.usd + t.amountUSD,
        }),
        { ars: 0, usd: 0 }
      );
      const declared = splitAmounts(row);
      if (Math.abs(sum.ars - declared.ars) > 0.5) {
        warnings.push(
          `${card}: consumos ARS ${sum.ars.toFixed(2)} ≠ subtotal PDF ${declared.ars.toFixed(2)}`
        );
      }
      if (Math.abs(sum.usd - declared.usd) > 0.5) {
        warnings.push(
          `${card}: consumos USD ${sum.usd.toFixed(2)} ≠ subtotal PDF ${declared.usd.toFixed(2)}`
        );
      }
      for (const tx of buffer) tx.card = card;
      transactions.push(...buffer);
      buffer = [];
      continue;
    }

    if (/TOTAL A PAGAR/i.test(text)) {
      const { ars, usd } = splitAmounts(row);
      totalARS = ars;
      totalUSD = usd;
      break; // fin de los consumos
    }

    if (!inDetalle) continue;

    const first = row.tokens[0];
    if (!first || first.x >= 60) continue;
    const date = parseCreditoDate(first.str);
    if (!date) continue;

    const { ars, usd } = splitAmounts(row);
    if (ars === 0 && usd === 0) continue;
    const { description, cuota } = descriptionAndCuota(row);

    buffer.push({
      date,
      card: "", // se asigna al toparse con el subtotal de la tarjeta
      description,
      amountARS: ars,
      amountUSD: usd,
      cuota,
      period,
    });
  }

  // El buffer remanente (percepciones/impuestos posteriores al último subtotal,
  // sin línea "Total Consumos") no son consumos → se descarta.

  return {
    transactions,
    statement: { period, totalARS, totalUSD },
    warnings,
  };
}

export function toNormalized(
  rows: CreditoTransaction[]
): NormalizedTransaction[] {
  const out: NormalizedTransaction[] = [];
  for (const row of rows) {
    const meta: Record<string, unknown> = { card: row.card, period: row.period };
    if (row.cuota) meta.cuota = row.cuota;
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

// Suma de consumos por moneda, para validar contra los subtotales del PDF.
export function creditoTotals(rows: CreditoTransaction[]): {
  ars: number;
  usd: number;
} {
  return rows.reduce(
    (acc, r) => ({ ars: acc.ars + r.amountARS, usd: acc.usd + r.amountUSD }),
    { ars: 0, usd: 0 }
  );
}

// Subtotales declarados por el PDF en cada línea "TARJETA xxxx Total Consumos".
export function findCreditoCardTotals(
  rows: TextRow[]
): { card: string; ars: number; usd: number }[] {
  const out: { card: string; ars: number; usd: number }[] = [];
  for (const row of rows) {
    const m = rowText(row).match(TARJETA_TOTAL_RE);
    if (!m) continue;
    const { ars, usd } = splitAmounts(row);
    out.push({ card: `Visa ${m[1]}`, ars, usd });
  }
  return out;
}

export async function loadCreditoPdf(
  data: Buffer,
  filename: string
): Promise<CreditoParseResult> {
  const rows = await extractRows(data);
  const period =
    deriveCreditoPeriod(filename) ?? fallbackPeriod(rows) ?? "0000-00";
  return parseCreditoRows(rows, period);
}

// Fallback: mes máximo entre las fechas de consumo si el nombre de archivo no
// trae el período.
function fallbackPeriod(rows: TextRow[]): string | null {
  let max: string | null = null;
  for (const row of rows) {
    const first = row.tokens[0];
    if (!first || first.x >= 60) continue;
    const d = parseCreditoDate(first.str);
    if (d && (!max || d > max)) max = d;
  }
  return max ? max.slice(0, 7) : null;
}
