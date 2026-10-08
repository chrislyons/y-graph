# YGR005 Hover Restoration and Frame-Path Performance

**Document ID:** YGR005
**Date:** 2026-10-08
**Status:** Fixed; full gate green (browser hover gates included)
**Repository:** `y-graph`
**Trigger:** User report after deploying the redesign to `whitebox:~/dev/research-vault` — "What happened to mouseover hover highlighting? (the whole thing is very laggy)"

---

## 1. Root causes

Three independent regressions from the 7f3b45a redesign:

1. **Hover highlighting was dropped entirely.** Upstream's `registrarGestos` computed `nodoEn()` on
   every idle `pointermove`, set `this.sobre`, toggled `mn-sobre-nodo`, and repainted. The
   redesign's `_pointerMove` starts with `if (!this._gesture) return;` — with no button pressed the
   event was discarded, and no `sobre` state field, renderer emphasis, or cursor class existed
   (the CSS rule in `styles.css:97` was left orphaned).
2. **Every pan/zoom mousemove ran the full state pipeline.** `onPan → adoptarEstado` executed
   `aplicarFiltros`, Health `diagnosticos`, `vecindades`, a full inspector DOM update, a complete
   accessible-listbox rebuild (one `<li>` per visible note), and **two** `renderer.setGraph` calls
   — per mouse movement. Measured on the 5 000-note benchmark fixture: `aplicarFiltros` +
   `diagnosticos` alone = **10.76 ms/mousemove** before any DOM work.
3. **Label placement ran on every frame, including idle frames.** `render()` called
   `_prepareFrame → _placeLabels` unconditionally — an O(notes) sweep with canvas text
   measurement and collision checks at the 30 fps animation cadence, even with nothing dirty.

## 2. Fixes

| File | Change |
|---|---|
| `src/view/state.js` | `sobre` field in `normalizarEstado` (validated against known ids like `seleccion`) |
| `src/ui/interaction.js` | `_hover/_hoverClear/_applyHover` (mouse-only, no active gesture, dedup by id, `pointerleave` clears, `mn-sobre-nodo` toggle, `onHover` callback); pan/zoom/arrow-key paths now use `_renderCamera()` |
| `src/view/renderer.js` | `setCamera()` (camera-only: no visibility recompute, no label re-sort), `setHighlight()` (re-sorts label priorities, no visibility recompute), dirty-gated `_prepareFrame` in `render()` (clean frames skip placement), `_measure()` text-measurement cache, hover emphasis: accent ring on the hovered node, accent color + 1.6/k line width on its incident edges, label priority 1 |
| `src/main.js` | `moverCamara()` replaces `adoptarEstado` for `onPan`/`onZoom`; `resaltarHover()` wired to `onHover` |
| `pruebas/*` | New contracts: hover callbacks/dedup/touch-ignore/drag-ignore/leave-clear (`interaccion.cjs`), clean-frame placement skip + `setCamera` visibility preservation + `setHighlight` priority/edge color (`render.cjs`), `sobre: null` in the canonical state (`estado.cjs`, `vistas.cjs`, `visualizacion.cjs`), browser gates `node-hover`/`node-hover-clear` (`visual.cjs`) |

## 3. Measurements (5 000 notes / 17 500 edges, fake canvas, median per frame)

| Path | Before | After |
|---|---|---|
| Idle animation frame (label placement) | 1.14 ms (placement every frame) | **0.001 ms** (placement skipped) |
| Pan renderer step | 1.85 ms (`setGraph`: visibility + sort + repaint) | **1.23 ms** (`setCamera`) |
| Pan pipeline outside renderer | 10.76 ms (`aplicarFiltros` + `diagnosticos`) + inspector + listbox rebuild + double `setGraph` | **0** (not called) |

## 4. Verification

- `npm test` full battery: green (`EXIT=0`). Only pre-existing `✕ title` reporter line remains.
- Browser harness (real Chromium, real bundle): `✓ node-hover — sobre=Clientes/finca-la-esperanza.md, clase=true`
  and `✓ node-hover-clear — sobre tras salir=null`.
- `npm run lint`: 0 errors (7 pre-existing `globalThis` warnings, untouched).
- `npm run test:performance`: budgets informational, no threshold regressions.

## 5. Known limits / follow-ups

- Hover highlight = hovered node ring + incident edges + its label. Upstream additionally dimmed
  the non-neighborhood edge set in some modes; not ported — kept minimal and measurable.
- The `✕ title` gate and the null `nodePoint` click-dispatch in `visual.cjs` are pre-existing
  harness quirks (present in the baseline run before this work); untouched.
- The `maxPorCapa` slider remains a dead control (see YGR004 §5.1) — still open.