import { describe, it, expect } from "vitest";
import { TextRow } from "../pdf/extract";
import {
  parseCreditoRows,
  toNormalized,
  deriveCreditoPeriod,
  type CreditoTransaction,
} from "./index";

function row(...tokens: [number, string][]): TextRow {
  return { page: 1, y: 0, tokens: tokens.map(([x, str]) => ({ x, str })) };
}

const DETALLE = row([23, "DETALLE DEL CONSUMO"]);
const HEADER = row(
  [23, "FECHA"],
  [88, "REFERENCIA"],
  [320, "CUOTA"],
  [365, "COMPROBANTE"],
  [467, "PESOS"],
  [542, "DÓLARES"]
);
const tarjetaTotal = (num: string, ars: string, usd: string) =>
  row(
    [86, `TARJETA ${num} Total Consumos de AGUSTIN RAM DE LUCA`],
    [459, ars],
    [553, usd]
  );

describe("parseCreditoRows", () => {
  it("parsea un consumo en ARS y le asigna la tarjeta del subtotal", () => {
    const { transactions } = parseCreditoRows(
      [
        DETALLE,
        HEADER,
        row([23, "04-02-26"], [74, "*"], [86, "DLOCAL*SPOTIFY"], [366, "515756"], [461, "4.981,49"]),
        tarjetaTotal("0234", "4.981,49", "0,00"),
      ],
      "2026-02"
    );
    expect(transactions).toEqual<CreditoTransaction[]>([
      {
        date: "2026-02-04",
        card: "Visa 0234",
        description: "DLOCAL*SPOTIFY",
        amountARS: 4981.49,
        amountUSD: 0,
        period: "2026-02",
      },
    ]);
  });

  it("parsea un consumo en el exterior (F) en USD y limpia el sufijo de moneda", () => {
    const { transactions } = parseCreditoRows(
      [
        DETALLE,
        HEADER,
        row([23, "07-02-26"], [74, "F"], [86, "RESTAURANT SOLINEU"], [194, "EUR"], [226, "38,00"], [365, "654312"], [558, "45,39"]),
        tarjetaTotal("0234", "0,00", "45,39"),
      ],
      "2026-02"
    );
    expect(transactions[0]).toMatchObject({
      description: "RESTAURANT SOLINEU",
      amountARS: 0,
      amountUSD: 45.39,
    });
  });

  it("captura la cuota", () => {
    const { transactions } = parseCreditoRows(
      [
        DETALLE,
        HEADER,
        row([23, "09-05-26"], [86, "MERPAGO*CAPSULE"], [320, "01/03"], [365, "123456"], [461, "16.110,00"]),
        tarjetaTotal("0234", "16.110,00", "0,00"),
      ],
      "2026-05"
    );
    expect(transactions[0].cuota).toBe("01/03");
  });

  it("maneja dos tarjetas en el mismo resumen", () => {
    const { transactions } = parseCreditoRows(
      [
        DETALLE,
        HEADER,
        row([23, "04-02-26"], [86, "A"], [461, "100,00"]),
        tarjetaTotal("0234", "100,00", "0,00"),
        row([23, "22-02-26"], [74, "K"], [86, "MERPAGO*MELI"], [365, "807563"], [460, "8.990,00"]),
        tarjetaTotal("9780", "8.990,00", "0,00"),
      ],
      "2026-02"
    );
    expect(transactions.map((t) => [t.card, t.description])).toEqual([
      ["Visa 0234", "A"],
      ["Visa 9780", "MERPAGO*MELI"],
    ]);
  });

  it("ignora el bloque CONSOLIDADO anterior a DETALLE DEL CONSUMO", () => {
    const { transactions } = parseCreditoRows(
      [
        row([23, "04-02-26"], [86, "SU PAGO EN PESOS"], [450, "-116.802,91"]),
        DETALLE,
        HEADER,
        row([23, "04-02-26"], [86, "DLOCAL*SPOTIFY"], [461, "4.981,49"]),
        tarjetaTotal("0234", "4.981,49", "0,00"),
      ],
      "2026-02"
    );
    expect(transactions).toHaveLength(1);
    expect(transactions[0].description).toBe("DLOCAL*SPOTIFY");
  });

  it("descarta percepciones/impuestos posteriores al último subtotal (sin tarjeta)", () => {
    const { transactions } = parseCreditoRows(
      [
        DETALLE,
        HEADER,
        row([23, "04-02-26"], [86, "DLOCAL*SPOTIFY"], [461, "4.981,49"]),
        tarjetaTotal("0234", "4.981,49", "0,00"),
        row([23, "26-02-26"], [86, "IVA RG 4240 21%("], [164, "6715,20)"], [464, "1.410,19"]),
      ],
      "2026-02"
    );
    expect(transactions.map((t) => t.description)).toEqual(["DLOCAL*SPOTIFY"]);
  });

  it("captura TOTAL A PAGAR en statement y corta el parseo", () => {
    const { statement, transactions } = parseCreditoRows(
      [
        DETALLE,
        HEADER,
        row([23, "04-02-26"], [86, "A"], [461, "100,00"]),
        tarjetaTotal("0234", "100,00", "0,00"),
        row([38, "TOTAL A PAGAR"], [450, "258.761,97"], [553, "619,22"]),
        row([23, "05-02-26"], [86, "no parsear"], [461, "9,00"]),
      ],
      "2026-02"
    );
    expect(statement).toEqual({
      period: "2026-02",
      totalARS: 258761.97,
      totalUSD: 619.22,
    });
    expect(transactions).toHaveLength(1);
  });

  it("emite warning si el subtotal por tarjeta no coincide", () => {
    const { warnings } = parseCreditoRows(
      [
        DETALLE,
        HEADER,
        row([23, "04-02-26"], [86, "A"], [461, "100,00"]),
        tarjetaTotal("0234", "999,00", "0,00"),
      ],
      "2026-02"
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/Visa 0234/);
  });
});

