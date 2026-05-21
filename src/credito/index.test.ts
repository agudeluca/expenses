import { describe, it, expect } from "vitest";
import {
  parseCreditoCSV,
  toNormalized,
  type CreditoTransaction,
} from "./index";

const HEADER = "Fecha,Tarjeta/Tipo,Descripcion,Monto ARS,Monto USD";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseCreditoCSV", () => {
  it("parses a basic row with ARS amount", () => {
    const txs = parseCreditoCSV(csv("08/05/2026,Visa 0234,CORTE PIZZAS,4500.0,0.0"));
    expect(txs).toHaveLength(1);
    expect(txs[0]).toEqual<CreditoTransaction>({
      date: "2026-05-08",
      card: "Visa 0234",
      description: "CORTE PIZZAS",
      amountARS: 4500,
      amountUSD: 0,
    });
  });

  it("strips a leading BOM", () => {
    const txs = parseCreditoCSV(
      "﻿" + csv("08/05/2026,Visa 0234,X,100.0,0.0")
    );
    expect(txs).toHaveLength(1);
    expect(txs[0].amountARS).toBe(100);
  });

  it("parses USD-only rows", () => {
    const [tx] = parseCreditoCSV(csv("06/05/2026,Visa 0234,LOMITERIA HABBIS,0.0,10.19"));
    expect(tx.amountARS).toBe(0);
    expect(tx.amountUSD).toBe(10.19);
  });

  it("parses refund rows with negative amounts", () => {
    const [tx] = parseCreditoCSV(csv("16/05/2026,Visa 0234,aliexpress,0.0,-18.45"));
    expect(tx.amountUSD).toBe(-18.45);
  });

  it("parses payment rows with card='-' and negative ARS", () => {
    const [tx] = parseCreditoCSV(
      csv("04/05/2026,-,Pago de tu tarjeta,-1636262.52,0.0")
    );
    expect(tx.card).toBe("-");
    expect(tx.amountARS).toBe(-1636262.52);
  });

  it("parses multiple cards in the same file", () => {
    const txs = parseCreditoCSV(
      csv(
        "08/05/2026,Visa 0234,A,100.0,0.0",
        "16/05/2026,Visa 9780,B,200.0,0.0"
      )
    );
    expect(txs.map((t) => t.card)).toEqual(["Visa 0234", "Visa 9780"]);
  });

  it("converts DD/MM/YYYY to YYYY-MM-DD", () => {
    const [tx] = parseCreditoCSV(csv("01/02/2026,Visa 0234,X,1.0,0.0"));
    expect(tx.date).toBe("2026-02-01");
  });

  it("skips rows with invalid dates silently", () => {
    const txs = parseCreditoCSV(
      csv("not-a-date,Visa 0234,X,1.0,0.0", "08/05/2026,Visa 0234,Y,2.0,0.0")
    );
    expect(txs).toHaveLength(1);
    expect(txs[0].description).toBe("Y");
  });

  it("skips rows with unparseable amounts silently", () => {
    const txs = parseCreditoCSV(
      csv("08/05/2026,Visa 0234,X,abc,0.0", "08/05/2026,Visa 0234,Y,2.0,0.0")
    );
    expect(txs).toHaveLength(1);
    expect(txs[0].description).toBe("Y");
  });

  it("throws when header is missing", () => {
    expect(() => parseCreditoCSV("foo,bar\n1,2")).toThrow(
      /header no encontrado/
    );
  });

  it("returns empty array when only header is present", () => {
    expect(parseCreditoCSV(csv())).toEqual([]);
  });
});

describe("toNormalized", () => {
  const base: CreditoTransaction = {
    date: "2026-05-08",
    card: "Visa 0234",
    description: "X",
    amountARS: 0,
    amountUSD: 0,
  };

  it("skips rows with card='-' (pago de tarjeta)", () => {
    const nts = toNormalized([{ ...base, card: "-", amountARS: -1000 }]);
    expect(nts).toEqual([]);
  });

  it("emits 1 ARS NT for ARS-only rows", () => {
    const nts = toNormalized([{ ...base, amountARS: 700 }]);
    expect(nts).toHaveLength(1);
    expect(nts[0]).toMatchObject({
      amount: 700,
      currency: "ARS",
      source: "galicia-credito",
    });
    expect(nts[0].meta).toEqual({ card: "Visa 0234" });
  });

  it("emits 1 USD NT for USD-only rows", () => {
    const nts = toNormalized([{ ...base, amountUSD: 10.19 }]);
    expect(nts).toHaveLength(1);
    expect(nts[0]).toMatchObject({ amount: 10.19, currency: "USD" });
  });

  it("preserves negative sign on refunds", () => {
    const [nt] = toNormalized([{ ...base, amountUSD: -18.45 }]);
    expect(nt.amount).toBe(-18.45);
    expect(nt.currency).toBe("USD");
  });

  it("emits 2 NTs for a row with both ARS and USD non-zero", () => {
    const nts = toNormalized([
      { ...base, amountARS: 100, amountUSD: 5 },
    ]);
    expect(nts).toHaveLength(2);
    expect(nts.find((n) => n.currency === "ARS")?.amount).toBe(100);
    expect(nts.find((n) => n.currency === "USD")?.amount).toBe(5);
  });

  it("emits no NTs for a row with both amounts in 0", () => {
    expect(toNormalized([base])).toEqual([]);
  });
});
