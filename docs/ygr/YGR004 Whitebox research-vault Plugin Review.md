# YGR004 Whitebox research-vault Plugin Review

**Document ID:** YGR004
**Date:** 2026-10-08
**Status:** Review complete; recommendations pending user decisions
**Repository:** `y-graph`
**Counterpart:** `whitebox:~/dev/research-vault` (git, Obsidian vault)

---

## 1. What the vault actually runs (provenance)

The plugin lives at `.obsidian/plugins/mapa-neuronal/` (plugin id `mapa-neuronal`, name "Why Graph", `manifest.json` v1.31.0, active in `community-plugins.json`).

| Artifact | Vault copy | Upstream 1.31.0 release | y-graph HEAD (7f3b45a) |
|---|---|---|---|
| `main.js` | 167 275 B, 2 994 lines | 167 257 B — identical except trailing `\n` + `/* nosourcemap */` | 308.5 KiB, 6 185 lines |
| `styles.css` | md5 `b3228a6f…` | md5 `b3228a6f…` (byte-identical) | md5 `328c2295…` |
| files copied | 2026-09-22 15:28 | tag `1.31.0` published 2026-09-19 | redesign landed 2026-09-25 |

Conclusion: **the vault runs the upstream 1.31.0 release build, not a y-graph build.** None of the
y-graph work is live there — no stroke-halo typography (`strokeText` absent from vault `main.js`,
present in y-graph's), no route luminance, no budgeted labels, no semantic data table, no saved
views, no export `schemaVersion: 2`. The vault tracked those files in git on 2026-09-28
(commit `c69d212`) but never recorded which source produced them.

## 2. Latest config edit (uncommitted, working tree)

`.obsidian/plugins/mapa-neuronal/data.json` (mtime 2026-10-08) is the only modified file:

| Key | Before (committed) | After (working tree) |
|---|---|---|
| `capas` | 3 layers, `Name \| description` form: `Entities`, `Knowledge`, `Topics` | 6 plain names: `Series`, `Tweets`, `Research`, `Topics`, `Patterns`, `Decisions` |
| `carpetas` | `tx=1, people=0, rs=1, topics=2, patterns=1, decisions=1, series=1, tags=2` | `series=0, tx=1, rs=2, topics=3, patterns=4, decisions=5` |
| `maxPorCapa` | 150 | 600 (slider ceiling) |

Parse check against `src/model/graph.js:75` and `src/main.js:242`: `capas` splits on `\n` then `|`
with an optional description — plain names are valid; `carpetas` indices 0–5 match the 6 `capas`
lines. **The edit is internally consistent.**

Consequences (settings help text: "Lo que no esté aquí no aparece" — unmapped folders do not appear):

- Unmapped folders: `docs/entities` (355 md), `docs/people` (114), `docs/archive` (40),
  `docs/tags` (1), plus 4 root-level index notes — ~514 files outside every layer. They remain
  reachable only through `carpetasFuentes: "docs/*"` (on-demand source nodes when cited).
- `docs/tx` holds 727 files > `maxPorCapa: 600`, so the deployed build draws ~600 and shows
  `+127 hidden` for the Tweets layer.
- Layer descriptions are now empty (second `|` column dropped) — cosmetic only.
- The old mapping pointed `docs/people` at layer 0 (Entities) and never mapped `docs/entities`,
  so the 6f70b06 people/entities split had already drifted from the config; today's edit
  formalizes exclusion of both instead of mapping them.
- `Mapa neuronal/` graph exports committed in `c69d212` date from 2026-09-22 and predate this
  config change.

## 3. Cross-check: vault contract vs config

`CLAUDE.md` (vault model, line 25): "every note outside the **Entities layer** carries a `tema`
property". The new `capas` list defines **no Entities layer**, so the contract's exemption clause now
references a layer that does not exist in config. Measured: 989 / 1 500 notes have `tema:`; outside
`docs/entities`, 153 lack it (113 `docs/people`, 40 `docs/archive`).

`scripts/audit-vault.py` (pytest-covered) validates tags, `doc_type`, registries — but has **no
Why Graph checks**: no `capas`/`carpetas` consistency, no unmapped-folder report, no `tema`
coverage check, even though the skill-level contract mentions Health Mode.

## 4. (a) How research-vault could improve using y-graph patterns

1. **Deploy the y-graph build.** `./instalar-en-vault.sh <vault>` runs `npm test` first and refuses
   to install on failure; artifacts are `main.js` + `manifest.json` + `styles.css` (never
   `data.json`, so the vault's config survives). The vault currently buys none of the redesign.
2. **Record build provenance.** The vault versions plugin binaries but not their source state —
   we needed forensic diffing to prove they are upstream. After each install, commit with the
   y-graph SHA in the message (y-graph's release workflow already attests releases; local installs
   deserve the same traceability).
3. **Extend `audit-vault.py` with a Why Graph section** (pytest, like the rest): parse
   `data.json`, assert every `carpetas` index < `capas` line count, list folders outside all
   layers, count `tema` coverage per layer contract, and warn when a layer exceeds `maxPorCapa`.
   This turns today's silent ~514-file exclusion into a report line the user accepts or fixes.
4. **Resolve the Entities decision explicitly.** Either map `docs/entities`/`docs/people` into the
   layer scheme (restoring an Entities layer and its `tema` exemption), or keep them source-only
   and reword the CLAUDE.md contract accordingly. Today the contract and the config disagree.
5. **Regenerate `Mapa neuronal/` exports** after committing the config change so the committed
   snapshot matches the layers it claims to represent.
6. **Commit the pending `data.json` edit** with a rationale body (the repo's own convention).

## 5. (b) What y-graph could learn from research-vault

1. **The per-layer cap is dead code in y-graph.** Upstream consumes `maxPorCapa`
   (`main.js:1157`, sets `.oculto`, renders `+{0} hidden`); y-graph HEAD has 5 occurrences — all
   settings default/clamp/slider/schema — zero `.oculto` assignments, no `ocultas` i18n key, yet
   the "Notas visibles por capa" slider and settings-schema entry remain. The vault user just moved
   that slider to its max expecting effect. Either rewire it to the new renderer or delete the
   control and its schema entry.
2. **Real-corpus fixtures.** `data.json` is gitignored here, so no test ever sees a live config —
   including the vault's just-edited one (plain layer names, 6-layer mapping, `maxPorCapa: 600`
   against a 727-note layer). Capture a sanitized fixture and pin the parser against it.
3. **Document the input contract.** The `tema` frontmatter rule, `## Connections` reason section
   (em-dash format), and Health Mode counting live only in the vault's `CLAUDE.md` and the
   user-level `why-graph` skill (`~/.claude/skills/why-graph/`, which reverse-engineers rules from
   the *deployed* `main.js` and warns "re-check after a plugin upgrade"). y-graph's YGR docs cover
   display only; the note contract the plugin consumes belongs in this repo too.
4. **Audit-tool discipline.** The vault pairs `scripts/audit-vault.py` with
   `tests/test_audit_vault.py` and makes the audit a gate for ingestion. y-graph's 15-suite
   `npm test` battery covers runtime behavior but nothing validates settings/config consistency
   (see item 1) — the vault's pattern is a cheap, deterministic gate for exactly that.
5. **Remote deploy path.** The live vault is on Whitebox; `instalar-en-vault.sh` only accepts a
   local path, so builds reach it by ad-hoc copy. Supporting an `ssh:` target (or documenting the
   scp step) plus writing a SHA receipt would close the provenance gap noted in §4.2.
6. **Gap-table assessments.** The vault's `OPTIMIZATION_PLAN.md` states gaps, impact, priority in
   one table. YGR003 documents what shipped well; a short "what's degraded vs upstream" table
   would have surfaced the dead slider and the undeployed build sooner.

## 6. Open decisions (user)

- Deploy y-graph HEAD build to the vault now, or keep upstream 1.31.0 until the dead-cap
  regression (§5.1) is resolved?
- Entities/people: map them into layers or exempt them in writing?
- `maxPorCapa`: raise the hard ceiling (currently clamped 30–600 in `src/main.js:159`) now that
  a real corpus exceeds it?