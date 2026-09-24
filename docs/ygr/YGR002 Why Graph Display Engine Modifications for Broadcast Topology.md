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

While upstream Why Graph (v1.31.0) was optimized for standard personal Zettelkasten and academic note vaults, presenting a large-scale, heterogeneous broadcast network graph—featuring 683 nodes across 7 layers ranging from console surfaces up to 596 multicast streams—revealed severe rendering and traversal limitations:
1. **Arbitrary 3-label sampling** hiding vital infrastructure.
2. **Corrugated black background blobs** caused by overlapping `fillRect()` textboxes.
3. **Barycenter node scrambling** breaking strict alphanumeric equipment numbering.
4. **Dense-layer label cascades** when selecting highly-connected core hubs.
5. **Terminal-layer topic hub conflicts** in Health Mode.
6. **Legacy 2-hop BFS traversal limit** truncating multi-layer signal paths (stopping at L1 or L3).
7. **Lack of operational trace boundaries** around mixing consoles (making unjustified assumptions across human-operated logic gates).
8. **Canvas overlay clutter** (.mn-marca and .mn-guia) occluding the graph viewport.

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

### 3.4 Unified Monospace Typography (9.0px)
To establish an aesthetically clean, uniform typographic cadence across the entire facility view while fitting within dense layer vertical bounds:
- Unified all text labels across all layers to the exact size of Layer 3 I/O Cards: **`9.0px`** monospace (`tam = 9`).
- All nodes in Layer 0 (Routers), Layer 1 (Streams), Layer 2 (Gateways), Layer 3 (Cards), Layer 4 (Consoles), and Layer 5 (Stageboxes) render with identical font sizing.
- Every item shares the same uniform scale and padding, eliminating size jumps and jarring visual hierarchy differences across layer columns.
### 3.5 Terminal Synthesis Layer Architecture
To satisfy Why Graph's last-layer topic synthesis constraint while allowing stageboxes to occupy Layer 5, a dedicated Layer 6 (`Studios`) was established in `data.json`. Why Graph automatically hosts its virtual topic hubs (`ACR40`, `ACR42`, `Shared`) in Layer 6, eliminating all last-layer conflict alerts on physical stageboxes.

### 3.6 Console Logical Trace Boundaries (`L0 <-> L4` and `L4 <-> L5`) with L4 Exception
In broadcast production facilities, Calrec Apollo consoles (Layer 4) are operator surfaces commanding internal DSP cores. Inside the console, human audio operators dynamically assign faders, cross-patch inputs, route auxiliary sends, create mix-minuses, and dispatch submixes.

Because static graph traversal cannot predict human operator switching:
1. **Bridging L3 $\leftrightarrow$ L5 makes assumptions that cannot be justified:** Attempting to trace directly from an incoming gateway card (L3) through the console to a studio stagebox (L5) fabricates a routing continuity that does not exist in the physical network without operator intervention.
2. **Trace Boundaries:** Signal tracing is partitioned into two distinct operational zones bounded by Layer 4:
   - **Zone 1: Infrastructure & Core Transmission (`L0 <-> L4`):** Router Cards (L0) $\leftrightarrow$ ST2110 Streams (L1) $\leftrightarrow$ Audio Gateways (L2) $\leftrightarrow$ Modular I/O Cards (L3) $\leftrightarrow$ Apollo Console Surface (L4). Nodes in L0..L3 terminate strictly at L4 without penetrating L5.
   - **Zone 2: Studio Ingress & Acoustic Deployment (`L4 <-> L5 <-> L6`):** Apollo Console Surface (L4) $\leftrightarrow$ Stageboxes & Racks (L5) $\leftrightarrow$ Production Studios (L6). Nodes in L5..L6 terminate strictly at L4 without penetrating L3.
