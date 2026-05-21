import { describe, it, expect } from "vitest";
import { groupByWeek } from "../shared";
import {
  parseGaliciaCSV,
  tokenizeCSV,
  toNormalized,
  type GaliciaTransaction,
} from "./index";

const META = [
  "Banco Galicia - Caja Ahorro Pesos,,,,,",
  "Nro. de Cuenta: ...0083588,,,,,",
  "Fecha Actual: 20/5/2026,,,,,",
  "Hora Actual: 21:49,,,,,",
  "Intervalo de Consulta: del 01/05/2026 al 21/05/2026,,,,,",
].join("\n");

const HEADER = "Fecha,Movimiento,Débito,Crédito,Saldo Parcial,Comentarios";

function csv(...dataRows: string[]): string {
  return [META, HEADER, ...dataRows].join("\n");
}

describe("tokenizeCSV", () => {
  it("handles quoted fields with embedded newlines", () => {
    const text = `a,"b\nc",d\ne,f,g`;
    const rows = tokenizeCSV(text);
    expect(rows).toEqual([
      ["a", "b\nc", "d"],
      ["e", "f", "g"],
    ]);
  });

  it("handles escaped quotes", () => {
    const text = `"he said ""hi""",end`;
    const rows = tokenizeCSV(text);
    expect(rows).toEqual([['he said "hi"', "end"]]);
  });
});

describe("parseGaliciaCSV", () => {
  it("skips metadata rows and parses one transaction", () => {
    const input = csv(
      `20/05/2026," DEB. AUTOM. DE SERV.\n ARCA (EX AFIP)\n","-81.541,85","0,00","144553,06",`
    );
    const txs = parseGaliciaCSV(input);
    expect(txs).toHaveLength(1);
    expect(txs[0]).toEqual<GaliciaTransaction>({
      date: "2026-05-20",
      description: "DEB. AUTOM. DE SERV. | ARCA (EX AFIP)",
      debit: 81541.85,
      credit: 0,
      balance: 144553.06,
      comments: "",
    });
  });

  it("parses a credit-only transaction", () => {
    const input = csv(
      `20/05/2026," TRANSFERENCIA DE TERCEROS\n CAREAGA","0,00","221.056,24","254094,91",`
    );
    const txs = parseGaliciaCSV(input);
    expect(txs).toHaveLength(1);
    expect(txs[0].debit).toBe(0);
    expect(txs[0].credit).toBe(221056.24);
    expect(txs[0].description).toBe("TRANSFERENCIA DE TERCEROS | CAREAGA");
  });

  it("converts DD/MM/YYYY → YYYY-MM-DD", () => {
    const input = csv(
      `04/05/2026," PAGO TARJETA VISA","-1.636.262,52","0,00","589434,83",`
    );
    expect(parseGaliciaCSV(input)[0].date).toBe("2026-05-04");
  });

  it("stores debit as absolute value", () => {
    const input = csv(
      `04/05/2026," PAGO TARJETA VISA","-1.636.262,52","0,00","589434,83",`
    );
    expect(parseGaliciaCSV(input)[0].debit).toBe(1636262.52);
  });

  it("preserves balance sign", () => {
    const input = csv(`04/05/2026," X","-100,00","0,00","-50,00",`);
    expect(parseGaliciaCSV(input)[0].balance).toBe(-50);
  });

  it("skips rows with invalid date silently", () => {
    const input = csv(
      `not-a-date," X","-1,00","0,00","100,00",`,
      `20/05/2026," Y","-2,00","0,00","98,00",`
    );
    const txs = parseGaliciaCSV(input);
    expect(txs).toHaveLength(1);
    expect(txs[0].debit).toBe(2);
  });

  it("skips rows with unparseable amounts silently", () => {
    const input = csv(
      `20/05/2026," X","abc","0,00","100,00",`,
      `20/05/2026," Y","-2,00","0,00","98,00",`
    );
    const txs = parseGaliciaCSV(input);
    expect(txs).toHaveLength(1);
  });

  it("throws when header is missing", () => {
    expect(() => parseGaliciaCSV("just,some,csv\n1,2,3")).toThrow(
      /header no encontrado/
    );
  });

  it("returns empty array when only header is present", () => {
    expect(parseGaliciaCSV(csv())).toEqual([]);
  });
});

describe("toNormalized", () => {
  const base: GaliciaTransaction = {
    date: "2026-05-20",
    description: "X",
    debit: 0,
    credit: 0,
    balance: 100,
    comments: "",
  };

  it("emits a positive ARS NT for debit-only rows", () => {
    const [nt, ...rest] = toNormalized([{ ...base, debit: 500 }]);
    expect(rest).toEqual([]);
    expect(nt.amount).toBe(500);
    expect(nt.currency).toBe("ARS");
    expect(nt.source).toBe("galicia-extracto");
  });

  it("emits a negative ARS NT for credit-only rows", () => {
    const [nt] = toNormalized([{ ...base, credit: 800 }]);
    expect(nt.amount).toBe(-800);
    expect(nt.currency).toBe("ARS");
  });

  it("emits two NTs for a row with both debit and credit > 0", () => {
    const nts = toNormalized([{ ...base, debit: 100, credit: 50 }]);
    expect(nts).toHaveLength(2);
    expect(nts.map((n) => n.amount).sort((a, b) => a - b)).toEqual([-50, 100]);
  });

  it("emits no NTs for a row with both in 0", () => {
    expect(toNormalized([base])).toEqual([]);
  });

  it("includes balance and comments in meta", () => {
    const [nt] = toNormalized([
      { ...base, debit: 10, balance: 999, comments: "hola" },
    ]);
    expect(nt.meta).toEqual({ balance: 999, comments: "hola" });
  });
});

describe("groupByWeek over GaliciaTransaction", () => {
  it("sums debits per ISO week, ignoring credits in the total", () => {
    const txs: GaliciaTransaction[] = [
      {
        date: "2026-05-11",
        description: "A",
        debit: 100,
        credit: 0,
        balance: 0,
        comments: "",
      },
      {
        date: "2026-05-12",
        description: "B",
        debit: 0,
        credit: 500,
        balance: 0,
        comments: "",
      },
      {
        date: "2026-05-18",
        description: "C",
        debit: 50,
        credit: 0,
        balance: 0,
        comments: "",
      },
    ];

    const weeks = groupByWeek(
      txs,
      (t) => new Date(t.date),
      (t) => t.debit
    );

    expect(weeks).toHaveLength(2);
    expect(weeks[0].weekStart).toBe("2026-05-11");
    expect(weeks[0].total).toBe(100);
    expect(weeks[0].transactionCount).toBe(2);
    expect(weeks[1].weekStart).toBe("2026-05-18");
    expect(weeks[1].total).toBe(50);
    expect(weeks[1].transactionCount).toBe(1);
  });
});
