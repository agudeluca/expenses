// Extracción de texto de PDFs con pdfjs-dist (build legacy, compatible CommonJS).
// Reconstruye "filas" agrupando los items por coordenada `y` (misma línea visual)
// y ordenando por `x`, preservando la posición horizontal de cada token para que
// los parsers puedan distinguir columnas (Crédito/Débito/Saldo, PESOS/DÓLARES).

// Solo extraemos texto (no renderizamos), así que stubeamos los globals de canvas
// que pdfjs busca, para evitar los warnings "Cannot polyfill DOMMatrix/Path2D".
const _g = globalThis as any;
if (typeof _g.DOMMatrix === "undefined") _g.DOMMatrix = class {};
if (typeof _g.Path2D === "undefined") _g.Path2D = class {};

// pdfjs v3 legacy es UMD: se puede requerir directamente bajo CommonJS. Tipamos
// laxo en el require porque solo usamos getDocument + getTextContent.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs: any = require("pdfjs-dist/legacy/build/pdf.js");

export interface Token {
  x: number;
  str: string;
}

export interface TextRow {
  page: number;
  y: number;
  tokens: Token[];
}

// Items cuya `y` difieren en <= esta tolerancia son la misma línea. El interlínea
// real ronda los ~16px; los cortes espurios de pdfjs son de ~1px.
const Y_TOL = 4;

interface RawItem {
  x: number;
  y: number;
  str: string;
}

function groupPageRows(items: RawItem[], page: number): TextRow[] {
  // Agrupa por `y` redondeada exacta primero.
  const byY = new Map<number, Token[]>();
  for (const it of items) {
    const key = Math.round(it.y);
    const arr = byY.get(key);
    const tok: Token = { x: it.x, str: it.str };
    if (arr) arr.push(tok);
    else byY.set(key, [tok]);
  }

  // Une grupos de `y` cercanas (<= Y_TOL) en una sola fila.
  const ys = Array.from(byY.keys()).sort((a, b) => b - a);
  const rows: TextRow[] = [];
  let current: TextRow | null = null;
  for (const y of ys) {
    if (current && Math.abs(current.y - y) <= Y_TOL) {
      current.tokens.push(...byY.get(y)!);
    } else {
      current = { page, y, tokens: [...byY.get(y)!] };
      rows.push(current);
    }
  }

  for (const row of rows) {
    row.tokens.sort((a, b) => a.x - b.x);
  }
  return rows;
}

export async function extractRows(data: Buffer | Uint8Array): Promise<TextRow[]> {
  // pdfjs exige un Uint8Array "puro": un Buffer de Node pasa el instanceof pero
  // lo rechaza, así que copiamos a un Uint8Array nuevo.
  const bytes = new Uint8Array(data);
  const doc = await pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const out: TextRow[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: RawItem[] = [];
    for (const it of content.items as any[]) {
      const str: string = it.str;
      if (!str || !str.trim()) continue;
      items.push({ x: it.transform[4], y: it.transform[5], str });
    }
    out.push(...groupPageRows(items, p));
  }
  await doc.destroy();
  return out;
}

// Texto plano de una fila (tokens unidos por espacio), útil para anclas/regex.
export function rowText(row: TextRow): string {
  return row.tokens.map((t) => t.str).join(" ");
}
