# PDF inputs + reporte para el contador — Diseño

**Fecha:** 2026-06-18
**Estado:** Aprobado (diseño), pendiente implementación

## Objetivo

Adaptar el tracker de gastos para leer **directamente los PDFs** que el banco entrega,
en lugar de CSVs exportados a mano:

- `src/data-galicia/*.pdf` → **Resumen de Caja de Ahorro** (extracto bancario).
- `src/data-credito/*.pdf` → **Resumen de Tarjeta de Crédito VISA**.
- `src/data-deel/*.csv` → **Deel** (sigue siendo CSV, sin cambios de formato).

Salidas:
1. `web/public/data.json` — alimenta la dashboard web (ya existente).
2. `reports/contador-<año>.xlsx` — matriz anual de consumo de tarjetas para el contador.

Además: **simplificar los scripts** de `package.json` y limpiar código muerto.

## Decisiones de producto (confirmadas con el usuario)

| Tema | Decisión |
|------|----------|
| Extracción de texto del PDF | `pdfjs-dist` (JS puro, portable, sin dependencias del SO) |
| Formato reporte contador | Excel `.xlsx` (matriz tipo planilla, según imagen de referencia) |
| Contenido reporte contador | **Solo tarjetas** (la matriz). El banco vive en la dashboard, no en el reporte |
| Columnas de la matriz | **Dinámicas**: una por tarjeta detectada (Visa Galicia 0234, 9780, Deel) |
| Monedas | ARS y USD **por separado** (no se mezclan ni se convierten) |
| CSVs viejos de galicia/credito | **Se eliminan** (PDF-only). Deel sigue CSV |
| Atribución de mes en la matriz | **Mes calendario de la fecha del consumo** (uniforme). Alternativa documentada: mes de cierre del resumen |
| Deuda al 31/12 | **Best-effort** desde el último resumen; si no se extrae con confianza, queda en blanco para completar a mano |

## Convención de signo (la que ya usa la dashboard)

`amount > 0` = **gasto/egreso** · `amount < 0` = **ingreso/devolución** (se pinta verde).
`hideIncome` filtra `amount <= 0`. Los parsers nuevos deben respetarla.

## Arquitectura

```
src/
  shared.ts            NormalizedTransaction + helpers de semana   (sin cambios)
  csv.ts               tokenizeCSV (movido desde galicia/, compartido por deel)
  pdf/extract.ts       pdfjs-dist: Buffer → líneas de texto reconstruidas por columnas (async)
  deel/index.ts        parser CSV de Deel (usa tokenizeCSV; sin CLI/display)
  galicia/index.ts     parser PDF Caja de Ahorro (reemplaza CSV)
  credito/index.ts     parser PDF Tarjeta VISA (reemplaza CSV)
  contador/report.ts   NormalizedTransaction[] → matriz .xlsx
  build-data.ts        orquesta: parsea todo → data.json + reports/contador-<año>.xlsx (async)
```

**Se elimina:** `src/galicia/xlsxToCsv.ts` y todo el parseo CSV viejo de galicia/credito.

**Principio de aislamiento:** cada parser se parte en dos:
- **(a)** extracción PDF→líneas (I/O, depende de `pdf/extract.ts`).
- **(b)** líneas→transacciones (función **pura**, testeable sin tocar un PDF).

Los tests apuntan a (b), pasándole arrays de líneas de ejemplo.

### `pdf/extract.ts`

`extractLines(data: Buffer): Promise<string[][]>` → por página, una lista de líneas;
cada línea es texto reconstruido agrupando los items de pdfjs por coordenada `y`
(misma fila) y ordenando por `x`. Se usa el build **legacy** de `pdfjs-dist` vía
`import()` dinámico para convivir con CommonJS (TS 4.9, `module: commonjs`).
Se desactiva el worker (`disableWorker`/`standardFontDataUrl` no requeridos para texto).

### `galicia/index.ts` (Caja de Ahorro)

- `parseGaliciaLines(lines: string[]): GaliciaTransaction[]` (puro).
- Cada movimiento arranca con una línea cuya 1ª celda matchea `DD/MM/YY`.
  Las líneas siguientes sin fecha son detalle → se concatenan a la descripción con `" | "`.
- Columnas Crédito / Débito / Saldo: se identifican por posición/heurística de monto
  (los débitos vienen con signo `-`). Débito → `amount` **positivo**; Crédito → `amount` **negativo**.
- `currency: "ARS"`, `source: "galicia-extracto"`.
- **Validación:** sumar créditos/débitos y comparar contra la fila `Total` del PDF; warn si difiere > $1.

### `credito/index.ts` (Tarjeta VISA)

