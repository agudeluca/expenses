import { describe, it, expect } from "vitest";
import { TextRow } from "../pdf/extract";
import {
  parseGaliciaRows,
  toNormalized,
  findGaliciaTotal,
  galiciaTotals,
  type GaliciaTransaction,
} from "./index";

// Helper: arma una fila a partir de pares [x, texto]. (`y`/`page` no importan
// para el parser puro: itera las filas en orden.)
function row(...tokens: [number, string][]): TextRow {
  return { page: 1, y: 0, tokens: tokens.map(([x, str]) => ({ x, str })) };
}

const HEADER = row(
  [38, "Fecha"],
  [82, "Descripción"],
  [224, "Origen"],
  [308, "Crédito"],
  [425, "Débito"],
  [542, "Saldo"]
);

describe("parseGaliciaRows", () => {
  it("parsea un débito (gasto) con saldo a la derecha", () => {
    const txs = parseGaliciaRows([
      HEADER,
      row(
        [38, "03/02/26"],
        [82, "TRANSFERENCIA A TERCEROS"],
        [423, "-76.000,00"],
        [539, "10.225,85"]
      ),
    ]);
    expect(txs).toEqual<GaliciaTransaction[]>([
      {
        date: "2026-02-03",
        description: "TRANSFERENCIA A TERCEROS",
        debit: 76000,
        credit: 0,
        balance: 10225.85,
      },
    ]);
  });

  it("parsea un crédito (ingreso)", () => {
    const [tx] = parseGaliciaRows([
      HEADER,
      row(
        [38, "03/02/26"],
        [82, "CREDITO TRANSFERENCIA"],
        [312, "30.000,00"],
        [538, "86.225,85"]
      ),
    ]);
    expect(tx.credit).toBe(30000);
    expect(tx.debit).toBe(0);
    expect(tx.balance).toBe(86225.85);
  });

  it("no incluye la fecha en la descripción", () => {
    const [tx] = parseGaliciaRows([
      HEADER,
      row([38, "03/02/26"], [82, "PAGO TARJETA VISA"], [421, "-116.802,91"], [536, "110.172,86"]),
    ]);
    expect(tx.description).toBe("PAGO TARJETA VISA");
  });

  it("anexa las líneas de detalle (continuación) a la descripción", () => {
    const [tx] = parseGaliciaRows([
      HEADER,
      row([38, "03/02/26"], [82, "CREDITO TRANSFERENCIA"], [312, "30.000,00"], [538, "86.225,85"]),
      row([82, "COELSA"]),
      row([82, "DE LUCA JOSE MARIA"]),
      row([82, "20076319619"]),
    ]);
    expect(tx.description).toBe(
      "CREDITO TRANSFERENCIA | COELSA | DE LUCA JOSE MARIA | 20076319619"
    );
  });

  it("corta los movimientos en la fila Total", () => {
    const txs = parseGaliciaRows([
      HEADER,
      row([38, "03/02/26"], [82, "A"], [423, "-100,00"], [538, "900,00"]),
      row([57, "Total"], [292, "$ 2.035.471,30"], [402, "-$ 1.998.255,50"], [532, "$ 93.441,65"]),
      row([38, "05/02/26"], [82, "B (no debería parsearse)"], [423, "-50,00"], [538, "850,00"]),
    ]);
    expect(txs).toHaveLength(1);
    expect(txs[0].description).toBe("A");
  });

  it("acepta año de 4 dígitos también", () => {
    const [tx] = parseGaliciaRows([
      HEADER,
      row([38, "04/05/2026"], [82, "X"], [423, "-1,00"], [538, "10,00"]),
    ]);
    expect(tx.date).toBe("2026-05-04");
  });

  it("ignora filas de header repetidas en cada página", () => {
    const txs = parseGaliciaRows([
      HEADER,
      row([38, "03/02/26"], [82, "A"], [423, "-100,00"], [538, "900,00"]),
      HEADER, // header repetido (otra página)
      row([38, "04/02/26"], [82, "B"], [312, "50,00"], [538, "950,00"]),
    ]);
    expect(txs.map((t) => t.description)).toEqual(["A", "B"]);
  });
});

describe("toNormalized", () => {
  const base: GaliciaTransaction = {
    date: "2026-02-03",
    description: "X",
    debit: 0,
    credit: 0,
    balance: 100,
  };

  it("débito → monto positivo (gasto), ARS, galicia-extracto", () => {
    const [nt] = toNormalized([{ ...base, debit: 500 }]);
    expect(nt).toMatchObject({
      amount: 500,
      currency: "ARS",
      source: "galicia-extracto",
    });
    expect(nt.meta).toEqual({ balance: 100 });
  });

  it("crédito → monto negativo (ingreso)", () => {
    const [nt] = toNormalized([{ ...base, credit: 800 }]);
    expect(nt.amount).toBe(-800);
  });

  it("no emite nada si débito y crédito son 0", () => {
    expect(toNormalized([base])).toEqual([]);
  });
});

describe("findGaliciaTotal", () => {
  it("lee crédito/débito de la fila Total (3 montos: cred, déb, saldo)", () => {
    const total = findGaliciaTotal([
      row([57, "Total"], [292, "$ 2.035.471,30"], [402, "-$ 1.998.255,50"], [532, "$ 93.441,65"]),
    ]);
    expect(total).toEqual({ credit: 2035471.3, debit: 1998255.5 });
  });

  it("devuelve null si no hay fila Total", () => {
    expect(findGaliciaTotal([HEADER])).toBeNull();
  });
});

describe("galiciaTotals", () => {
  it("suma créditos y débitos", () => {
    const sum = galiciaTotals([
      { date: "", description: "", debit: 100, credit: 0, balance: 0 },
      { date: "", description: "", debit: 0, credit: 30, balance: 0 },
    ]);
    expect(sum).toEqual({ credit: 30, debit: 100 });
  });
});
