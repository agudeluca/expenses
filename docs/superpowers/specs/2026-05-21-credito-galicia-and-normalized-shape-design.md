# Galicia tarjeta de crédito + forma normalizada — design

**Date:** 2026-05-21
**Status:** Approved, pending implementation

## Goal

Sumar soporte para el resumen de tarjeta de crédito de Banco Galicia (`src/data-credito/movimientos_tarjeta_galicia.csv`) y, en el mismo cambio:

1. Introducir una forma **normalizada** común (`NormalizedTransaction`) que las tres fuentes (Deel, Galicia extracto, Galicia tarjeta) emitan, para preparar la combinación posterior por parte de un consumidor (por ejemplo el frontend que vendrá en un brainstorming siguiente).
2. Alinear la estructura del módulo Deel para que las tres fuentes sigan el mismo patrón de carpetas y comandos: `src/<fuente>/` + `src/data-<fuente>/` + `npm run <fuente>`. Esto también arregla un path roto: `src/index.ts` apunta a `src/data/card-transactions.csv`, que ya no existe (el archivo fue movido a `src/data-deel/`).

## Scope y reglas

### Tarjeta crédito (parser nuevo)

- **Input:** `src/data-credito/*.csv`. Header: `Fecha,Tarjeta/Tipo,Descripcion,Monto ARS,Monto USD`. Formato: BOM al inicio, fechas `DD/MM/YYYY`, decimales con punto (no es-AR), dos tarjetas en el mismo archivo (`Visa 0234`, `Visa 9780`), y filas con `Tarjeta/Tipo = "-"` que representan pagos de tarjeta.
- **Doble moneda:** una fila puede tener monto en ARS, en USD, o (raramente) en ambos. El resumen semanal muestra **dos totales separados** (ARS y USD), sin conversión.
- **Filtrado para "gasto":** las filas con `Tarjeta/Tipo === "-"` (pagos de tarjeta) **no son gastos** y se excluyen al normalizar. Los refunds (montos negativos en filas de compra normal, ej. `aliexpress,0.0,-18.45`) **se incluyen tal cual** — quedan con `amount < 0` y netean el total semanal.
- **Tarjetas agregadas:** Visa 0234 y Visa 9780 suman al mismo total semanal por moneda. Cada transacción individual conserva su tarjeta en `meta`.

### Forma normalizada (cross-source)

- Cada módulo de fuente sigue exponiendo su parser tipado nativo (`parseCSV`, `parseGaliciaCSV`, `parseCreditoCSV`).
- Adicionalmente expone una función `toNormalized(rows): NormalizedTransaction[]` que aplica el filtrado/mapeo de su fuente.
- Un consumidor combinado puede hacer `[...deel.toNormalized(d), ...galicia.toNormalized(g), ...credito.toNormalized(c)]` y agrupar por `currency` + semana.

### Alineación estructural de Deel

- Mover `src/index.ts` → `src/deel/index.ts`.
- Mover `src/index.test.ts` → `src/deel/index.test.ts`.
- Ajustar el path interno a `src/data-deel/card-transactions.csv`.
- Renombrar el script npm `start` → `deel`.

## File layout

```
src/
  shared.ts                            ← + NormalizedTransaction, Source
  deel/
    index.ts                           ← movido desde src/index.ts
    index.test.ts                      ← movido desde src/index.test.ts
  galicia/
    index.ts                           ← + toNormalized()
    index.test.ts                      ← + tests de toNormalized
    xlsxToCsv.ts                       ← sin cambios
  credito/                             ← nuevo
    index.ts                           ← parser + toNormalized + display + main
    index.test.ts                      ← tests
  data-deel/
    card-transactions.csv              ← ya existe (untracked en git)
  data-galicia/
    Extracto_*.xlsx
    Extracto_*.csv
  data-credito/
    movimientos_tarjeta_galicia.csv    ← ya existe (untracked en git)
docs/superpowers/specs/
  2026-05-21-credito-galicia-and-normalized-shape-design.md
package.json                           ← scripts deel/galicia/credito; sin deps nuevas
```

