# Frontend localhost — design

**Date:** 2026-05-22
**Status:** Approved, pending implementation

## Goal

Reemplazar el `console.log` actual con una página localhost cómoda de leer que muestra las transacciones de las tres fuentes (Deel, Galicia extracto, Galicia tarjeta crédito) consumiendo el tipo común `NormalizedTransaction`. Tabla plana agrupada por semana, search global, filtros por fuente y moneda, sort por columna. Dark theme. Sin gráficos, sin drill-down, sin backend.

## Scope y reglas

- **Stack:** Vite + React + TypeScript.
- **Data flow:** Un script Node (`src/build-data.ts`) corre los tres `toNormalized()`, escribe `web/public/data.json`. El React app lo fetcha de `/data.json`. Sin servidor backend. Si cambian los CSVs, se re-corre el script.
- **Vista principal:** Tabla plana, agrupada por semana, con headers semanales que muestran rango + totales por moneda + count.
- **Interacciones:** Search global (descripción), filtros multi-select por fuente y moneda, sort por columna (fecha y monto).
- **Layout:** Dark theme, top bar con search + filtros, weekly section headers, grid de 5 columnas (fecha, fuente, descripción, monto, moneda), chips de color por fuente, refunds en verde (montos negativos).
- **Un solo `package.json`** en root para todo (Node + browser).
- **Localhost-only:** sin build de producción, sin auth, sin hosting.

## File layout

```
src/
  shared.ts                       ← (sin cambios)
  deel/  galicia/  credito/       ← (sin cambios)
  build-data.ts                   ← nuevo
web/
  index.html
  public/
    data.json                     ← generado, gitignored
  src/
    main.tsx
    App.tsx
    types.ts
    data.ts
    styles.css
    components/
      TopBar.tsx
      WeekTable.tsx
      WeekHeader.tsx
      TxRow.tsx
      SourceChip.tsx
    hooks/
      useFilters.ts
      useGroupedByWeek.ts
vite.config.ts                    ← root, root='web'
tsconfig.web.json                 ← TS config para el frontend (jsx, dom libs)
package.json                      ← scripts + deps (Node + browser)
.gitignore                        ← + web/public/data.json
docs/superpowers/specs/
  2026-05-22-frontend-localhost-design.md
```

## Componentes

### `src/build-data.ts` (Node)
Lee CSVs de `src/data-deel/`, `src/data-galicia/`, `src/data-credito/`. Llama a `parseCSV`/`parseGaliciaCSV`/`parseCreditoCSV` + el `toNormalized` correspondiente. Concatena en un único `NormalizedTransaction[]`. Ordena por fecha desc. Escribe `web/public/data.json`. Si una fuente falla, loguea el error y sigue con las otras. Si las tres fallan, exit 1.

### `web/src/data.ts`
```ts
export async function loadData(): Promise<NormalizedTransaction[]> {
  const res = await fetch("/data.json");
  if (!res.ok) throw new Error(`failed to load data.json: ${res.status}`);
  return res.json();
}
```

### `web/src/types.ts`
Re-exporta `NormalizedTransaction` y `Source` desde `../../src/shared`. TS resuelve el path en compile time; no entra código Node al bundle (shared.ts es código puro).

### `web/src/App.tsx`
Layout root. `useEffect` carga data. Estados: `loading`, `error`, `data`. Compone `<TopBar>` + `<WeekTable>`. Pasa la data filtrada (via `useFilters`) y agrupada (via `useGroupedByWeek`) a `<WeekTable>`.

### `web/src/hooks/useFilters.ts`
Estado:
- `query: string` — search libre, matchea contra `description` case-insensitive.
- `sources: Set<Source>` — vacío = todas.
- `currencies: Set<string>` — vacío = todas.
- `sortBy: 'date' | 'amount'` — default `'date'`.
- `sortDir: 'asc' | 'desc'` — default `'desc'`.

Función pure `applyFilters(items)` que devuelve la lista filtrada y ordenada.

### `web/src/hooks/useGroupedByWeek.ts`
Toma `NormalizedTransaction[]` filtradas, devuelve `Array<{ weekStart, weekEnd, transactions, totals: Record<string, number>, count: number }>`. Reutiliza `getWeekStart`/`getWeekEnd`/`formatDate` de `src/shared`. `totals` se computa por moneda sumando `amount` (refunds netean).

### `web/src/components/TopBar.tsx`
- Search input controlado (`value` y `onChange` desde el hook).
- Dos dropdowns multi-select chiquitos para `sources` y `currencies` (`<details>`/`<summary>` o lib chica `radix-ui`).
- Cuando hay filtros activos, muestra link "Reset".

