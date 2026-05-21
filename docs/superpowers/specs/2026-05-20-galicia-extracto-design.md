# Galicia extract integration — design

**Date:** 2026-05-20
**Status:** Approved, pending implementation

## Goal

Add support for Banco Galicia checking-account statements (Caja Ahorro Pesos) to the existing expenses repo, so the user can see weekly spending in ARS from those statements. The existing Deel card-transactions flow (USD) keeps working unchanged in user-facing behavior.

Galicia processing is **independent** from Deel: separate input folder, separate npm script, separate output. No currency conversion, no combined totals.

## Scope and rules

- **Input format:** `.xlsx` files exported from Banco Galicia ("Caja Ahorro Pesos" view). First sheet only.
- **Conversion to CSV is an explicit step.** The user invokes a converter that writes a `.csv` alongside the `.xlsx`. The summary script reads the `.csv`.
- **"Gasto" definition:** every row where `Débito > 0`. No filtering by movement type. Transfers between own accounts, third-party transfers, automatic debits, card payments — all count.
- **Currency:** ARS only. Display amounts with `es-AR` locale (`$ 81.541,85`).
- **Weekly grouping:** same Monday-to-Sunday week logic the Deel flow uses.

## File layout

```
src/
  shared.ts                            ← new: shared week-grouping utilities
  index.ts                             ← Deel, modified to import from shared.ts
  index.test.ts                        ← updated to match shared.ts renames
  galicia/
    index.ts                           ← new: parse, group, display, main()
    xlsxToCsv.ts                       ← new: xlsx → csv converter
    index.test.ts                      ← new: unit tests for parser
  data/
    card-transactions.csv              ← Deel (unchanged)
  data-galicia/
    Extracto_*.xlsx                    ← user drops these here
    Extracto_*.csv                     ← produced by xlsxToCsv
docs/
  superpowers/specs/
    2026-05-20-galicia-extracto-design.md
package.json                           ← add scripts, add `xlsx` dep
```

## Components

### `src/shared.ts` (new)

Extract from `src/index.ts` (no behavior change):

```ts
export function getWeekStart(date: Date): Date
export function getWeekEnd(weekStart: Date): Date
export function formatDate(date: Date): string

export interface WeeklyGroup<T> {
  weekStart: string;
  weekEnd: string;
  total: number;              // renamed from totalUSD — currency-agnostic
  transactionCount: number;
  transactions: T[];
}

export function groupByWeek<T>(
  items: T[],
  getDate: (t: T) => Date,
  getAmount: (t: T) => number,
): WeeklyGroup<T>[]
```

The generic `groupByWeek` takes accessor functions so it works for both Deel (`t.USDAmount`) and Galicia (`t.debit`). Returned groups are sorted by `weekStart` ascending (matching current Deel behavior). `total` is the sum of `getAmount(t)` for every item in the group; `transactionCount` is `transactions.length`. The caller is responsible for filtering the input array if it wants any items excluded — `groupByWeek` does not filter.

### `src/index.ts` (Deel — modified)

- Remove local copies of `getWeekStart`/`getWeekEnd`/`formatDate`/`groupByWeek`/`WeeklyExpense`; import from `./shared`.
- Replace `WeeklyExpense` usage with `WeeklyGroup<Transaction>`.
- Update `groupByWeek` call site: `groupByWeek(transactions, t => new Date(t.date), t => t.USDAmount)`.
- In `displayWeeklyExpenses`, rename `week.totalUSD` → `week.total`.
- No other changes to Deel behavior.

### `src/index.test.ts` (Deel tests — updated)

- Update imports: `WeeklyExpense` → `WeeklyGroup<Transaction>` (re-typed via alias if needed).
- Update 4 assertions referencing `totalUSD` → `total`.
- All existing test cases must still pass.

### `src/galicia/xlsxToCsv.ts` (new)

Wrapper over SheetJS (`xlsx` package). When invoked:

1. Read every `*.xlsx` file in `src/data-galicia/` (alphabetical).
2. For each: open workbook, take the first sheet, dump every row/column **verbatim** to a `.csv` with the same basename next to the `.xlsx`.
3. No filtering, trimming, or header rewriting — the raw dump preserves the 5 metadata rows, the header on row 6, ES-locale amounts, multi-line cells in quoted form.
4. Overwrite existing `.csv` (so re-running after updating the xlsx works).
5. Log each file converted.

Has a `main()` so it's runnable via `ts-node`.

### `src/galicia/index.ts` (new)

```ts
interface GaliciaTransaction {
  date: string;          // "YYYY-MM-DD"
  description: string;   // multi-line "Movimiento" joined with " | "
  debit: number;         // Math.abs of the negative debit column; 0 if no debit
  credit: number;        // positive; 0 if no credit
  balance: number;       // "Saldo Parcial"
  comments: string;      // "Comentarios" column (usually empty)
}
```

#### Custom CSV tokenizer

The default `split(",")` does not work because `Movimiento` cells contain embedded newlines and commas inside quotes. Hand-roll a minimal CSV reader (~25 lines) that handles:
- Fields enclosed in `"..."` may contain `,` and `\n`.
- `""` inside a quoted field is an escaped `"`.
- Row separator is `\n` outside quoted fields.

No external CSV dep — the format is closed and the parser is small.

#### `parseGaliciaCSV(text: string): GaliciaTransaction[]`

1. Tokenize into rows.
2. Skip rows until the header `Fecha,Movimiento,Débito,Crédito,Saldo Parcial,Comentarios` is found. If never found, throw a clear error.
3. For each subsequent row with 6 cells:
   - **Date:** parse `DD/MM/YYYY` → `YYYY-MM-DD`. Invalid → skip row.
   - **Description:** split by `\n`, trim each line, drop empties, join with ` | `.
   - **Amounts (debit/credit/balance):** ES-locale parser — `s.replace(/\./g, "").replace(",", ".")` then `parseFloat`. Debit comes negative in the source; store `Math.abs()` so `debit > 0` means "money out". Credit is already positive in source, stored as-is. `balance` preserves its sign as parsed (positive in normal use, negative if the account ever overdraws).
   - **Comments:** trimmed string.
4. Return the resulting array.

#### `displayGaliciaWeekly(weeks: WeeklyGroup<GaliciaTransaction>[]): void`

Mirrors `displayWeeklyExpenses` from Deel but in ARS. All Galicia transactions (including credit-only rows) are passed to `groupByWeek` so they show up in the right week; the display function does its own filtering for the "gasto" view:

- Per week: range; **total gasto** = `week.total` (sum of `debit` provided by `groupByWeek`); **gasto count** = `week.transactions.filter(t => t.debit > 0).length`; **total créditos** = sum of `t.credit` over `week.transactions`, shown as an informational line (not added to gasto).
- Top movimientos: only `week.transactions` where `t.debit > 0`, sorted by `t.debit` descending, showing the first line of `description` (the substring before the first ` | `) plus the ARS-formatted debit amount.
- Summary stats at the end: total gasto, total créditos, avg gasto per week, week count.

Format ARS amounts with `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.

#### `main()`

1. Verify `src/data-galicia/` exists (error if not).
2. Find all `*.csv` files in `src/data-galicia/`.
3. If none: log `"no hay csv, ¿corriste 'npm run galicia:convert'?"` and exit 1.
4. Parse each file, concatenate into a single `GaliciaTransaction[]`.
5. If empty: log `"el extracto está vacío"` and exit 0.
6. `groupByWeek(txs, t => new Date(t.date), t => t.debit)` → `WeeklyGroup<GaliciaTransaction>[]`.
7. Call `displayGaliciaWeekly`.

### `package.json`

Add:
- Dependency: `"xlsx": "^0.18.5"` (SheetJS).
- Scripts:
  - `"galicia:convert": "npx ts-node src/galicia/xlsxToCsv.ts"`
  - `"galicia": "npx ts-node src/galicia/index.ts"`
  - `"galicia:all": "npm run galicia:convert && npm run galicia"` (convenience)

## Data flow

```
src/data-galicia/Extracto_*.xlsx
        │
        ▼  npm run galicia:convert
