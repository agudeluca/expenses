import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { extractRows, rowText } from "./extract";

const CREDITO = path.join(
  __dirname,
  "..",
  "data-credito",
  "RESUMEN_VISA26_2_2026pdf.pdf"
);
const GALICIA = path.join(
  __dirname,
  "..",
  "data-galicia",
  "RESUMEN_EXTRACTOS CONSOLIDADOS - CAJA DE AHORRO 27-02-2026.pdf"
);

// Integración liviana: que pdfjs extraiga filas con tokens posicionados y que
// aparezcan las anclas esperadas. Se saltea si el PDF de muestra no está.
describe("extractRows (integración)", () => {
  it.skipIf(!fs.existsSync(CREDITO))(
    "extrae filas con ancla DETALLE DEL CONSUMO del resumen VISA",
    async () => {
      const rows = await extractRows(fs.readFileSync(CREDITO));
      expect(rows.length).toBeGreaterThan(10);
      const text = rows.map(rowText).join("\n");
      expect(text).toMatch(/DETALLE DEL CONSUMO/);
      expect(text).toMatch(/TOTAL A PAGAR/);
      // Cada token tiene una coordenada x numérica.
      expect(typeof rows[0].tokens[0].x).toBe("number");
    }
  );

  it.skipIf(!fs.existsSync(GALICIA))(
    "extrae filas con ancla Movimientos del extracto Caja de Ahorro",
    async () => {
      const rows = await extractRows(fs.readFileSync(GALICIA));
      expect(rows.length).toBeGreaterThan(10);
      const text = rows.map(rowText).join("\n");
      expect(text).toMatch(/Movimientos/);
      expect(text).toMatch(/Total/);
    }
  );
});
