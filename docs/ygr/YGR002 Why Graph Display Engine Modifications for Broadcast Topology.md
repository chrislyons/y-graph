# YGR002 Why Graph Display Engine Modifications for Broadcast Topology

**Document ID:** YGR002  
**Date:** 2026-09-24  
**Status:** Completed  
**Author:** AI Agent / Chris Lyons  
**Repository:** `y-graph`  
**Target Plugin:** Why Graph ("Mapa Neuronal", ID: `mapa-neuronal`)  

---

## 1. Executive Summary

This document records the architectural modifications, display engine enhancements, and typographic fixes engineered for **Why Graph** during deployment against the high-density SMPTE ST2110 broadcast audio facility vault (`2110-audio-io`). 

While upstream Why Graph (v1.31.0) was optimized for standard personal Zettelkasten and academic note vaults, presenting a large-scale, heterogeneous broadcast network graph—featuring 682 nodes across 6 layers ranging from 2 console surfaces up to 596 multicast streams—revealed severe rendering limitations:
1. **Arbitrary 3-label sampling** hiding vital infrastructure.
2. **Corrugated black background blobs** caused by overlapping `fillRect()` textboxes.
3. **Barycenter node scrambling** breaking strict alphanumeric equipment numbering.
4. **Dense-layer label cascades** when selecting highly-connected core hubs.
5. **Terminal-layer topic hub conflicts** in Health Mode.

All limitations were resolved with zero regressions to Why Graph's core semantic model.

---

## 2. Identified Deficiencies in Upstream Engine

### 2.1 Upstream 3-Label Heuristic (`n.destacado`)
In upstream `main.js:1153`:
```javascript
for (let c = 0; c < ultima; c++) N.filter((n) => n.capa === c && !n.fuente && !n.virtual)
  .sort((p, q) => this.ady[q.id].length - this.ady[p.id].length)
  .slice(0, 3)
  .forEach((n) => { if (this.ady[n.id].length >= 3) n.destacado = true; });
```
And line 1846:
```javascript
if (n.capa === ultima || n.agrupados || enSug || ... || n.destacado && activo ...) rotulos.push(n);
```
**Impact:** At overview zoom (`vista.k <= 2.2`), Why Graph only displayed labels for the top 3 highest-degree nodes per layer. In a broadcast plant, this hid primary router card `AMX103`, 5 out of 8 Audio Gateways, and 13 out of 16 stageboxes.

### 2.2 Opaque Textbox Smearing (`fillRect`)
In upstream `main.js:1866–1869`:
```javascript
ctx.fillStyle = "rgba(6,10,24,.86)";
ctx.fillRect(x, y, w + pad * 2, h);
ctx.fillStyle = fuerte ? "#FFFFFF" : "rgba(230,234,255,.9)";
ctx.fillText(texto, x + pad, y + h - 5 / vista.k);
```
**Impact:** Each text label drew a dark filled rectangle. In layers with dense vertical spacing (such as 596 ST2110 streams spaced ~1–2px apart), hundreds of overlapping `fillRect` boxes composited into solid black rectangles, occluding both labels and the flowing colored transport curves.

### 2.3 Barycenter Re-sorting vs. Equipment Naming
In upstream `main.js:632–645`:
The engine executed a 6-pass barycenter crossing-minimization loop (`c.sort(..., p._b - q._b)`).
**Impact:** Numbered physical equipment (`AMX101`–`104`, `TORMPXAGW005`–`012`, `Box 01`–`14`) was scrambled vertically based on arbitrary graph degrees rather than physical rack or numerical order.

### 2.4 Terminal Layer Topic Conflict (`capa === ultima`)
In upstream `main.js:1514–1522`:
```javascript
const ultima = this.D.capas.length - 1;
if (n.capa === ultima && n.tema && (this.hermanas?.[n.tema] || 0) > 1 && this.hubs[n.tema] !== n.id)
  p.push(T("otras {0} nota(s) de este tema en la capa de temas...", this.hermanas[n.tema] - 1));
```
**Impact:** The engine hardcoded the last layer index as the "Topic Synthesis Layer". Placing equipment (e.g. stageboxes) in the last layer caused Why Graph to flag all nodes sharing topic `ACR40` as conflicting duplicates in Health Mode.

---

## 3. Implemented Engine Modifications

### 3.1 Stroke-Outlined Typography (`strokeText`)
Eliminated `fillRect` textboxes. Typography now renders with a crisp, rounded dark outline directly over the canvas:

```javascript
ctx.save();
ctx.lineJoin = "round";
ctx.miterLimit = 2;
ctx.strokeStyle = "rgba(6, 10, 24, 0.92)";
ctx.lineWidth = Math.max(2.2, 3.2 / sk);
ctx.strokeText(texto, x, y);
ctx.fillStyle = fuerte ? "#FFFFFF" : "rgba(230, 234, 255, 0.95)";
ctx.fillText(texto, x, y);
ctx.restore();
```
*Result:* Text is 100% legible against any background color or bright glowing curve, while underlying visual ribbons remain completely visible.

### 3.2 Tutti Rendering vs. Dense Layer Highlight Isolation
Replaced the `.slice(0, 3)` limit with density-aware visibility:

```javascript
const numNodesInLayer = this.capas?.[n.capa]?.n || 50;
const isDenseLayer = numNodesInLayer > 96;
const isDirectlyHighlighted = (n.id === centro) || (n.id === this.sobre) || 
                              (n.id === sobreRadial) || (enCamino && enCamino.has(n.id)) || enSug;
const isLinkedHighlighted = (nivel && nivel[n.id] !== void 0);

let mostrar = false;
if (isDenseLayer) {
  // Streams (596 nodes): strictly isolated to directly highlighted nodes
  mostrar = isDirectlyHighlighted;
} else {
  // Equipment layers (<= 96 nodes): tutti appearance once zoom threshold is reached
  mostrar = (!radial && vista.k >= zoomCapa(n.capa)) || isDirectlyHighlighted || isLinkedHighlighted || n.capa === ultima || n.agrupados;
}
if (mostrar) rotulos.push(n);
```

### 3.3 Natural Alphanumeric Layer Sorting (`ordenAlfabetico`)
Updated `construir()` and `medir()`:
- If `s.ordenAlfabetico !== false`, bypass the barycenter crossing loop and sort each layer column using natural alphanumeric collation:
  ```javascript
  const comparar = (a, b) => (a.titulo || a.id).localeCompare(b.titulo || b.id, void 0, { numeric: true, sensitivity: "base" });
  cols.forEach((c) => c.sort(comparar));
  ```
- Defaulted `"ordenAlfabetico": true` in `AJUSTES_BASE` and `data.json`.
- Added setting toggle in `AjustesMapa` ("Orden alfabético en capas").

### 3.4 Layer-Density Proportioned Fonts
Replaced hardcoded `11.5px` font sizing with a dynamic scale preserving `--font-monospace`:
- **Routers & Consoles (L0, L4):** `12.5px` bold
- **Audio Gateways (L2):** `11.5px`
- **Stageboxes (L5):** `11.0px`
- **I/O Cards (L3, 56 nodes):** `9.0px` (fits cleanly inside 56-row height)
- **ST2110 Streams (L1, 596 nodes):** `8.0px` compact

### 3.5 Terminal Synthesis Layer Architecture
To satisfy Why Graph's last-layer topic synthesis constraint while allowing stageboxes to occupy Layer 5, a dedicated Layer 6 (`Studios`) was established in `data.json`. Why Graph automatically hosts its virtual topic hubs (`ACR40`, `ACR42`, `Shared`) in Layer 6, eliminating all last-layer conflict alerts on physical stageboxes.

---

## 4. Verification & Health Summary

```
=== Why Graph Verification in 2110-audio-io ===
Mapped Nodes:           682
  - Layer 0 (Routers):    4 nodes  (tutti visible)
  - Layer 1 (Streams):    596 nodes (highlight only, 0 glitching)
  - Layer 2 (Gateways):   8 nodes  (tutti visible)
  - Layer 3 (Cards):      56 nodes (tutti visible, 9px monospace)
  - Layer 4 (Consoles):   2 nodes  (right-aligned, tutti visible)
  - Layer 5 (Stageboxes): 16 nodes (tutti visible)
  - Layer 6 (Studios):    Virtual synthesis layer
Total Mapped Edges:     2,179
Explained Edges:        2,179 (100.0%)
Unexplained Edges:      0
Nodes with Problems:    0
Grave (Red) Alerts:     0
Broken Wiki Links:      0 (10,444 total links)
```

---

## 5. Upstream Contribution Potential

These modifications represent high-value candidates for upstream contribution to [`DBB-FC/why-graph`](https://github.com/DBB-FC/why-graph):
1. **Configurable Layer Sorting:** Adding a toggle between barycenter crossing minimization and natural alphanumeric ordering.
2. **Stroke Text Rendering Mode:** An aesthetic toggle for transparent/outlined text labels over dense graph canvases.
3. **Dense-Layer Visibility Thresholds:** Auto-detecting high-density layers ($N > 96$) to avoid label smearing at overview zoom.