**Decisión:** los dropdowns multi-select pueden hacerse con `<select multiple>` nativo o con un componente custom. Para v1, `<select multiple size="3">` nativo — feo pero cero dep. Si molesta, se cambia en una iteración chica.

### `web/src/components/WeekTable.tsx`
Recibe los grupos semanales. Renderiza header de columnas (sticky) + por cada grupo un `<WeekHeader>` + lista de `<TxRow>`. Click en header de columna toggle sort. Indicador visual del sort actual (`↑`/`↓`).

### `web/src/components/WeekHeader.tsx`
Rango de semana, count de transacciones, totales por moneda alineados a la derecha (`tabular-nums`).

### `web/src/components/TxRow.tsx`
Grid de 5 columnas (mismo template que el header): fecha, `<SourceChip>`, descripción truncada con ellipsis, monto formateado (`Intl.NumberFormat` por moneda), moneda. Si `amount < 0` el monto se pinta verde.

### `web/src/components/SourceChip.tsx`
Mapeo:
- `deel` → fondo verde oscuro `#2a3a2d`, texto `#9eddb0`, label "deel".
- `galicia-extracto` → fondo violeta oscuro `#3a2f48`, texto `#d3b3ff`, label "extracto".
- `galicia-credito` → fondo azul oscuro `#2d3a4a`, texto `#9ec5ff`, label "crédito".

### `web/src/styles.css`
Variables CSS (colores del tema dark), reset mínimo, clases utilitarias chicas. El resto inline en componentes o `style={}` (no JSS, no CSS-in-JS).

### `web/index.html`
Esqueleto estándar de Vite con `<div id="root"></div>` y `<script type="module" src="/src/main.tsx">`.

### `vite.config.ts` (root)
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "web",
  publicDir: "public",
  plugins: [react()],
  server: { port: 5173, open: true },
});
```

### `tsconfig.web.json`
TS config para `web/` con `jsx: "react-jsx"`, `lib: ["ES2022", "DOM"]`, `moduleResolution: "bundler"`. Apunta paths a `web/src/**/*` y `src/shared.ts` (para que `web/src/types.ts` resuelva el re-export).

### `package.json` (modificaciones)

Scripts adicionales:
```json
"build:data": "npx ts-node src/build-data.ts",
"web": "npm run build:data && vite"
```

Deps nuevas:
- `react`, `react-dom`
- `@types/react`, `@types/react-dom` (dev)
- `vite`, `@vitejs/plugin-react` (dev)

## Data flow

```
CSVs en src/data-*/
        │
        ▼  npm run build:data
src/build-data.ts (Node, ts-node)
   parseCSV + toNormalized de cada fuente
        │
        ▼
web/public/data.json
        │
        ▼  npm run web → vite dev
web/src/data.ts (fetch /data.json)
        │
        ▼
useFilters → useGroupedByWeek
        │
        ▼
<WeekTable> con <WeekHeader> + <TxRow>
```

## Error handling

| Layer | Condición | Comportamiento |
|---|---|---|
| `build-data.ts` | una fuente falla al parsear | log error, sigue con las otras |
| `build-data.ts` | las tres fuentes fallan | exit 1 |
| `build-data.ts` | una carpeta data-* no existe | tratar como 0 transacciones (no fatal) |
| `loadData()` | fetch falla | propaga; `App` renderiza estado de error con el mensaje |
| `App` | data vacía | renderiza "📭 sin transacciones — corré npm run build:data" |
| App general | error en render | dejarlo crashear (es localhost personal, no producción) |

Sin try/catch globales del lado del cliente más allá del fetch inicial.

## Testing

- `src/build-data.ts` — sin tests unitarios (es composición de funciones ya testeadas + I/O). Smoke test: corre y produce un JSON válido.
- `web/src/hooks/useFilters.ts` — vitest test puro de `applyFilters` (filtrado por query/source/currency + sort).
- `web/src/hooks/useGroupedByWeek.ts` — vitest test puro de la función de agrupación.
- Componentes React — sin tests (es UI personal, low ROI). Visual check.

## Non-goals (v1)

- Charts / dashboards / time series.
- Drill-down a detalle de transacción (el `meta` se carga pero no se muestra).
- Conversión de monedas.
- Edición / persistencia / categorización por merchant.
- Auth / multi-usuario.
- Build de producción (vite build, deploy).
- Mobile-first o responsive específico.
- Hot-reload de los CSVs (cambiar un CSV requiere re-correr `npm run web`).
