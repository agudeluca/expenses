import type { Source } from "../types";

const STYLES: Record<Source, { bg: string; fg: string; label: string }> = {
  deel: { bg: "#2a3a2d", fg: "#9eddb0", label: "deel" },
  "galicia-extracto": { bg: "#3a2f48", fg: "#d3b3ff", label: "extracto" },
  "galicia-credito": { bg: "#2d3a4a", fg: "#9ec5ff", label: "crédito" },
};

export function SourceChip({ source }: { source: Source }): JSX.Element {
  const s = STYLES[source];
  return (
    <span className="chip" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}