## Componentes

### `src/shared.ts` (modificado)

Sumar:

```ts
export type Source = "deel" | "galicia-extracto" | "galicia-credito";

export interface NormalizedTransaction {
  date: string;          // "YYYY-MM-DD"
  description: string;
  amount: number;        // > 0 = gasto, < 0 = refund/ingreso
  currency: string;      // "ARS" | "USD" | "EUR" | ...
  source: Source;
  meta?: Record<string, unknown>;
}
```

Lo existente (`WeeklyGroup<T>`, `getWeekStart`, `getWeekEnd`, `formatDate`, `groupByWeek`) queda sin cambios.

### `src/deel/index.ts` (movido + extendido)

- Mismo contenido que `src/index.ts` actual, con dos cambios:
  - El path: `path.join(__dirname, "..", "data-deel", "card-transactions.csv")`.
  - Nueva función exportada:

    ```ts
    export function toNormalized(rows: Transaction[]): NormalizedTransaction[]
    ```

    Mapeo por fila:
    - `date`: tomar `YYYY-MM-DD` de `t.date` (es ISO string).
    - `description`: `t.merchantName`.
    - `amount`: `t.originalAmount`, negado si `t.type === "REFUND"`.
    - `currency`: `t.originalCurrency`.
    - `source`: `"deel"`.
    - `meta`: `{ mcc: t.mcc, merchantCountry: t.merchantCountry, status: t.status, last4: t.last4, type: t.type, USDAmount: t.USDAmount }`.

- El re-export del shim en `src/index.ts` se borra. El módulo entry-point de Deel ahora es `src/deel/index.ts`.

### `src/deel/index.test.ts` (movido + extendido)

- Mismo contenido que `src/index.test.ts` actual, importando desde `./index`.
- En el "Integration Tests" block, actualizar `csvPath` a `path.join(__dirname, "..", "data-deel", "card-transactions.csv")` (hoy apunta a `__dirname/data/transactions.csv`, path que nunca existió correctamente; el test sólo corría si el archivo existía, así que esto es una corrección latente).
- Sumar un `describe("toNormalized")` con:
  - Una transacción `POS_TX` → 1 NT con `amount > 0`, `currency = originalCurrency`, `source = "deel"`, `meta` correcto.
  - Una transacción `REFUND` → 1 NT con `amount < 0` (signo invertido).
  - `description` viene de `merchantName`.
  - `date` queda como `YYYY-MM-DD` (sin time).

### `src/galicia/index.ts` (extendido)

Sumar:

```ts
export function toNormalized(rows: GaliciaTransaction[]): NormalizedTransaction[]
```

Mapeo por fila:
- Si `debit > 0`: emitir 1 NT con `amount: debit`, `currency: "ARS"`, `source: "galicia-extracto"`, `description: row.description`, `meta: { balance: row.balance, comments: row.comments }`.
- Si `credit > 0`: emitir 1 NT con `amount: -credit`, `currency: "ARS"`, resto idéntico.
- Una fila con `debit > 0` y `credit > 0` (caso raro) emite 2 NTs.
- Una fila con ambos en 0 no emite ningún NT.

Resto del módulo (`parseGaliciaCSV`, `tokenizeCSV`, `displayGaliciaWeekly`, `main`) sin cambios.

### `src/galicia/index.test.ts` (extendido)

Sumar un `describe("toNormalized")` con:
- Debit-only → 1 NT positivo en ARS.
- Credit-only → 1 NT negativo en ARS.
- Ambos > 0 → 2 NTs (uno positivo, uno negativo).
- Ambos en 0 → 0 NTs.
- `meta` incluye `balance` y `comments`.

### `src/credito/index.ts` (nuevo)

```ts
export interface CreditoTransaction {
  date: string;          // "YYYY-MM-DD"
  card: string;          // "Visa 0234" | "Visa 9780" | "-"
  description: string;
  amountARS: number;     // tal cual viene en el CSV; puede ser negativo (refund o pago)
  amountUSD: number;
}

export function parseCreditoCSV(text: string): CreditoTransaction[]
export function toNormalized(rows: CreditoTransaction[]): NormalizedTransaction[]
export function displayCreditoWeekly(/* ver abajo */): void
export function main(): void
```

