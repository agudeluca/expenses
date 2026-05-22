export type Tab = "transactions" | "analytics";

interface Props {
  active: Tab;
  setActive: (t: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "transactions", label: "Transacciones" },
  { id: "analytics", label: "Analytics" },
];

export function Tabs({ active, setActive }: Props): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: "8px 18px 0",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 51,
        zIndex: 9,
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--text)" : "var(--text-muted)",
              borderBottom: isActive
                ? "2px solid var(--accent-positive)"
                : "2px solid transparent",
              marginBottom: -1,
              borderRadius: 0,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
