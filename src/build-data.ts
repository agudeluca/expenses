import * as fs from "fs";
import * as path from "path";
import { NormalizedTransaction } from "./shared";
import {
  parseCSV as parseDeel,
  toNormalized as deelToNormalized,
} from "./deel/index";
import {
  parseGaliciaCSV,
  toNormalized as galiciaToNormalized,
} from "./galicia/index";
import {
  parseCreditoCSV,
  toNormalized as creditoToNormalized,
} from "./credito/index";

const ROOT = path.join(__dirname, "..");
const OUT_PATH = path.join(ROOT, "web", "public", "data.json");

type Loader = () => NormalizedTransaction[];

function loadCsvsFromDir<T>(
  dir: string,
  parse: (text: string) => T[]
): T[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort();
  const out: T[] = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), "utf-8");
    out.push(...parse(text));
  }
  return out;
}

const sources: { name: string; load: Loader }[] = [
  {
    name: "deel",
    load: () =>
      deelToNormalized(
        loadCsvsFromDir(path.join(ROOT, "src", "data-deel"), parseDeel)
      ),
  },
  {
    name: "galicia-extracto",
    load: () =>
      galiciaToNormalized(
        loadCsvsFromDir(
          path.join(ROOT, "src", "data-galicia"),
          parseGaliciaCSV
        )
      ),
  },
  {
    name: "galicia-credito",
    load: () =>
      creditoToNormalized(
        loadCsvsFromDir(
          path.join(ROOT, "src", "data-credito"),
          parseCreditoCSV
        )
      ),
  },
];

function main(): void {
  const all: NormalizedTransaction[] = [];
  let failures = 0;

  for (const src of sources) {
    try {
      const items = src.load();
      console.log(`📄 ${src.name}: ${items.length} transactions`);
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

  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(all, null, 2), "utf-8");
  console.log(`📦 wrote ${all.length} transactions → ${path.relative(ROOT, OUT_PATH)}`);
}

if (require.main === module) {
  main();
}
