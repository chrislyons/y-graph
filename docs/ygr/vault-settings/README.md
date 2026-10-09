# Why Graph settings archive — known-good vault states

Captured 2026-10-08 from the local Cloudkicker vaults, before merging their preferred
aesthetics into the fork (YGR007).

| Vault | manifest | main.js md5 | styles.css md5 | strokeText (fork marker) |
|---|---|---|---|---|
| research-vault | 1.35.0-y.1 (our deploy) | `1d625c298f37c86b29e40db4393679c2` | `6a1d61c2feb8a66f7f00cc70d84ab2e6` | 1 |
| 2110-audio-io | 1.31.0 (pre-rebase fork era) | `f8f9f1291912a6f1c11c1312091a14a4` | `f41cb148f7972195950686a9d1bee883` | 1 |
| sports-primetime | 1.35.0 | `90dfd3a0676330dd162f82e4b23902d3` | `f41cb148f7972195950686a9d1bee883` | 1 |

Files:

- `<vault>.data.json` — the plugin settings as found (no secrets live here; API keys stay in
  Obsidian local storage).
- `styles-2110-sports.f41cb148.css` — the stylesheet BOTH preferred-aesthetic vaults share;
  distinct from every known release (pre-merge fork `328c2295…`, upstream 1.31 `b3228a6f…`,
  upstream 1.35 `fa6be0c3…`, current fork `6a1d61c2…`), i.e. likely hand-tuned.

User verdict being preserved: graph visuals were best **before the 1.35.0 updates**; the
1.35 nav chrome (chips bar, panels) is welcome; the 1.35 Map Overview modal is not —
it belongs in the plugin's bottom navbar instead.