xlsxToCsv.ts (SheetJS)
        │
        ▼  writes verbatim
src/data-galicia/Extracto_*.csv
        │
        ▼  npm run galicia
fs.readFileSync
        │
        ▼
tokenizeCSV(text) ───→ string[][]
        │
        ▼
parseGaliciaCSV(rows) ───→ GaliciaTransaction[]
        │
        ▼
groupByWeek(txs, dateFn, debitFn) ───→ WeeklyGroup<GaliciaTransaction>[]
        │
        ▼
displayGaliciaWeekly(weeks) ───→ console
```

## Error handling

Personal tool, not production service. Clear messages, no heroic recovery.

| Layer | Condition | Behavior |
|---|---|---|
| `xlsxToCsv` | `src/data-galicia/` missing | `console.error`, exit 1 |
| `xlsxToCsv` | No `.xlsx` files | Log "no hay xlsx para convertir", exit 0 |
| `xlsxToCsv` | First sheet missing/empty | Log file + error, skip that file, continue |
| `xlsxToCsv` | SheetJS throws | Log file + error, exit 1 |
| `parseGaliciaCSV` | Header row not found | Throw clear error |
| `parseGaliciaCSV` | Row with invalid date | Skip silently |
| `parseGaliciaCSV` | Row with unparseable amount | Skip silently |
| `parseGaliciaCSV` | Empty row | Skip |
| `galicia main()` | `src/data-galicia/` missing | `console.error`, exit 1 |
| `galicia main()` | No `.csv` files | Log "¿corriste 'npm run galicia:convert'?", exit 1 |
| `galicia main()` | 0 transactions after parsing | Log "el extracto está vacío", exit 0 |

No global try/catch wrappers. Unexpected errors surface as stack traces.

## Testing

Vitest is already configured.

### `src/galicia/index.test.ts` (new)

**`parseGaliciaCSV` unit tests:**
- Skip metadata: CSV with 5 meta rows + header + 1 transaction → returns exactly 1 transaction.
- Date parsing: `"20/05/2026"` → `"2026-05-20"`.
- ES-locale amounts: `"-81.541,85"` → `debit = 81541.85`; `"0,00"` → `0`; `"221.056,24"` → `credit = 221056.24`.
- Multi-line description: cell with `\n` → `description` joined with ` | `, lines trimmed.
- Mixed debit/credit: row with debit only (gasto), row with credit only (ingreso) — both parse correctly.
- Invalid date row → skipped, no throw.
- Empty rows → skipped, no throw.
- Missing header → throws with clear error message.

**Integration test:**
- 3 transactions across 2 distinct ISO weeks → `groupByWeek(txs, t => new Date(t.date), t => t.debit)` returns 2 groups with correct per-week debit totals. Confirms credits are not summed into `total`.

### `src/index.test.ts` (Deel tests — updated)

- Update type imports and assertion names (`totalUSD` → `total`, `WeeklyExpense` → `WeeklyGroup<Transaction>`).
- All existing test cases continue to pass.

### Not tested

- `xlsxToCsv.ts` — thin wrapper over SheetJS. Building an xlsx fixture for a unit test costs more than the test is worth; if SheetJS breaks, it surfaces immediately on first manual run.

## Non-goals

- Currency conversion (ARS ↔ USD).
- Combining Deel and Galicia into one summary.
- Categorizing or filtering Galicia movements by type.
- Reading directly from xlsx in the summary path (the `.csv` intermediate is intentional and user-visible).
- Multiple bank-statement formats beyond Galicia Caja Ahorro Pesos.
- Auto-detecting the input source (Deel vs Galicia) — each has its own folder and its own command.