**`parseCreditoCSV`:**
1. Strippear BOM inicial (`﻿`) si está.
2. Tokenizar con `tokenizeCSV` (mismo helper minimalista que galicia, copiado o importado — ver "decisión menor" abajo). El formato no tiene quoted multilinea, pero el tokenizer compartido no rompe nada y mantiene consistencia.
3. Buscar la fila header exacta `Fecha,Tarjeta/Tipo,Descripcion,Monto ARS,Monto USD`. Si no aparece, throw con mensaje claro (`"header no encontrado, ¿es un resumen de tarjeta crédito Galicia?"`).
4. Para cada fila siguiente con 5 columnas:
   - `date`: parsear `DD/MM/YYYY` → `YYYY-MM-DD`. Inválido → skip silencioso.
   - `card`: `row[1].trim()`.
   - `description`: `row[2].trim()`.
   - `amountARS`, `amountUSD`: `parseFloat` directo. Si alguno es `NaN` → skip silencioso.

**Decisión menor:** `tokenizeCSV`, `parseSpanishDate`, `parseSpanishAmount` viven hoy en `src/galicia/index.ts`. Para evitar un refactor mayor en este PR (mover esos helpers a `shared.ts` y actualizar imports y tests de galicia), `credito/index.ts` **importa `tokenizeCSV` desde `../galicia/index`** y duplica las funciones chicas que necesite (`parseSpanishDate` ~3 líneas). Si en un PR futuro aparece una cuarta fuente, ahí se justifica mover los helpers a `shared.ts`.

**`toNormalized`:** para cada fila:
- Si `row.card === "-"`: skip (es un pago de tarjeta, no un gasto).
- Si `row.amountARS !== 0`: emitir NT `{ amount: row.amountARS, currency: "ARS", source: "galicia-credito", description: row.description, meta: { card: row.card } }`.
- Si `row.amountUSD !== 0`: emitir NT análogo en USD.
- Si ambos en 0 (luego de filtrar pagos): no emitir nada.

**`displayCreditoWeekly`:** recibe las NTs ya normalizadas y filtradas, y hace **dos pasadas**:
1. Pasada ARS: filtrar `nt.currency === "ARS"`, `groupByWeek(nts, t => new Date(t.date), t => t.amount)`, imprimir con `Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })`. Encabezado: `📊 Weekly Summary (ARS) — Tarjeta Crédito Galicia`.
2. Pasada USD: idéntico pero `currency: "USD"`, formato USD, encabezado `(USD)`.

