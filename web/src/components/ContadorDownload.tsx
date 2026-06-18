import { useMemo } from "react";
import type { NormalizedTransaction } from "../types";

// Botón(es) de descarga del reporte del contador (matriz anual de consumo de
// tarjetas). Los .xlsx los genera `npm run build` en web/public/contador-<año>.xlsx;
// acá ofrecemos un link de descarga por cada año presente en los datos de tarjeta.
export function ContadorDownload({
  items,
}: {
  items: NormalizedTransaction[];
}): JSX.Element | null {
  const years = useMemo(() => {
    const s = new Set<string>();
    for (const t of items) {
      if (t.source === "galicia-credito" || t.source === "deel") {
        const y = t.date.slice(0, 4);
        if (y) s.add(y);
      }
    }
    return Array.from(s).sort().reverse();
  }, [items]);

  if (years.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        paddingBottom: 6,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        🧾 Reporte contador
      </span>
      {years.map((y) => (
        <a
          key={y}
          href={`/contador-${y}.xlsx`}
          download={`contador-${y}.xlsx`}
          title={`Descargar Excel del contador ${y}`}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--bg-elev)",
            color: "var(--text)",
            textDecoration: "none",
          }}
        >
          ⬇ Excel {y}
        </a>
      ))}
    </div>
  );
}
