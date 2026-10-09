# Why Graph known-good state archive — Cloudkicker vaults

Captured 2026-10-08 from the **local Cloudkicker** vaults (not Whitebox), before merging their
preferred aesthetics into the fork (YGR007). Each vault has a COMPLETE plugin snapshot:
`<vault>.data.json` + `<vault>.main.js` + `<vault>.manifest.json` + `<vault>.styles.css`.

## Why the builds matter (irreplaceable)

| Vault | manifest | main.js md5 | note |
|---|---|---|---|
| research-vault | 1.35.0-y.1 | `1d625c298f37c86b29e40db4393679c2` | our fork deploy — rebuildable from y-graph `07c449c` |
| 2110-audio-io | 1.31.0 | `f8f9f1291912a6f1c11c1312091a14a4` | **YGR002 broadcast display engine over upstream 1.31 — exists NOWHERE else in any git history** |
| sports-primetime | 1.35.0 | `90dfd3a0676330dd162f82e4b23902d3` | sibling custom build (3 151 lines, same lineage) |

The 2110/sports engines carry the YGR002 features the Sep-25 redesign dropped: stroke-outline
typography, tutti/density labels with `zoomCapa`, 9px monospace labels, natural alphanumeric
ordering, route luminance cascade, console trace boundaries. The only prior copies were in
gitignored `.claude/scratch/` — these committed snapshots are now the canonical fallback.

## Shared stylesheet

- `styles-2110-sports.f41cb148.css` — both preferred vaults share it (28 068 B): hand-tuned,
  upstream-DOM lineage, **dark-only by design, monospace chrome**. Matches no tag and no fork
  state; also snapshotted per vault as `<vault>.styles.css`.

## Config facts driving the merge (YGR007)

- `maxPorCapa: 1000` in both specialized vaults (fork ceiling was 600 — clamping them today).
- `ordenAlfabetico` key (2110: `true`, sports: `false`) — fork lacks the key; migration maps it
  to `ordenCapas: 'alfabetico'`.
- sports carries a rich `temas` color map + `excluir` list; research-vault carries the
  six-layer research scheme + 1.35 ingestion keys.

## Liveness warning

`sports-primetime.data.json` changed between first capture (md5 `93a7790…`) and re-capture
(md5 `0f0827d…`) within the same hour — Obsidian rewrites `data.json` while the vault is open.
Re-run the capture immediately before any future migration work.

User verdict preserved: graph visuals were best **before the 1.35.0 updates** (i.e. the YGR002
engine); the 1.35 nav chrome is welcome; the Map Overview belongs in the bottom navbar.