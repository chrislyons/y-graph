# YGR007 Aesthetics Merge — YGR002 Engine Restored, Overview into the Bottom Navbar

**Document ID:** YGR007
**Date:** 2026-10-09
**Status:** Delivered — `1.35.0-y.2`; fork canvas matches the beloved 2110 rendering, 1.35 nav kept
**Repository:** `y-graph`
**Preceded by:** YGR006 (1.35.0 rebase), vault archive `4277243` + `1c182a0`

---

## 1. The finding (user-prompted, verified by grep)

The Sep-25 redesign (YGR003) rebuilt chrome/DOM/inspector but **silently dropped the YGR002
display engine**. Verified zero hits in `src/` for every YGR002 feature while the two
Cloudkicker vaults still ran them: stroke-outline recipe, tutti/density labels + `zoomCapa`,
9px monospace, `ordenAlfabetico`, route luminance cascade, trace boundaries. The canvas
palette also stayed slate/tailwind while DOM noche + the archived stylesheet already spoke
the night-owl system — the mismatch behind "graph visuals changed a lot since v1.31.0".

Full engine spec: YGR002 §3.1–3.7. Reference builds: `docs/ygr/vault-settings/`
(`2110-audio-io.main.js`, `sports-primetime.main.js` — irreplaceable, committed there first).

## 2. What shipped (5 commits, gate green after each)

| Commit | Slice | Content |
|---|---|---|
| `ed81aab` | A | **Overview → bottom navbar**: unified `.mn-workbench-bottombar` (metrics Notas/Enlaces/Explicadas/Fuentes + Tabla/Salud/Vacíos · legend · restored −/home/+ zoom 1.3× clamp 0.3–6). Idle inspector no longer renders `Resumen del mapa` (key reused as the bar's accessible name); phone idle hides the sheet instead of a blank 58vh; desktop strip 50px keeps `areaSegura(50)`/`encuadrar(60)` truthful. |
| `782fa7c` | B | **`ordenAlfabetico` migration**: one-way, legacy key → `ordenCapas 'alfabetico'` (2110) / `'auto'` (sports), key deleted; explicit `ordenCapas` wins over a false flag. |
| `8d43102` | C | **Ceiling 30..2000 step 10** (floor 10 kept): archived `maxPorCapa: 1000` survives import instead of clamping to 600. |
| `241cc29` | D | **Monospace chrome** per the archived sheet: `.mn-raiz` root `var(--font-monospace)` 13px; brand/counter/search/chips/buttons/zoom/fichas/legend/labels mono at the sheet's sizes; panel prose interface at its exact sizes. Palette + canvas untouched by this slice. |
| `7e12c48` | E | **YGR002 display engine restored**: night-owl canvas palette (bg `#060a18`, node `#C9D1FF`, edges `rgba(170,185,255,.2)`, dashed `.16`, accent `#b79cff`…); every label 9px monospace × √k; YGR002 stroke-outline verbatim (round join, miter 2, `rgba(6,10,24,.92)` at `max(2.2, 3.2/√k)`); **tutti labels** — layers ≤96 nodes show ALL labels once `k ≥ zoomCapa` (0.2/0.35/0.55/0.75), >96-node layers strictly highlight-only; route luminance cascade 0.92@1.6px → 0.70@1.25px → 0.025 rest; hover accent keeps precedence. |

## 3. Verification (independent, 2026-10-09)

`npm test` **exit 0** (68s, all suites incl. wired ingesta 93 / v133 48 / v135 10 /
recorridos 27 — plus real-Chrome bottom-bar and idle-inspector gates); `lint` 0 errors;
`idioma` ✓ both directions (497 T() strings, 0 dead, 0 untranslated). New assertions:
workbench 22 (was 19), estilos 72 (was 63), render 53 (was 43), visualización 38;
English sweep now covers 37 UI texts incl. the three new zoom aria-labels.

## 4. Deliberately deferred

- **§3.6 console trace boundaries** — broadcast-hardcoded (L4 zones); 2110 keeps its own
  archived build (`2110-audio-io.main.js`), research-vault has no consoles. Port later,
  config-driven, only if 2110 migrates onto fork builds.
- Always-dark chrome override — the sheet forces dark; fork stays tema-adaptive (both looks
  already loved; flip only on explicit request).

## 5. Delivery

`1.35.0-y.2` deployed to both research-vaults with provenance commits; branch pushed to
`origin/main` (github.com/chrislyons/y-graph). Upstream cadence per YGR006 §5.