describe("deriveCreditoPeriod", () => {
  it("extrae el período del nombre de archivo", () => {
    expect(deriveCreditoPeriod("RESUMEN_VISA26_2_2026pdf.pdf")).toBe("2026-02");
    expect(deriveCreditoPeriod("RESUMEN_VISA29_1_2026pdf.pdf")).toBe("2026-01");
  });
  it("devuelve null si no matchea", () => {
    expect(deriveCreditoPeriod("cualquier.pdf")).toBeNull();
  });
});

describe("toNormalized", () => {
  const base: CreditoTransaction = {
    date: "2026-02-04",
    card: "Visa 0234",
    description: "X",
    amountARS: 0,
    amountUSD: 0,
    period: "2026-02",
  };

  it("emite NT ARS con meta card/period", () => {
    const [nt] = toNormalized([{ ...base, amountARS: 700 }]);
    expect(nt).toMatchObject({
      amount: 700,
      currency: "ARS",
      source: "galicia-credito",
    });
    expect(nt.meta).toEqual({ card: "Visa 0234", period: "2026-02" });
  });

  it("emite NT USD y conserva el signo de devoluciones", () => {
    const [nt] = toNormalized([{ ...base, amountUSD: -18.45 }]);
    expect(nt).toMatchObject({ amount: -18.45, currency: "USD" });
  });

  it("incluye cuota en meta si existe", () => {
    const [nt] = toNormalized([{ ...base, amountARS: 1, cuota: "01/06" }]);
    expect(nt.meta).toMatchObject({ cuota: "01/06" });
  });

  it("emite 2 NTs si hay ARS y USD", () => {
    const nts = toNormalized([{ ...base, amountARS: 100, amountUSD: 5 }]);
    expect(nts).toHaveLength(2);
  });
});
