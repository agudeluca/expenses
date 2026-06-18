// Reconcilia lo que parseamos contra los totales que el PROPIO PDF imprime:
// - Caja de Ahorro: la fila "Total" (crédito/débito declarados por el banco).
// - Tarjeta VISA: cada "TARJETA xxxx Total Consumos" (subtotal por tarjeta).
// Si todo coincide (dentro de $1), el parseo es correcto. Sale con código != 0
// si hay alguna diferencia, así sirve también para CI.
import * as fs from "fs";
import * as path from "path";
import { extractRows } from "./pdf/extract";
import {
  parseGaliciaRows,
  galiciaTotals,
  findGaliciaTotal,
} from "./galicia/index";
import {
  parseCreditoRows,
  deriveCreditoPeriod,
  findCreditoCardTotals,
} from "./credito/index";

const ROOT = path.join(__dirname, "..");
const TOL = 1; // tolerancia en la moneda (redondeos)

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2 });
const ok = (a: number, b: number) => (Math.abs(a - b) <= TOL ? "✅" : "❌");

function filesIn(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort()
    .map((f) => path.join(dir, f));
}

async function main(): Promise<void> {
  let mismatches = 0;

  console.log("\n🏦 CAJA DE AHORRO (parseado vs fila «Total» del PDF)\n");
  for (const file of filesIn(path.join(ROOT, "src", "data-galicia"))) {
    const rows = await extractRows(fs.readFileSync(file));
    const parsed = galiciaTotals(parseGaliciaRows(rows));
    const pdf = findGaliciaTotal(rows);
    console.log(`📄 ${path.basename(file)}`);
    if (!pdf) {
      console.log("   ⚠️  no se encontró la fila Total en el PDF");
      continue;
    }
    const cOk = ok(parsed.credit, pdf.credit);
    const dOk = ok(parsed.debit, pdf.debit);
    if (cOk === "❌") mismatches++;
    if (dOk === "❌") mismatches++;
    console.log(
      `   ${cOk} crédito: parseado ${fmt(parsed.credit)}  | PDF ${fmt(pdf.credit)}`
    );
    console.log(
      `   ${dOk} débito : parseado ${fmt(parsed.debit)}  | PDF ${fmt(pdf.debit)}`
    );
  }

  console.log("\n💳 TARJETA VISA (parseado vs «TARJETA xxxx Total Consumos»)\n");
  for (const file of filesIn(path.join(ROOT, "src", "data-credito"))) {
    const name = path.basename(file);
    const rows = await extractRows(fs.readFileSync(file));
    const period = deriveCreditoPeriod(name) ?? "?";
    const { transactions, statement } = parseCreditoRows(rows, period);
    const declared = findCreditoCardTotals(rows);
    console.log(`📄 ${name}  (período ${statement.period})`);
    for (const d of declared) {
      const parsed = transactions
        .filter((t) => t.card === d.card)
        .reduce(
          (acc, t) => ({ ars: acc.ars + t.amountARS, usd: acc.usd + t.amountUSD }),
          { ars: 0, usd: 0 }
        );
      const aOk = ok(parsed.ars, d.ars);
      const uOk = ok(parsed.usd, d.usd);
      if (aOk === "❌") mismatches++;
      if (uOk === "❌") mismatches++;
      console.log(
        `   ${aOk} ${d.card} ARS: parseado ${fmt(parsed.ars)} | PDF ${fmt(d.ars)}` +
          `   ${uOk} USD: parseado ${fmt(parsed.usd)} | PDF ${fmt(d.usd)}`
      );
    }
    console.log(
      `   🧾 TOTAL A PAGAR del resumen: ARS ${fmt(statement.totalARS)} / USD ${fmt(statement.totalUSD)}`
    );
  }

  console.log("");
  if (mismatches === 0) {
    console.log("✅ Todo reconcilia con los totales impresos en los PDFs.\n");
  } else {
    console.log(`❌ ${mismatches} diferencia(s) detectada(s).\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