3. **The L4 Console Exception (`L0 <-> L5`):** As the master production hub commanding the entire facility, a highlighted Console traces its entire active production path:
   - **Upstream ($L_4 \rightarrow L_0$):** Console (L4) $\leftrightarrow$ Installed Cards (L3) $\leftrightarrow$ Audio Gateways (L2) $\leftrightarrow$ ST2110 Streams (L1) $\leftrightarrow$ Core Routers (L0).
   - **Downstream ($L_4 \rightarrow L_5$):** Console (L4) $\leftrightarrow$ Audio Rack Stageboxes & Field Boxes (L5).
   - **Stops strictly at L5:** Does not extend into L6 (Studios), as physical rooms represent facilities rather than controllable signal endpoints.

```javascript
const startCapa = nodo.capa;
// Logical trace boundaries around Console (L4):
let minCapa = 0, maxCapa = 4;
if (startCapa === 4) {
  minCapa = 0; // Console commands full upstream path to L0
  maxCapa = 5; // Console commands downstream stageboxes (L5), stopping before L6
} else if (startCapa > 4) {
  minCapa = 4; // Stageboxes/Studios bound between L4 and L6
  maxCapa = 6;
} else {
  minCapa = 0; // Infrastructure nodes (L0..L3) bound between L0 and L4
  maxCapa = 4;
}
```

### 3.7 Active Multi-Hop Route Luminance & Pulse Synchronization
- **Multi-Hop Path Edge Luminance:** Replaced upstream's dim `0.22` alpha (0.8px line) on intermediate route edges with high-contrast alpha `0.70` (1.25px thickness) whenever both edge endpoints are part of the active route (`na > 0 && nb > 0 && (contiguas || e.superE)`). Direct connections to the focused node retain peak alpha `0.92` (1.6px), while non-involved network edges drop to `0.025` (nearly black).
- **AoIP Flow Animation:** Synchronized `dibujarPulsos()` to transport animated AoIP energy packets along the entire multi-layer signal route when hovering or focusing any entity.

### 3.8 Viewport De-cluttering & Chrome Optimizations
- **Header Stats Overlay (`.mn-marca`):** Hidden via CSS (`display: none !important;`) to eliminate text clutter (`WHY GRAPH · 683 NODES · 1416 LINKS · 31 OFF THE MAP`), giving full horizontal span to the search bar and topic filter chips.
- **Footer Guidance Banner (`.mn-guia`):** Hidden via CSS (`display: none !important;`), clearing the bottom-left corner of the canvas.
- **Top-Bar Geometry Preservation:** Maintained `.mn-barra` at its calibrated top position (`inset: 10px 12px auto 12px;`) to preserve Why Graph's vertical layout geometry matrix (`medir()` / `encuadrar()`), ensuring the multi-layer graph remains centered vertically within the viewport.

---

## 4. Verification & Health Summary

```
=== Why Graph Verification in 2110-audio-io ===
Mapped Nodes:           683
  - Layer 0 (Routers):    4 nodes  (tutti visible)
  - Layer 1 (Streams):    596 nodes (highlight only, 0 glitching)
  - Layer 2 (Gateways):   8 nodes  (tutti visible)
  - Layer 3 (Cards):      56 nodes (tutti visible, 9px monospace)
  - Layer 4 (Consoles):   3 nodes  (right-aligned, tutti visible)
  - Layer 5 (Stageboxes): 14 nodes (tutti visible, Box 01–14)
  - Layer 6 (Studios):    2 nodes  (ACR40, ACR42)
Total Mapped Edges:     1,416
Explained Edges:        1,416 (100.0%)
Unexplained Edges:      0
Nodes with Problems:    0
Grave (Red) Alerts:     0
Broken Wiki Links:      0 (6,163 total internal transitions)
```
---

## 5. Upstream Contribution Potential

These modifications represent high-value candidates for upstream contribution to [`DBB-FC/why-graph`](https://github.com/DBB-FC/why-graph):
1. **Configurable Layer Sorting:** Adding a toggle between barycenter crossing minimization and natural alphanumeric ordering.
2. **Stroke Text Rendering Mode:** An aesthetic toggle for transparent/outlined text labels over dense graph canvases.
3. **Dense-Layer Visibility Thresholds:** Auto-detecting high-density layers ($N > 96$) to avoid label smearing at overview zoom.