Cada pasada muestra: rango de la semana, total, count, lista de transacciones ordenadas por monto descendente, mostrando `tarjeta — descripción — monto`. Al final de cada pasada, summary stats (total, count, avg/semana, # semanas). Si una pasada no tiene transacciones, log breve `"sin movimientos en <moneda>"` y seguir.

**`main()`:**
1. Verificar que `src/data-credito/` exista (error + exit 1 si no).
2. Listar `*.csv` en ese directorio, ordenado alfabéticamente. Si vacío: log `"no hay csv en src/data-credito/"` y exit 1.
3. Por cada archivo: `fs.readFileSync` + `parseCreditoCSV`, concatenar en un único `CreditoTransaction[]`.
4. Si el array está vacío: log `"el resumen está vacío"`, exit 0.
5. `const nts = toNormalized(all)`.
6. `displayCreditoWeekly(nts)`.

Sin try/catch global. Errores inesperados surfacean como stack trace.

### `src/credito/index.test.ts` (nuevo)

**Tests del parser:**
- Stripping de BOM: input con `﻿` al inicio parsea correctamente.
- Header presente: 1 fila válida → 1 transacción con todos los campos correctos.
- Fecha `08/05/2026` → `2026-05-08`.
- Decimal plano: `700.0` → `700`, `1636262.52` → `1636262.52`, `-18.45` → `-18.45`.
- Fila con fecha inválida → skip silencioso.
- Fila con monto no parseable → skip silencioso.
- Header faltante → throw con mensaje claro.
- Múltiples tarjetas en el mismo archivo: filas con `Visa 0234` y `Visa 9780` parsean ambas correctamente.

**Tests de `toNormalized`:**
- Fila con `card = "-"` (pago de tarjeta) → 0 NTs.
- Fila con `amountARS = 700, amountUSD = 0` → 1 NT en ARS con `amount = 700` y `meta.card = "Visa 0234"`.
- Fila con `amountARS = 0, amountUSD = 10.19` → 1 NT en USD con `amount = 10.19`.
- Fila refund: `amountUSD = -18.45` → 1 NT con `amount = -18.45` (signo se preserva).
- Fila con `amountARS > 0` y `amountUSD > 0` (caso raro) → 2 NTs.
- Fila con `amountARS = 0` y `amountUSD = 0` → 0 NTs.
- `source` siempre es `"galicia-credito"`.

**No se testea:**
- `displayCreditoWeekly` (output a consola).
- `main` (I/O).

### `package.json`

Scripts:

```json
"deel": "npx ts-node src/deel/index.ts",
"galicia:convert": "npx ts-node src/galicia/xlsxToCsv.ts",
"galicia": "npx ts-node src/galicia/index.ts",
"galicia:all": "npm run galicia:convert && npm run galicia",
"credito": "npx ts-node src/credito/index.ts",
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

(`start` se elimina; `deel` lo reemplaza.) No hay nuevas dependencias.

## Data flow (tarjeta crédito)

```
src/data-credito/movimientos_tarjeta_galicia.csv
        │
        ▼  npm run credito
fs.readFileSync
        │
        ▼
tokenizeCSV(text) ───────→ string[][]
        │
        ▼
parseCreditoCSV(rows) ────→ CreditoTransaction[]
        │
        ▼
toNormalized(creditoTxs) ─→ NormalizedTransaction[]  (filtrando pagos)
        │
        ▼
displayCreditoWeekly(nts) → console (dos pasadas: ARS, USD)
```

El paso `toNormalized` es el punto de entrada que un consumidor combinado (frontend, reporte cross-source) usará en el futuro, junto con `deel.toNormalized(...)` y `galicia.toNormalized(...)`.

## Error handling

| Layer | Condición | Comportamiento |
|---|---|---|
| `parseCreditoCSV` | BOM al inicio | Stripear y continuar |
| `parseCreditoCSV` | Header no encontrado | Throw con mensaje claro |
| `parseCreditoCSV` | Fila con fecha inválida | Skip silencioso |
| `parseCreditoCSV` | Fila con monto no parseable | Skip silencioso |
| `toNormalized` | Fila con `card === "-"` | Skip (es pago, no gasto) |
| `toNormalized` | Fila con ambos montos en 0 | Skip (no genera NTs) |
| `credito main()` | `src/data-credito/` no existe | `console.error`, exit 1 |
| `credito main()` | No hay `.csv` | Log mensaje, exit 1 |
| `credito main()` | 0 transacciones tras parsear | Log "el resumen está vacío", exit 0 |
| `credito main()` | 0 NTs en una de las dos monedas | Log "sin movimientos en <moneda>" en esa pasada, seguir con la otra |

Sin try/catch globales. Errores inesperados surfacean como stack trace.

## Non-goals

- Conversión FX (ARS ↔ USD).
- Combinar Deel + Galicia extracto + Galicia tarjeta en un único resumen unificado en CLI (el `toNormalized` deja la data lista para que un consumidor — el frontend que viene — lo haga).
- Frontend localhost (siguiente brainstorming separado).
- Categorización por merchant.
- Conciliación cruzada (ej. ligar un "Pago de tu tarjeta" del extracto con el resumen de tarjeta).
- Mover `tokenizeCSV`/`parseSpanishDate`/`parseSpanishAmount` a `shared.ts` (refactor que se justifica recién si aparece una cuarta fuente).
- Auto-detectar la fuente del input; cada fuente tiene su comando y su carpeta.
