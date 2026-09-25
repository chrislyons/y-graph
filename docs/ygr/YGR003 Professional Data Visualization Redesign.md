# YGR003 Professional Data Visualization Redesign

**Document ID:** YGR003
**Date:** 2026-09-25
**Status:** Delivered redesign; automated release gates passed
**Repository:** `y-graph`
**Target Plugin:** Why Graph (Obsidian)

---

## 1. Status and scope

The professional data-visualization redesign is implemented in the source modules and bundled plugin. The existing plugin identity, graph semantics, writing safeguards, AI citation verification, local-only processing, and three core command contracts are preserved. `manifest.json` is unchanged: `id: mapa-neuronal`, `minAppVersion: 1.8.7`, and `isDesktopOnly: false`.

The delivery is a single comprehensive cutover: model, view state, analytics, rendering, interaction, UI, export, theme, and test/build boundaries are present without a second runtime dependency framework.

## 2. Implemented module boundaries

- `src/i18n.js` owns the existing English/Spanish translation catalog and `T(clave, ...valores)` contract.
- `src/model/graph.js` owns pure graph construction and `REGLAS`; `src/model/store.js` owns vault reads, cached note records, invalidation, rename/delete handling, and generation-safe rebuilds.
- `src/model/analysis.js` owns metrics, diagnostics, neighborhoods, shortest paths, and empty-link candidates.
- `src/view/state.js` owns normalized view state and filters; `src/view/layouts.js` owns deterministic layered/radial layouts; `src/view/renderer.js` owns the budgeted Canvas renderer and hit testing; `src/view/table.js` owns the semantic node and edge tables.
- `src/ui/toolbar.js`, `filters.js`, `inspector.js`, and `interaction.js` own workbench controls, filtering, inspection, and pointer/keyboard/assistive interaction. `src/exports.js` owns scoped export generation and schema conversion.
- `src/main.js` is the plugin/view/settings/AI orchestration layer. `src/test-entry.js` is the test-only bundle entry and does not enter the production entry graph.

## 3. Data, store, state, and analytics

The graph remains directed-origin-aware in construction but exposes an undirected, reason-bearing graph with the existing inventory, source, reason, phrase, citation, empty-folder, and layer-safety fields. Edge identity is stable through the sorted endpoint pair; public edge data remains array-shaped for compatibility until export conversion.

The store caches records by path and mtime, invalidates metadata-changed paths even when mtime is unchanged, removes deleted records, invalidates both sides of renames, and serializes overlapping rebuilds so only the newest generation can update a live view.

Per-view state is normalized and bounded. It includes mode, camera, search, topics, layers, degree range, activity, external/long-range filters, collapsed nodes, selection, path, panel, and visual theme. Saved views retain state plus creation/update timestamps; the existing settings store remains authoritative, with a twelve-view limit and deterministic oldest-view eviction. `aplicarFiltros` returns a new visibility set, scope, and counts without mutating graph data.

Analytics preserve the established graph rules while exposing metrics, curated/literal explanation counts, health diagnostics, deterministic BFS neighborhoods, shortest routes with the input-layer avoidance preference, and the current six expected-link gap candidates.

## 4. Renderer, layout, accessibility, and table

`GraphRenderer` provides graph updates, viewport changes, dirty rendering, hit testing, export frames, and destruction. It uses stable world positions, spatial-hash bounds, visible culling, cached paths, two reusable offscreen canvases, and a low-detail straight-line interaction mode that returns to curved paths after idle. `Path2D` is feature-detected with a Canvas path-call fallback.

Layer ordering is explicit (`auto`, alphabetic natural order, or recent). Layer positions are cached independently of filtering, panel reservation, theme, and resize. Radial rings use bounded BFS depth, deterministic ordering, and a screen-budgeted label set that retains selected/path/focused/high-value nodes while omitted nodes remain searchable and table-visible.

Labels are budgeted by viewport area, use collision/visibility checks and hysteresis, use stroke halos rather than opaque label boxes, and reserve headings. Notes, sources, supernodes, and health marks remain distinguishable by shape, line style, and text in addition to color.

The Canvas is wrapped in a labelled group with a focusable, described canvas, translated fallback text, keyboard navigation/pan/zoom/fit actions, search listbox semantics, an active-descendant list, and a polite live summary. The always-available data table provides captioned node and edge tables with semantic headers, row headers, endpoint metadata, reasons, literal phrases, source lines, and selectable rows.

## 5. UI, theme, and settings

The workbench uses a primary metrics/search row and a second command row for layers/radial modes, filters, saved views, health, gaps, data table, export, and help. The inspector is a resizable desktop aside and a mobile bottom-sheet surface, with overview, node, edge, health, and gap states. Filter controls update Canvas, inspector, table, metrics, and export scope from one normalized state.

Styles are tokenized under `.mn-raiz`, default to the Obsidian-adaptive `tema` mode, retain the `noche` palette as an optional canvas style, and preserve visible focus rings and non-color semantic marks. New defaults are `ordenCapas: 'auto'`, `profundidadRadial: 2`, `temaVisual: 'tema'`, `mostrarLeyenda: true`, `mostrarAyuda: false`, `vistasGuardadas: {}`, and `ultimaVista: null`. Existing settings and the boolean-to-`fuentes` migration remain supported; the historical `vistasGuardados` typo is ignored.

## 6. Exports, schema, and scopes