- `parseCreditoLines(lines: string[], period: string): CreditoTransaction[]` (puro).
- Sección `DETALLE DEL CONSUMO`: `FECHA(DD-MM-YY)  REFERENCIA  [CUOTA]  COMPROBANTE  PESOS  DÓLARES`.
- Tarjeta vigente: se trackea con las líneas `TARJETA xxxx Total Consumos de ...`
  (cambian el "card actual"); cada consumo hereda esa tarjeta → `meta.card = "Visa xxxx"`.
- Consumos en el exterior (prefijo `F`) traen moneda original (EUR/USD) + importe;
  el monto que importa es la columna DÓLARES/PESOS de la derecha.
- Se **excluyen** pagos, saldo anterior, devoluciones de impuestos del bloque CONSOLIDADO
  (no son consumos). Las devoluciones de compra (montos negativos en el detalle) se conservan con su signo.
- `meta`: `{ card, cuota?, period }`. `period = "YYYY-MM"` derivado del nombre de archivo
  (`RESUMEN_VISA<DD>_<M>_<YYYY>` → cierre), con fallback al mes máximo de las fechas.
- **Validación:** sumar consumos por tarjeta/moneda y comparar contra `Total Consumos`; warn si difiere.

### `contador/report.ts`

`buildContadorWorkbook(txs: NormalizedTransaction[]): XLSX.WorkBook`.

- Considera solo fuentes de tarjeta: `galicia-credito` y `deel`.
- Identidad de columna:
  - `galicia-credito` → `Visa Galicia <últimos4>` (de `meta.card`).
  - `deel` → `Deel` (monto en **USD**, usando `meta.USDAmount`; Deel se factura en USD).
- Una hoja por año. Filas: Enero…Diciembre, **Total anual**, **Deuda al 31/12**.
- Por cada tarjeta, columnas separadas ARS y USD; solo se emite la moneda que esa tarjeta usó.
- Columnas de cierre: **Total ARS** y **Total USD** por mes.
- Celdas = suma de **consumos** (montos `> 0`) de esa tarjeta/moneda en ese mes.
  Las devoluciones (`< 0`) restan.
- **Deuda al 31/12:** total a pagar del último resumen del año por tarjeta/moneda
  (best-effort; si el parser no lo extrae con confianza, fila en blanco).

### `build-data.ts`

`async main()`:
1. Carga y parsea cada fuente (deel CSV, galicia PDFs, credito PDFs) → `NormalizedTransaction[]`.
   Tolerante a fallas por fuente (si una explota, se reporta y sigue).
2. Ordena por fecha desc y escribe `web/public/data.json`.
3. Genera `reports/contador-<año>.xlsx` por cada año presente en datos de tarjeta.

### Scripts (`package.json`): 10 → 5

```jsonc
"build": "ts-node src/build-data.ts",   // parsea todo → data.json + reporte contador
"web":   "npm run build && vite",
"test":  "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```
Se eliminan: `deel`, `galicia:convert`, `galicia`, `galicia:all`, `credito`, `build:data`.
Se actualiza el mensaje de error en `web/src/App.tsx` que menciona `npm run build:data`.

## Dependencias

- **Agregar:** `pdfjs-dist` (build legacy, compatible CommonJS).
- **Mantener:** `xlsx` (ahora se reusa para **escribir** el `.xlsx` del contador, no para xlsx→csv).
- Evaluar quitar dependencias no usadas (`node-binance-api` parece ajeno; no se toca salvo confirmación).

## Testing

- `pdf/extract.ts`: test de integración liviano contra un PDF real de cada tipo (verifica que
  devuelve líneas no vacías y contiene anclas conocidas como `DETALLE DEL CONSUMO` / `Movimientos`).
- `galicia/index.ts`: tests unitarios de `parseGaliciaLines` con arrays de líneas de ejemplo
  (débito, crédito, multilínea, fila Total).
- `credito/index.ts`: tests unitarios de `parseCreditoLines` (consumo ARS, consumo USD `F`,
  cambio de tarjeta, cuota, exclusión de pagos, fila Total Consumos).
- `contador/report.ts`: test de la grilla (meses × tarjetas, ARS/USD, total anual).
- `deel/index.ts`: se corrige el sample del test (estaba `;`-delimitado vs `,` real) y se rutea
  por `tokenizeCSV` para parsear correctamente el blob JSON embebido y `last4`.

## Riesgos

- **ESM/CJS de pdfjs-dist:** mitigado con build legacy + `import()` dinámico; fallback `pdfjs-dist@^3`.
- **Robustez del layout PDF:** la reconstrucción por coordenadas puede variar entre resúmenes;
  las validaciones contra totales del propio PDF actúan como red de seguridad (warn, no crash).
- **Deuda al 31/12:** extracción best-effort; documentado que puede requerir completar a mano.

## Fuera de alcance

- Conversión de monedas / tipo de cambio.
- Sección de banco en el reporte del contador.
- Cambios visuales mayores en la dashboard (sigue consumiendo `data.json` igual).
