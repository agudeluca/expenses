// Tokenizador CSV robusto: respeta campos entrecomillados (con comas, comillas
// escapadas y saltos de línea internos). Lo comparten el parser de Deel y los
// tests. Soporta delimitador configurable (',' por defecto, ';' para algunos
// exports de home banking).
export function tokenizeCSV(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    field += ch;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function stripBOM(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// "1.234.567,89" (formato es-AR) → 1234567.89. Tolera símbolo "$" y espacios
// (la fila "Total" del extracto trae "$ 2.035.471,30"). Devuelve null si no es número.
export function parseSpanishAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$\s]/g, "");
  if (cleaned === "") return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  // Evita aceptar tokens con letras (ej. "EUR") que parseFloat truncaría.
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}