`src/exports.js` exposes `datosExportables`, `crearPNG`, `crearSVG`, `crearHTML`, `crearJSON`, `crearCSV`, and `exportarVista`. The dialog scopes are `visible` (default), `focused` (selected node plus active-depth neighborhood and induced edges), and `all` (explicit whole-graph choice).

PNG export uses a bounded scale and a blob-to-data-URL fallback. SVG is generated from scene primitives with escaped title, description, metadata, legend, filter summary, date, and counts. HTML embeds SVG, tables, JSON metadata, and data-URL downloads. JSON adds `schemaVersion: 2`, `alcance`, `vista`, `filtros`, `metricas`, and `generado` while retaining existing keys. CSV retains its original six columns and appends `motivo_origen`, `frase_origen`, and `linea_origen`, with CSV escaping. Export folders are created at export time and filename conflicts receive numeric suffixes; sequential writes stop and report the preceding files if a write fails.

## 7. Cutover and compatibility

Production continues to bundle from `src/main.js` to the existing `main.js`; test mode bundles `src/test-entry.js` to `pruebas/.build/main-test.js` with the same browser target and Obsidian externals. No runtime dependency was added. The redesign targets Obsidian 1.8.7+ on desktop and mobile. Feature detection remains in place for optional `Path2D` behavior and newer/older browser capabilities; no compatibility change to the manifest is recorded.

## 8. Verification evidence

The following completed checks passed in this checkout:

- Production build: succeeded (`main.js`, 308.5 KB).
- Test build: succeeded (`pruebas/.build/main-test.js`, 311.4 KB).
- `plugin.cjs`: 107 passed.
- `fuentes.cjs`: 44 passed.
- `v128.cjs`: 72 passed.
- `almacen.cjs`: 10 passed.
- `workbench.cjs`: 20 passed.
- `exports.cjs`: 30 passed.
- `estado.cjs`: 27 passed.
- `vistas.cjs`: 18 passed.
- `analisis.cjs`: 36 passed.
- `render.cjs`: 35 passed.
- `interaccion.cjs`: 26 passed.
- `estilos.cjs`: 61 passed.
- `idioma.cjs`: 301 translated strings checked; complete English/Spanish gate passed.
- Deterministic visualization: 35 passed.
- Performance fixture: 5,000 nodes / 17,500 edges; rebuild p95 106.989 ms, first render p95 149.845 ms, pan p95 31.704 ms, zoom p95 27.863 ms, hit-test p95 3,413.078 ms per 1,000-hit batch; two offscreen canvases and zero pending frames; destroy released all canvases.
- Browser smoke: DOM/Canvas/table/accessibility contracts and pointer, edge, search, keyboard, theme, health/gaps, radial-depth 1–4, save/restore, and PNG/SVG/HTML/JSON/CSV export gates passed.
- Browser screenshots: eight PNG captures passed in `pruebas/.build/visual/` (desktop light/dark, table, health, gaps, radial, night theme, mobile surface).
- Lint: 0 errors, 7 existing warnings.

`npm test` completed successfully end to end. The performance runner intentionally reports that numeric regression thresholds are not calibrated; the measured fixture evidence above is recorded without claiming a cross-platform threshold.

## 9. Remaining manual validation

- Real Obsidian desktop/mobile vault validation, phone-emulator pinch/tap/long-press/screen-reader-equivalent checks, safe-area layout, and high-contrast/grayscale checks remain manual follow-up items.
- Hardware mouse/pointer, native Tab traversal across every control, real Obsidian file writes/download UX, and manual mobile safe-area reachability are not claimed by the CDP-free browser runner.
- Canvas `toBlob` fallback and `Path2D` fallback are compatibility paths covered by contracts, not separate device-runtime claims.

## 10. Exact files changed

This release record covers the following implementation/test/build/UI files observed in the redesign checkout:

- `src/main.js`
- `src/i18n.js`
- `src/exports.js`
- `src/test-entry.js`
- `src/model/graph.js`
- `src/model/store.js`
- `src/model/analysis.js`
- `src/view/state.js`
- `src/view/layouts.js`
- `src/view/renderer.js`
- `src/view/table.js`
- `src/ui/toolbar.js`
- `src/ui/filters.js`
- `src/ui/inspector.js`
- `src/ui/interaction.js`
- `styles.css`
- `esbuild.config.mjs`
- `package.json`
- `eslint.config.mjs`
- `tsconfig.json`
- `main.js`
- `pruebas/plugin.cjs`
- `pruebas/fuentes.cjs`
- `pruebas/almacen.cjs`
- `pruebas/workbench.cjs`
- `pruebas/exports.cjs`
- `pruebas/estado.cjs`
- `pruebas/vistas.cjs`
- `pruebas/analisis.cjs`
- `pruebas/render.cjs`
- `pruebas/interaccion.cjs`
- `pruebas/estilos.cjs`
- `pruebas/visualizacion.cjs`
- `pruebas/rendimiento.cjs`
- `pruebas/visual.cjs`
- `pruebas/idioma.cjs`
- `pruebas/v128.cjs`
- `pruebas/simulado.cjs`
- `pruebas/interfaz.cjs`
- `pruebas/mirador/mirador.html`
- `pruebas/mirador/demo.sh`
- `pruebas/mirador/ficha.sh`
- `pruebas/mirador/capturas.sh`
- `pruebas/mirador/vault.json`
- `docs/ygr/YGR.md`
- `docs/ygr/YGR003 Professional Data Visualization Redesign.md`

`manifest.json`, `package-lock.json`, `README.md`, and `instalar-en-vault.sh` are unchanged in this delivery record.
