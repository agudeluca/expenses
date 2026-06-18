import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { NormalizedTransaction } from "../shared";
import { StatementSummary } from "../credito/index";
import { buildYearMatrices, buildYearSheet } from "./report";

function credito(
  date: string,
  card: string,
  amount: number,
  currency: string
): NormalizedTransaction {
  return {
    date,
    description: "x",
    amount,
    currency,
    source: "galicia-credito",
    meta: { card, period: date.slice(0, 7) },
  };
}

function deel(date: string, usd: number, refund = false): NormalizedTransaction {
  return {
    date,
    description: "d",
    amount: refund ? -1 : 1, // signo del consumo (EUR original)
    currency: "EUR",
    source: "deel",
    meta: { USDAmount: usd, type: refund ? "REFUND" : "POS_TX" },
  };
}

describe("buildYearMatrices", () => {
  const txs: NormalizedTransaction[] = [
    credito("2026-01-05", "Visa 0234", 1000, "ARS"),
    credito("2026-01-10", "Visa 0234", 5, "USD"),
    credito("2026-02-05", "Visa 9780", 2000, "ARS"),
    deel("2026-03-01", 60),
  ];

  it("agrupa por año y arma una columna por tarjeta+moneda", () => {
    const [ym] = buildYearMatrices(txs);
    expect(ym.year).toBe("2026");
    expect(ym.columns.map((c) => c.label + " " + c.currency)).toEqual([
      "Deel USD",
      "Visa Galicia 0234 ARS",
      "Visa Galicia 0234 USD",
      "Visa Galicia 9780 ARS",
    ]);
  });

  it("suma por mes la celda de cada tarjeta/moneda", () => {
    const [ym] = buildYearMatrices(txs);
    const cell = (month: number, label: string, currency: string) =>
      ym.sums.get(month)?.get(`${label}__${currency}`) ?? 0;
    expect(cell(0, "Visa Galicia 0234", "ARS")).toBe(1000); // Enero
    expect(cell(0, "Visa Galicia 0234", "USD")).toBe(5);
    expect(cell(1, "Visa Galicia 9780", "ARS")).toBe(2000); // Febrero
    expect(cell(2, "Deel", "USD")).toBe(60); // Marzo
  });

  it("Deel usa el USD facturado y resta las devoluciones", () => {
    const [ym] = buildYearMatrices([deel("2026-03-01", 60), deel("2026-03-02", 10, true)]);
    expect(ym.sums.get(2)?.get("Deel__USD")).toBe(50);
  });

  it("ignora fuentes que no son tarjeta (galicia-extracto)", () => {
    const matrices = buildYearMatrices([
      {
        date: "2026-01-01",
        description: "banco",
        amount: 999,
        currency: "ARS",
        source: "galicia-extracto",
        meta: {},
      },
    ]);
    expect(matrices).toEqual([]);
  });
});

describe("buildYearSheet", () => {
  it("arma la grilla con Total ARS/USD, Total anual y Deuda al cierre", () => {
    const [ym] = buildYearMatrices([
      credito("2026-01-05", "Visa 0234", 1000, "ARS"),
      credito("2026-02-05", "Visa 0234", 500, "ARS"),
    ]);
    const statements: StatementSummary[] = [
      { period: "2026-01", totalARS: 1000, totalUSD: 0 },
      { period: "2026-02", totalARS: 1500, totalUSD: 0 },
    ];
    const ws = buildYearSheet(ym, statements);
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });

    expect(aoa[0]).toEqual([
      "Consumo tarjeta crédito 2026",
      "Visa Galicia 0234 (ARS)",
      "Total ARS",
      "Total USD",
    ]);
    // Enero (fila 1): 1000 en la tarjeta, Total ARS 1000.
    expect(aoa[1]).toEqual(["Enero", 1000, 1000, 0]);
    // Total anual.
    const totalRow = aoa.find((r) => r[0] === "Total anual");
    expect(totalRow).toEqual(["Total anual", 1500, 1500, 0]);
    // Deuda al cierre toma el último resumen (2026-02 → 1500).
    const debtRow = aoa.find(
      (r) => typeof r[0] === "string" && r[0].startsWith("Deuda al cierre")
    );
    expect(debtRow?.[0]).toContain("2026-02");
    expect(debtRow?.[debtRow.length - 2]).toBe(1500); // Total ARS
  });
});
