# YGR006 Upstream 1.35.0 Rebase and Dual-Vault Delivery

**Document ID:** YGR006
**Date:** 2026-10-08
**Status:** Delivered — fork = upstream 1.35.0 + all customizations; both vaults on one build
**Repository:** `y-graph`

---

## 1. Why

User updated both research vaults to upstream 1.35.0 (wiping the fork build), then chose
"rebase fork onto 1.35.0 first" over redeploy: keep every upstream release AND the fork's
display engine (YGR002/003/005 — stroke typography, 9px type, hover, frame-path fixes).

## 2. How

Three-way merge (merge base `a1588a3` = upstream 1.31.0 is an ancestor), all 10 conflicts
resolved fork-side; upstream's 81-hunk `src/main.js` delta used as the port worklist
(`git diff 1.31.0 1.35.0 -- src/main.js`; stages recoverable via `git show :1:/:2:/:3:`).
i18n harvested separately: 215 new strings, consumed only as their features landed
(`pruebas/idioma.cjs` enforces dict↔code sync both directions).

Port waves (each ends green — `npm test` exit 0, `npm run lint` 0 errors):

| Wave | Commits | Content |
|---|---|---|
| 1 | `457b7c1` `c5f87dc` `d02104b` | Settings groups/pages, 17 AJUSTES_BASE keys, `negocio` template + assistant redistribution, OpenRouter provider, live model picker (1.34) |
| 2 | `ddf5e0d` `e49ded3` `5e22b1f` | Ingestion engine (`src/model/ingestion.js`), `ingerir` command, pulses in renderer, `maxPorCapa` re-wired (was dead), search (`src/model/search.js`, accents/order/aliases), harness adaptations |
| 3 | `d7380d1` `a61bfdd` `18b1823` `245ac24` `d7d4025` `1044b67` `f4b16f8` `566cbc0` | Second-review vote, TF-IDF similarity + t-SNE (`src/model/similarity.js`), perspective review, Novedades panel, bandeja "Llegó de afuera", timeline, rejection UI, link-review panel (`calcularPendientes`), content-topics layout, similarity/perspective panels, e2e harness DOM adaptation, suites wired into `npm test` |

Decisions worth remembering:

- **Fork API wins, upstream intent preserved.** Upstream-written suites (`v128`, `v133`,
  `recorridos`) were adapted to fork surfaces (combobox `aria-activedescendant` search,
  inspector-as-note-surface on phone, `renderer`-level pulse harness) with every assertion
  kept in intent; `estilos.cjs` forbids upstream monolith field names (`this.D`/`this.N`).
- **State-flow law held**: camera/hover never route through `adoptarEstado` (YGR005).
- Command count staged 3→4 exactly when `ingerir` landed; `maxPorCapa` floor 10 (matches
  upstream journey), `topeDiario` no longer inflated below its minimum.

## 3. Gate (independent verification, 2026-10-08)

`npm test` **exit 0** with `ingesta` (93) + `v133` (48) + `v135` (10) + `e2e/recorridos`
(27/27) wired in; `plugin` 120, `estilos` 61, `v128` 81, `idioma` ✓ both directions;
`npm run lint` 0 errors (7 pre-existing warnings). Only the pre-existing `✕ title`
reporter line in `visual.cjs` remains (non-fatal, failures empty).

## 4. Versioning & delivery

- Fork version **`1.35.0-y.1`** (manifest + package.json + versions.json): tag namespace can
  never collide with upstream's numeric tags on `git fetch upstream --tags`; footer shows the
  fork build at a glance (the "why don't I see our typography" trap).
- Deployed to **both** research vaults (Whitebox + Cloudkicker) as one identical build,
  md5-verified, provenance-committed per vault; `data.json` never touched by deploys.
- Remotes: `origin = github.com/chrislyons/y-graph` (public), `upstream = DBB-FC/why-graph`.
  First push: `feature/professional-data-visualization-redesign` → `origin/main`.
- `yonder` (YND) scaffolded same day; `chrislyons/yonder` private origin.

## 5. Upstream relationship (ongoing)

Not immune to upstream — merged *to* 1.35.0 on demand. Cadence recommendation: quarterly
`git fetch upstream` + repeat this workflow; conflict resolutions above are the playbook.
Community-store path remains a decision: same-id listing impossible (mapa-neuronal is
DBB-FC's), so either PR upstream, publish as a distinct id, or stay on BRAT/private.