import * as fs from "fs";
import * as path from "path";
import { NormalizedTransaction } from "./shared";
import {
  parseCSV as parseDeel,
  toNormalized as deelToNormalized,
} from "./deel/index";
import {
  loadGaliciaPdf,
  toNormalized as galiciaToNormalized,
} from "./galicia/index";
import {
  loadCreditoPdf,
  toNormalized as creditoToNormalized,
  StatementSummary,
} from "./credito/index";
import { writeContadorReports } from "./contador/report";

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "web", "public");
const DATA_JSON = path.join(PUBLIC_DIR, "data.json");
// El reporte del contador se escribe en web/public para que la dashboard lo
// pueda ofrecer como descarga (y queda como archivo .xlsx para mandar al contador).
const REPORTS_DIR = PUBLIC_DIR;

function filesIn(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(ext))
    .sort()
    .map((f) => path.join(dir, f));
}

function loadDeel(): NormalizedTransaction[] {
  const out: NormalizedTransaction[] = [];
  for (const file of filesIn(path.join(ROOT, "src", "data-deel"), ".csv")) {
    const text = fs.readFileSync(file, "utf-8");
    out.push(...deelToNormalized(parseDeel(text)));
  }
  return out;
}

async function loadGalicia(): Promise<NormalizedTransaction[]> {
  const out: NormalizedTransaction[] = [];
  for (const file of filesIn(path.join(ROOT, "src", "data-galicia"), ".pdf")) {
    const { transactions, warnings } = await loadGaliciaPdf(
      fs.readFileSync(file)
    );
    for (const w of warnings) {
      console.warn(`⚠️  ${path.basename(file)}: ${w}`);
    }
    out.push(...galiciaToNormalized(transactions));
  }
  return out;
}

async function loadCredito(): Promise<{
  txs: NormalizedTransaction[];
  statements: StatementSummary[];
}> {
  const txs: NormalizedTransaction[] = [];
  const statements: StatementSummary[] = [];
  for (const file of filesIn(path.join(ROOT, "src", "data-credito"), ".pdf")) {
    const { transactions, statement, warnings } = await loadCreditoPdf(
      fs.readFileSync(file),
      path.basename(file)
    );
    for (const w of warnings) {
      console.warn(`⚠️  ${path.basename(file)}: ${w}`);
    }
    txs.push(...creditoToNormalized(transactions));
    statements.push(statement);
  }
  return { txs, statements };
}

async function main(): Promise<void> {
  const all: NormalizedTransaction[] = [];
  let statements: StatementSummary[] = [];
  let failures = 0;

  const sources: {
    name: string;
    run: () => Promise<NormalizedTransaction[]>;
  }[] = [
    { name: "deel", run: async () => loadDeel() },
    { name: "galicia-extracto", run: loadGalicia },
    {
      name: "galicia-credito",
      run: async () => {
        const r = await loadCredito();
        statements = r.statements;
        return r.txs;
      },
    },
  ];

  for (const src of sources) {
    try {
      const items = await src.run();
      console.log(`📄 ${src.name}: ${items.length} transacciones`);
      all.push(...items);
    } catch (err) {
      failures += 1;
      console.error(
        `❌ ${src.name}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (failures === sources.length) {
    console.error("❌ todas las fuentes fallaron");
    process.exit(1);
  }

  all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  fs.mkdirSync(path.dirname(DATA_JSON), { recursive: true });
  fs.writeFileSync(DATA_JSON, JSON.stringify(all, null, 2), "utf-8");
  console.log(
    `📦 ${all.length} transacciones → ${path.relative(ROOT, DATA_JSON)}`
  );

  const reports = writeContadorReports(all, statements, REPORTS_DIR);
  for (const file of reports) {
    console.log(`🧾 reporte contador → ${path.relative(ROOT, file)}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
