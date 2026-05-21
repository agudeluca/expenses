import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const DATA_DIR = path.join(__dirname, "..", "data-galicia");

export function convertXlsxToCsv(xlsxPath: string): string {
  const workbook = XLSX.readFile(xlsxPath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error(`workbook has no sheets: ${xlsxPath}`);
  }
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}

export function main(): void {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ directorio no encontrado: ${DATA_DIR}`);
    process.exit(1);
  }

  const xlsxFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith(".xlsx"))
    .sort();

  if (xlsxFiles.length === 0) {
    console.log("📭 no hay xlsx para convertir en src/data-galicia/");
    return;
  }

  let failures = 0;
  xlsxFiles.forEach((file) => {
    const xlsxPath = path.join(DATA_DIR, file);
    const csvPath = path.join(DATA_DIR, file.replace(/\.xlsx$/i, ".csv"));
    try {
      const csv = convertXlsxToCsv(xlsxPath);
      fs.writeFileSync(csvPath, csv, "utf-8");
      console.log(`✅ ${file} → ${path.basename(csvPath)}`);
    } catch (err) {
      failures += 1;
      console.error(`❌ ${file}:`, err instanceof Error ? err.message : err);
    }
  });

  if (failures > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
