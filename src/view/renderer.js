import { layoutCapas, layoutRadial, puntosCurva } from './layouts.js';
import { T } from '../i18n.js';
import { sorteo } from '../model/ingestion.js';
import { pasaFiltro } from '../model/search.js';

const CELL_SIZE = 160;
const TAU = Math.PI * 2;
const ETIQUETA_ALTO = 18;
const ETIQUETA_ESPACIO = 4;
const DASH_VACIO = Object.freeze([]);
const DASH_SALUD = Object.freeze([4, 3]);

// Color hex con alfa para los pulsos (rgba de upstream).
function rgba(h, a) {
  const v = parseInt(String(h).replace('#', ''), 16) || 0xC9D1FF;
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}

const PALETA_BASE = Object.freeze({
  bg: '#111827', surface: '#1f2937', border: '#4b5563', text: '#f9fafb', muted: '#9ca3af',
  grid: '#374151', accent: '#60a5fa', danger: '#ef4444', warning: '#f59e0b', success: '#22c55e',
  labelHalo: '#111827', edge: '#9ca3af', node: '#93c5fd', source: '#c4b5fd', topic: '#67e8f9',
});

function texto(value) {
  return value == null ? '' : String(value);
}

function numero(value, defecto = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defecto;
}

function limitesVisibles(limites, left, top, right, bottom) {
  if (!limites || !Number.isFinite(limites.minX) || !Number.isFinite(limites.minY) || !Number.isFinite(limites.maxX) || !Number.isFinite(limites.maxY)) return 0;
  const w = Math.max(0, limites.maxX - limites.minX);
  const h = Math.max(0, limites.maxY - limites.minY);
  if (!w || !h) return 0;
  const x = Math.max(0, Math.min(limites.maxX, right) - Math.max(limites.minX, left));
  const y = Math.max(0, Math.min(limites.maxY, bottom) - Math.max(limites.minY, top));
  return x * y / (w * h);
}


function solapan(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function distanciaBezier(px, py, a, b, edge) {
  let mejor = Infinity;
  let previoX = a.x;
  let previoY = a.y;
  for (let paso = 1; paso <= 24; paso++) {
    const t = paso / 24;
    const u = 1 - t;
    const x = u * u * u * a.x + 3 * u * u * t * edge.c1x + 3 * u * t * t * edge.c2x + t * t * t * b.x;
    const y = u * u * u * a.y + 3 * u * u * t * edge.c1y + 3 * u * t * t * edge.c2y + t * t * t * b.y;
    const dx = x - previoX;
    const dy = y - previoY;
    const largo = dx * dx + dy * dy;
    const u2 = largo ? Math.max(0, Math.min(1, ((px - previoX) * dx + (py - previoY) * dy) / largo)) : 0;
    const d = (px - previoX - dx * u2) ** 2 + (py - previoY - dy * u2) ** 2;
    if (d < mejor) mejor = d;
    previoX = x;
    previoY = y;
  }
  return Math.sqrt(mejor);
}

function celdas(limites, visitar) {
  const x0 = Math.floor(limites.minX / CELL_SIZE);
  const x1 = Math.floor(limites.maxX / CELL_SIZE);
  const y0 = Math.floor(limites.minY / CELL_SIZE);
  const y1 = Math.floor(limites.maxY / CELL_SIZE);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) visitar(x, y);
}

function idCelda(x, y) {
  return `${x}:${y}`;
}


function esSaludable(nodo, estado) {
  if (nodo.salud === false || nodo.salud === 'ok' || nodo.salud === 'sano') return false;
  if (nodo.grave || nodo.rota || nodo.sinMotivo > 0) return true;
  if (estado && estado.salud === true && nodo.grado === 0) return true;
  return !!(nodo.salud || (nodo.original && nodo.original.salud));
}

function nodoImportante(id, estado) {
  return texto(estado.seleccion) === id || texto(estado.foco) === id || texto(estado.focoTeclado) === id
    || (Array.isArray(estado.ruta) && estado.ruta.includes(id));
}

// La misma regla que el buscador del workbench: palabras en cualquier orden, sin tildes,
// guiones ni mayúsculas, y también por alias. Solo se resalta con filtro activo.
function estaBuscado(nodo, filtro) {
  return !!filtro && pasaFiltro(nodo, filtro);
}

function medida(medirTexto, text, font) {
  if (typeof medirTexto === 'function') {
    const result = medirTexto(text, font);
    if (typeof result === 'number') return result;
    if (result && Number.isFinite(result.width)) return result.width;
  }
  return texto(text).length * 6.5;
}

function esRectanguloVisible(rect, left, top, right, bottom, umbral) {
  const bounds = rect && rect.minX !== undefined ? rect : { minX: rect.x, minY: rect.y, maxX: rect.x + rect.w, maxY: rect.y + rect.h };
  return limitesVisibles(bounds, left, top, right, bottom) >= umbral;
}

function contextoSeguro(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  try { return canvas.getContext('2d'); } catch { return null; }
}

/** Renderizador Canvas sin DOM ni dependencias: dibuja, etiqueta, exporta y hit-testea la misma escena. */
export class GraphRenderer {
  constructor(canvas, opciones = {}) {
    this.canvas = canvas || null;
    this.ctx = contextoSeguro(this.canvas);
    this.medirTexto = typeof opciones.medirTexto === 'function' ? opciones.medirTexto : null;
    this.paleta = { ...PALETA_BASE, ...(opciones.paleta || {}) };
    this.preferencias = { ...(opciones.preferencias || {}) };
    this.viewport = { width: numero(this.preferencias.width, 1), height: numero(this.preferencias.height, 1), dpr: 1 };
    this.datos = null;
    this.estado = {};
    this.scene = null;
    this._dataIdentity = null;
    this._geometrySignature = '';
    this._nodeById = new Map();
    this._visibleIds = new Set();
    this._pathIds = new Set();
    this._searchIds = new Set();
    this._spatial = new Map();
    this._backgroundCanvas = null;
    this._foregroundCanvas = null;
    this._backgroundCtx = null;
    this._foregroundCtx = null;
    this._labels = [];
    this._dirtyBackground = true;
    this._dirtyForeground = true;
    this._lastLowDetail = null;
    this._destroyed = false;
    this._pendingFrames = 0;
    this._Path2D = opciones.path2D || (typeof window !== 'undefined' ? window.Path2D : null) || null;
    this._nextLabels = [];
    this._labelOccupied = [];
    this._rectPool = { rects: Array.from({ length: 4 }, () => ({ x: 0, y: 0, w: 0, h: ETIQUETA_ALTO })), count: 0 };
    this._nodeBoundsScratch = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    this._labelById = new Map();
    this._orderedLabels = [];
    this._layers = null;
    this._visibleScreenBounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    this._edgeDash = [];
    this._edgeDashK = 0;
    this.tiempo = 0;
    this._dist = new Map();
    this._ady = new Map();
  }

  setViewport({ width, height, dpr } = {}) {
    const next = {
      width: Math.max(1, numero(width, this.viewport.width || 1)),
      height: Math.max(1, numero(height, this.viewport.height || 1)),
      dpr: Math.max(0.1, numero(dpr, this.viewport.dpr || 1)),
    };
    if (next.width === this.viewport.width && next.height === this.viewport.height && next.dpr === this.viewport.dpr) return this;
    this.viewport = next;
    if (this.scene) {
      this._dirtyBackground = true;
      this._dirtyForeground = true;
      this._ensureGeometry();
    }
    return this;
  }

  setGraph(datos, estado = {}) {
    if (this._destroyed) return this;
    const nextData = datos || { nodos: [], aristas: [], capas: [] };
    const changed = nextData !== this._dataIdentity;
    this.datos = nextData;
    this.estado = estado || {};
    this._ensureGeometry(changed);
    this.scene.reservaPanel = Math.max(0, numero(this.estado.reservaPanel, this.preferencias.reservaPanel));
    this._computeVisibility();
    this._sortLabels();
    this.invalidate();
    return this;
  }

  /** Solo cambia la cámara: ni la visibilidad ni el orden de etiquetas dependen de ella. */
  setCamera(estado = {}) {
    if (this._destroyed) return this;
    this.estado = { ...this.estado, ...(estado || {}) };
    if (this.scene) { this._dirtyBackground = true; this._dirtyForeground = true; }
    return this;
  }

  /** Cambia el resaltado (hover) sin recalcular la visibilidad: reprioriza etiquetas y repinta. */
  setHighlight(estado = {}) {
    if (this._destroyed) return this;
    this.estado = { ...this.estado, ...(estado || {}) };
    this._sortLabels();
    this._dirtyBackground = true;
    this._dirtyForeground = true;
    return this;
  }

  invalidate() {
    this._dirtyBackground = true;
    this._dirtyForeground = true;
    return this;
  }

  render(tiempo) {
    if (this._destroyed || !this.ctx) return;
    this._ensureGeometry();
    const stamp = Number.isFinite(Number(tiempo)) ? Number(tiempo) : Date.now();
    this.tiempo = stamp;   // [1.33] los pulsos se deciden con el reloj del cuadro, no con el índice del grupo
    const low = this._isLowDetail(stamp);
    if (this._lastLowDetail !== null && this._lastLowDetail !== low) this._dirtyBackground = true;
    this._lastLowDetail = low;
    const pixelWidth = Math.max(1, Math.round(this.viewport.width * this.viewport.dpr));
    const pixelHeight = Math.max(1, Math.round(this.viewport.height * this.viewport.dpr));
    const resized = this._resizeCanvas(this.canvas, pixelWidth, pixelHeight);
    const layers = this._ensureOffscreen(pixelWidth, pixelHeight);
    // Un frame sin cambios no vuelve a colocar etiquetas: colocar cuesta O(nodos) con colisiones.
    if (this._dirtyBackground || this._dirtyForeground) this._prepareFrame(low);
    if (!layers) {
      if (this._dirtyBackground || this._dirtyForeground || resized) this._drawScene(this.ctx, { low, direct: true, presentation: false });
      this._drawPulsos(this.ctx);
      return;
    }
    if (this._dirtyBackground) {
      this._resetLayer(this._backgroundCtx, pixelWidth, pixelHeight);
      this._drawScene(this._backgroundCtx, { low, direct: false, presentation: false, background: true });
      this._dirtyBackground = false;
    }
    if (this._dirtyForeground) {
      this._resetLayer(this._foregroundCtx, pixelWidth, pixelHeight);
      this._drawScene(this._foregroundCtx, { low, direct: false, presentation: false, background: false });
      this._dirtyForeground = false;
    }
    this._composite(this.ctx, layers, pixelWidth, pixelHeight);
    this._drawPulsos(this.ctx);
  }

  /** Los pulsos viven fuera de las capas cacheadas: solo ellos se repintan cada cuadro. */
  _drawPulsos(ctx) {
    if (!this.scene || !this._pulsosActivos()) return;
    if (typeof ctx.setTransform === 'function') ctx.setTransform(this.viewport.dpr, 0, 0, this.viewport.dpr, 0, 0);
    this.dibujarPulsos(ctx, Math.sqrt(Math.max(0.09, this._camera().k)), (tema) => this.colorTema(tema));
  }

  /** Con «Animación» apagado o pidiendo menos movimiento, no hay pulsos (ni cuadros) en pantalla. */
  _pulsosActivos() {
    if (this.preferencias.animacion !== true) return false;
    return !(typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** Hex del tema del mapa (o el color de borde si el tema no tiene color). */
  colorTema(tema) {
    const t = this.datos && this.datos.temas && tema ? this.datos.temas[tema] : null;
    const c = Array.isArray(t) ? t[1] : t && (t.color || t.nombre);
    return typeof c === 'string' && c ? c : this.paleta.edge;
  }

  /** Punto de la curva real de la escena en u ∈ [0, 1): el pulso siempre monta sobre la línea. */
  puntoEn(A, B, u, radial = false) {
    const centro = radial ? this._nodeById.get(texto(this.estado.foco || this.estado.seleccion)) : null;
    const puntos = puntosCurva(A, B, radial ? 'radial' : A.capa === B.capa ? 'same' : 'cross', centro);
    const q = (a, b, c, d) => (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * d;
    return [q(A.x, puntos.c1x, puntos.c2x, B.x), q(A.y, puntos.c1y, puntos.c2y, B.y)];
  }

  /**
   * [1.33] Cada pulso decide si sale al empezar SU viaje y lo termina: antes el grupo que pulsaba
   * cambiaba cada 2,6 s sin mirar dónde iba cada pulso (cientos cortados a mitad de curva cada 30 s
   * en el cerebro real), y la selección «(i·7 + turno·13) % k» dejaba turnos enteros sin ningún
   * pulso cuando k compartía un factor con 7. Ahora el sorteo es por enlace y por viaje: parejo y
   * sin cortes. ctx solo recibe globalCompositeOperation/fillStyle/beginPath/arc/fill.
   */
  dibujarPulsos(ctx, sk, color) {
    if (!this._pulsosActivos() || !this.scene) return;
    const cam = this._camera();
    const t = numero(this.tiempo, 0);
    const radial = this.scene.mode === 'radial';
    const ruta = Array.isArray(this.estado.ruta) ? this.estado.ruta : [];
    const pares = [];   // [de, a, u, tono, onda]
    const dur = ruta.length > 1 ? 2200 : 1700;
    const punto = (id) => this._nodeById.get(id);
    if (ruta.length > 1) {
      for (let i = 0; i < ruta.length - 1; i++) pares.push([ruta[i], ruta[i + 1], ((t / dur) - i / Math.max(ruta.length - 1, 1) + 1) % 1, '#FFFFFF']);
    } else if (!radial) {
      const c = texto(this.estado.foco || this.estado.sobre);
      const vis = this.scene.edges.filter((e) => this._edgeVisible(e));
      const lista = c ? vis.filter((e) => e.a === c || e.b === c) : vis.filter((e) => {
        const A = punto(e.a), B = punto(e.b);
        return A && B && (Math.abs(A.capa - B.capa) === 1 || A.supernode || B.supernode);
      });
      const p = c ? 1 : Math.min(1, 45 / Math.max(1, lista.length));
      for (const [i, e] of lista.entries()) {
        const fase = (i * 0.618) % 1, viaje = Math.floor(t / dur + fase);
        if (p < 1 && sorteo(i, viaje) >= p) continue;
        const A = punto(e.a), B = punto(e.b);
        if (!A || !B) continue;
        const [de, a] = A.capa <= B.capa ? [e.a, e.b] : [e.b, e.a];
        pares.push([de, a, (t / dur + fase) % 1, color((A.capa >= B.capa ? A : B).tema)]);
      }
    } else {
      // Radial: ondas que salen del centro, llegan al anillo 1 y siguen al 2. Dos ondas
      // desfasadas medio ciclo, para que siempre haya algo en movimiento.
      const dist = this._dist;
      const ady = this._ady;
      const foco = texto(this.estado.foco || this.estado.seleccion);
      const vis = this.scene.edges.filter((e) => this._edgeVisible(e)
        && dist.has(e.a) && dist.has(e.b) && Math.abs(dist.get(e.a) - dist.get(e.b)) === 1);
      const sobre = this.estado.sobre && texto(this.estado.sobre) !== foco ? texto(this.estado.sobre) : null;
      const ciclo = 1700 * 2.6;
      for (const nivel of [0, 1]) {
        let tramo = vis.filter((e) => Math.min(dist.get(e.a), dist.get(e.b)) === nivel);
        if (sobre) {
          const vecinos = ady.get(sobre) || [];
          tramo = tramo.filter((e) => e.a === sobre || e.b === sobre || (nivel === 0 && (vecinos.includes(e.a) || vecinos.includes(e.b))));
        }
        const p = Math.min(1, (nivel === 0 ? 60 : 70) / 2 / Math.max(1, tramo.length));
        for (const onda of [0, 1]) {
          const to = t + onda * ciclo / 2, vuelta = Math.floor(to / ciclo) * 2 + onda;
          tramo.forEach((e, i) => {
            if (p < 1 && sorteo(i + nivel * 100003, vuelta) >= p) return;
            const local = (to % ciclo) / 1700 - (nivel + ((i * 0.618) % 1) * 0.25);
            if (local < 0 || local > 1) return;
            const A = punto(e.a), B = punto(e.b);
            if (!A || !B) return;
            const [de, a] = dist.get(e.a) <= dist.get(e.b) ? [e.a, e.b] : [e.b, e.a];
            pares.push([de, a, local, color((dist.get(e.a) >= dist.get(e.b) ? A : B).tema), true]);
          });
        }
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const [de, a, u, tono, onda] of pares) {
      const A = punto(de), B = punto(a);
      if (!A || !B) continue;
      const [wx, wy] = this.puntoEn(A, B, u, radial);
      const x = wx * cam.k + cam.x, y = wy * cam.k + cam.y;
      ctx.fillStyle = rgba(tono, onda ? 0.25 : 0.22);
      ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(x, y, 1.7, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  hitTest(x, y) {
    if (this._destroyed || !this.scene) return null;
    const screenX = numero(x, NaN);
    const screenY = numero(y, NaN);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)
      || screenX < 0 || screenY < 0 || screenX > this.viewport.width || screenY > this.viewport.height) return null;
    const camera = this._camera();
    const k = camera.k || 1;
    const worldX = (numero(x) - camera.x) / k;
    const worldY = (numero(y) - camera.y) / k;
    const cellX = Math.floor(worldX / CELL_SIZE);
    const cellY = Math.floor(worldY / CELL_SIZE);
    const candidates = this._spatial.get(idCelda(cellX, cellY));
    if (!candidates || !candidates.length) return null;
    let best = null;
    for (const candidate of candidates) {
      if (candidate.type === 'node') {
        const node = this._nodeById.get(candidate.id);
        if (!node || !this._nodeVisible(node)) continue;
        const d = Math.max(0, Math.hypot(worldX - node.x, worldY - node.y) - node.radio);
        if (d <= (this._nodeHitPadding(k)) && (!best || d < best.distancia || d === best.distancia && best.tipo !== 'nodo')) {
          best = { tipo: 'nodo', id: node.id, distancia: d };
        }
      } else {
        const edge = candidate.edge;
        const a = this._nodeById.get(edge.a);
        const b = this._nodeById.get(edge.b);
        if (!a || !b || !this._edgeVisible(edge)) continue;
        const d = distanciaBezier(worldX, worldY, a, b, edge);
        if (d <= 8 / k && (!best || d < best.distancia)) best = { tipo: 'arista', id: edge.id, a: edge.a, b: edge.b, distancia: d };
      }
    }
    return best;
  }

  frameForExport({ width, height, dpr, modoPresentacion = true } = {}) {
    if (this._destroyed) return null;
    const exportWidth = Math.max(1, numero(width, this.viewport.width));
    const exportHeight = Math.max(1, numero(height, this.viewport.height));
    const exportDpr = Math.max(0.1, numero(dpr, this.viewport.dpr || 1));
    const canvas = this._createCanvas();
    if (!canvas) return null;
    canvas.width = Math.max(1, Math.round(exportWidth * exportDpr));
    canvas.height = Math.max(1, Math.round(exportHeight * exportDpr));
    const ctx = contextoSeguro(canvas);
    if (!ctx) return { canvas, width: exportWidth, height: exportHeight };
    const reserve = Math.max(0, numero(this.estado.reservaPanel, 0));
    const mobile = this._mobile();
    const exportRight = mobile ? exportWidth : Math.max(0, exportWidth - reserve);
    const exportBottom = mobile ? Math.max(0, exportHeight - reserve) : exportHeight;
    this._visibleScreenBounds.minX = 0;
    this._visibleScreenBounds.minY = 0;
    this._visibleScreenBounds.maxX = exportRight;
    this._visibleScreenBounds.maxY = exportBottom;
    this._placeLabels(this._camera(), exportRight, exportBottom, false, exportWidth);
    this._drawScene(ctx, { low: false, direct: true, presentation: modoPresentacion !== false, exportWidth, exportHeight, dpr: exportDpr });
    return { canvas, width: exportWidth, height: exportHeight };
  }

  destroy() {
    this._destroyed = true;
    this._backgroundCtx = null;
    this._foregroundCtx = null;
    this._backgroundCanvas = null;
    this._foregroundCanvas = null;
    this.ctx = null;
    this.canvas = null;
    this.scene = null;
    this._nodeById.clear();
    this._visibleIds.clear();
    this._pathIds.clear();
    this._searchIds.clear();
    this._spatial.clear();
    this._labels.length = 0;
    this._pendingFrames = 0;
    this._nextLabels.length = 0;
    this._labelOccupied.length = 0;
    this._labelById.clear();
    this._orderedLabels.length = 0;
    this._layers = null;
  }

  _ensureGeometry(force = false) {
    if (!this.datos || this._destroyed) return;
    const order = this.preferencias.ordenCapas || this.preferencias.orden || 'auto';
    const depth = Math.max(1, Math.min(4, numero(this.preferencias.profundidadRadial, 2)));
    const mode = this.estado.modo === 'radial' ? 'radial' : 'capas';
    const focus = mode === 'radial' ? texto(this.estado.foco || this.estado.seleccion) : '';
    const signature = `${mode}|${this.viewport.width}|${this.viewport.height}|${order}|${depth}|${focus}`;
    const sameData = this.datos === this._dataIdentity;
    if (!force && sameData && this.scene && signature === this._geometrySignature) return;
    const reserva = Math.max(0, numero(this.estado.reservaPanel, this.preferencias.reservaPanel));
    const next = mode === 'radial'
      ? layoutRadial(this.datos, focus, this.viewport, { profundidad: depth, reservaPanel: reserva, estado: this.estado, mobile: this._mobile() })
      : layoutCapas(this.datos, this.viewport, { orden: order, reservaPanel: reserva });
    this.scene = next;
    this._dataIdentity = this.datos;
    this._geometrySignature = signature;
    this._nodeById = new Map(next.nodes.map((node) => [node.id, node]));
    // Distancia al foco y vecindad: los pulsos radiales y las ondas los leen cada cuadro.
    this._dist = new Map();
    this._ady = new Map();
    if (next.mode === 'radial') {
      for (const ring of next.rings || []) for (const id of ring.ids) this._dist.set(id, ring.depth);
      for (const edge of next.edges) {
        if (!this._ady.has(edge.a)) this._ady.set(edge.a, []);
        if (!this._ady.has(edge.b)) this._ady.set(edge.b, []);
        this._ady.get(edge.a).push(edge.b);
        this._ady.get(edge.b).push(edge.a);
      }
    }
    this._decorateNodes(next);
    this._buildSpatialHash(next);
    this._computeVisibility();
    this._labelById = new Map(next.labelCandidates.map((candidate) => [candidate.id, candidate]));
    this._orderedLabels = next.labelCandidates.slice();
    this._sortLabels();
    this._dirtyBackground = true;
    this._dirtyForeground = true;
  }

  _decorateNodes(scene) {
    for (const node of scene.nodes) {
      node.degree = node.grado;
      node.kind = node.fuenteVisual ? 'source' : node.supernode ? 'supernode' : 'note';
      node.path = node.path || null;
      node.paths = node.paths || null;
    }
  }

  _computeVisibility() {
    this._visibleIds.clear();
    this._pathIds.clear();
    this._searchIds.clear();
    if (!this.scene) return;
    const state = this.estado || {};
    const supplied = state.visibles || state.visible;
    const suppliedSet = supplied instanceof Set ? supplied : Array.isArray(supplied) ? new Set(supplied) : null;
    const topics = Array.isArray(state.temas) ? new Set(state.temas.map(texto)) : null;
    const layers = Array.isArray(state.capas) ? new Set(state.capas.map(Number)) : null;
    const min = state.rangoGrado ? numero(state.rangoGrado.min, 0) : 0;
    const max = state.rangoGrado && state.rangoGrado.max != null ? numero(state.rangoGrado.max, Infinity) : Infinity;
    const activity = numero(state.actividadDias, 0);
    const now = Date.now();
    for (const node of this.scene.nodes) {
      const important = nodoImportante(node.id, state);
      let visible = !node.oculto;
      if (suppliedSet) visible = suppliedSet.has(node.id) || important;
      if (topics && topics.size) visible = visible && (topics.has(node.tema) || important);
      if (layers && layers.size) visible = visible && (layers.has(node.capa) || important);
      visible = visible && (node.grado >= min && node.grado <= max || important);
      if (activity && !important) {
        const updated = node.actualizado;
        visible = visible && (updated > -Infinity && now - updated <= activity * 86400000);
      }
      if (state.soloExternas === true && !important) visible = visible && !!(node.original && node.original.enlaces && node.original.enlaces.length);
      if (Array.isArray(state.colapsados) && state.colapsados.includes(node.tema) && !important && !node.supernode) visible = false;
      if (this.scene.omitted && this.scene.omitted.has(node.id) && !important) visible = false;
      if (visible) this._visibleIds.add(node.id);
      if (estaBuscado(node, state.filtro)) this._searchIds.add(node.id);
    }
    if (Array.isArray(state.ruta)) for (const id of state.ruta) this._pathIds.add(texto(id));
    for (const ring of this.scene.rings || []) {
      if (ring.baseOmitted == null) continue;
      let restored = 0;
      for (const id of ring.ids) if (this.scene.omitted.has(id) && nodoImportante(id, state)) restored++;
      ring.omitted = ring.baseOmitted - restored;
      ring.visibleCount = ring.count - ring.omitted;
    }
  }

  _buildSpatialHash(scene) {
    this._spatial.clear();
    for (const node of scene.nodes) this._insert({ type: 'node', id: node.id }, { minX: node.x - node.radio - 2, minY: node.y - node.radio - 2, maxX: node.x + node.radio + 2, maxY: node.y + node.radio + 2 });
    for (const edge of scene.edges) {
      const a = this._nodeById.get(edge.a);
      const b = this._nodeById.get(edge.b);
      if (!a || !b) continue;
      edge.path = this._makePath(a, b, edge, false);
      edge.straightPath = this._makePath(a, b, edge, true);
      this._insert({ type: 'edge', edge }, edge.bounds);
    }
  }

  _insert(item, bounds) {
    celdas(bounds, (x, y) => {
      const key = idCelda(x, y);
      const cell = this._spatial.get(key);
      if (cell) cell.push(item);
      else this._spatial.set(key, [item]);
    });
  }
  _nodeVisible(node) {
    return !!node && this._visibleIds.has(node.id);
  }

  _candidateNode(candidate) {
    return this._nodeById.get(candidate.nodeId || candidate.id);
  }

  /** Cámara efectiva (desplazada por la reserva del inspector): la usan los pulsos y las pruebas. */
  camera() { return this._camera(); }

  _camera() {
    const source = this.estado && this.estado.camara ? this.estado.camara : { x: 0, y: 0, k: 1 };
    const k = Math.max(0.3, Math.min(6, numero(source.k, 1)));
    const reserve = Math.max(0, numero(this.estado && this.estado.reservaPanel, this.preferencias.reservaPanel));
    const mobile = this._mobile();
    return { x: numero(source.x, 0) - (mobile ? 0 : reserve / 2), y: numero(source.y, 0) - (mobile ? reserve / 2 : 0), k };
  }

  _isLowDetail(stamp) {
    if (this.preferencias.pointerDown === true || this.preferencias.wheelActive === true) return true;
    const until = this.preferencias.wheelUntil ?? this.preferencias.wheelHasta ?? this.preferencias.interaccionHasta;
    if (typeof until === 'number' && Number.isFinite(until)) return stamp < until;
    return false;
  }

  _nodeHitPadding(k) {
    return 4 / (k || 1);
  }


  _edgeVisible(edge) {
    return this._visibleIds.has(edge.a) && this._visibleIds.has(edge.b)
      && (!this.estado.soloLargoAlcance || this._layerDistance(edge.a, edge.b) >= 2);
  }

  _layerDistance(a, b) {
    const first = this._nodeById.get(a);
    const second = this._nodeById.get(b);
    return first && second ? Math.abs(first.capa - second.capa) : 0;
  }

  _prepareFrame(low) {
    if (!this.scene) return;
    const camera = this._camera();
    const reserve = Math.max(0, numero(this.estado.reservaPanel, this.preferencias.reservaPanel));
    const mobile = this._mobile();
    const right = mobile ? this.viewport.width : Math.max(0, this.viewport.width - reserve);
    const bottom = mobile ? Math.max(0, this.viewport.height - reserve) : this.viewport.height;
    this._visibleScreenBounds.minX = 0;
    this._visibleScreenBounds.minY = 0;
    this._visibleScreenBounds.maxX = right;
    this._visibleScreenBounds.maxY = bottom;
    this._placeLabels(camera, right, bottom, low, this.viewport.width);
  }

  _placeLabels(camera, right, bottom, low, width = this.viewport.width) {
    if (!this.scene) return;
    const area = width * bottom;
    const budget = this._mobile() ? Math.max(12, Math.min(40, Math.floor(area / 13000))) : Math.max(24, Math.min(96, Math.floor(area / 9000)));
    const occupied = this._labelOccupied;
    occupied.length = 0;
    const font = '12px system-ui, sans-serif';
    for (const layer of this.scene.layers || []) {
      const x = layer.x * camera.k + camera.x;
      const y = (layer.y0 - 14) * camera.k + camera.y;
      const text = layer.nombre || layer.name || String(layer.indice + 1);
      const w = this._measure(text, font) + 8;
      const rect = { x: x - 4, y: y - 14, w, h: ETIQUETA_ALTO };
      if (esRectanguloVisible(rect, 0, 0, right, bottom, 0.7)) occupied.push(rect);
    }
    const previous = this._labels;
    const placed = this._nextLabels;
    placed.length = 0;
    for (const old of previous) {
      if (placed.length >= budget) break;
      const candidate = this._labelById.get(old.id);
      if (!candidate) continue;
      const node = this._candidateNode(candidate);
      if (!node || !this._nodeVisible(node)) continue;
      const rects = this._candidateRects(candidate, node, camera);
      for (let i = 0; i < rects.count; i++) {
        if (this._tryLabel(rects.rects[i], candidate, placed, occupied, right, bottom, 0.6)) break;
      }
    }
    for (const candidate of this._orderedLabels) {
      if (placed.length >= budget) break;
      if (placed.some((item) => item.id === candidate.id)) continue;
      const node = this._candidateNode(candidate);
      if (!node || !this._nodeVisible(node)) continue;
      const rects = this._candidateRects(candidate, node, camera);
      for (let i = 0; i < rects.count; i++) {
        if (esRectanguloVisible(rects.rects[i], 0, 0, right, bottom, 0.7)
          && this._tryLabel(rects.rects[i], candidate, placed, occupied, right, bottom, 0.7)) break;
      }
    }
    placed.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x || a.id.localeCompare(b.id));
    this._labels = placed;
    this._nextLabels = previous;
    this.scene.labelPlacements = placed;
    this.scene.labelBudget = budget;
    this.scene.visibleBounds.minX = 0;
    this.scene.visibleBounds.minY = 0;
    this.scene.visibleBounds.maxX = right;
    this.scene.visibleBounds.maxY = bottom;
  }

  _tryLabel(rect, candidate, placed, occupied, right, bottom, threshold) {
    if (!esRectanguloVisible(rect, 0, 0, right, bottom, threshold)) return false;
    for (const other of occupied) if (solapan(rect, other)) return false;
    let record = placed[placed.length];
    if (!record) record = { id: '', nodeId: '', title: '', priority: 0, rect: { x: 0, y: 0, w: 0, h: ETIQUETA_ALTO } };
    record.id = candidate.id;
    record.nodeId = candidate.nodeId;
    record.title = candidate.title;
    record.priority = this._labelPriority(candidate);
    record.rect.x = rect.x;
    record.rect.y = rect.y;
    record.rect.w = rect.w;
    record.rect.h = rect.h;
    occupied.push(record.rect);
    placed.push(record);
    return true;
  }

  /** medirText() es caro; el texto de las etiquetas es estable, así que se cachea. */
  _measure(text, font) {
    const key = `${font}\u0000${text}`;
    let cache = this._measureCache;
    if (!cache) cache = this._measureCache = new Map();
    let width = cache.get(key);
    if (width === undefined) {
      width = medida(this.medirTexto, text, font);
      if (cache.size > 4000) cache.clear();
      cache.set(key, width);
    }
    return width;
  }


  _sortLabels() {
    this._orderedLabels.sort((a, b) => this._labelPriority(a) - this._labelPriority(b)
      || b.recent - a.recent || b.degree - a.degree || a.id.localeCompare(b.id));
  }

  _labelPriority(candidate) {
    const state = this.estado || {};
    if (texto(state.seleccion) === candidate.id) return 0;
    if (texto(state.sobre) === candidate.id) return 1;
    if (this._pathIds.has(candidate.id)) return 1;
    if (texto(state.foco) === candidate.id || texto(state.focoTeclado) === candidate.id || this.scene.focus === candidate.id) return 2;
    if (this._searchIds.has(candidate.id)) return 3;
    if (candidate.hub) return 4;
    if (candidate.priority === 5 || candidate.degree >= 4) return 5;
    return 6;
  }

  _candidateRects(candidate, node, camera) {
    const x = node.x * camera.k + camera.x;
    const y = node.y * camera.k + camera.y;
    const w = this._measure(candidate.title, '12px system-ui, sans-serif');
    const h = ETIQUETA_ALTO;
    const r = node.radio * camera.k + ETIQUETA_ESPACIO;
    const rects = this._rectPool;
    if (this.scene.mode === 'radial') {
      rects.rects[0].x = x + r; rects.rects[0].y = y - h / 2; rects.rects[0].w = w; rects.rects[0].h = h;
      rects.rects[1].x = x - r - w; rects.rects[1].y = y - h / 2; rects.rects[1].w = w; rects.rects[1].h = h;
      rects.rects[2].x = x + r; rects.rects[2].y = y - h - r; rects.rects[2].w = w; rects.rects[2].h = h;
      rects.rects[3].x = x + r; rects.rects[3].y = y + r; rects.rects[3].w = w; rects.rects[3].h = h;
      rects.count = 4;
    } else {
      rects.rects[0].x = x + r; rects.rects[0].y = y - h / 2; rects.rects[0].w = w; rects.rects[0].h = h;
      rects.rects[1].x = x - r - w; rects.rects[1].y = y - h / 2; rects.rects[1].w = w; rects.rects[1].h = h;
      rects.count = 2;
    }
    return rects;
  }

  _resetLayer(ctx, width, height) {
    if (!ctx) return;
    if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, width, height);
  }

  _ensureOffscreen(width, height) {
    if (this._backgroundCanvas && this._backgroundCanvas.width === width && this._backgroundCanvas.height === height) {
      if (this._backgroundCtx && this._foregroundCtx) return this._layers;
      return null;
    }
    this._backgroundCanvas = this._createCanvas();
    this._foregroundCanvas = this._createCanvas();
    if (!this._backgroundCanvas || !this._foregroundCanvas) {
      this._backgroundCtx = null;
      this._foregroundCtx = null;
      this._layers = null;
      return null;
    }
    for (const canvas of [this._backgroundCanvas, this._foregroundCanvas]) {
      canvas.width = width;
      canvas.height = height;
    }
    this._backgroundCtx = contextoSeguro(this._backgroundCanvas);
    this._foregroundCtx = contextoSeguro(this._foregroundCanvas);
    this._layers = this._backgroundCtx && this._foregroundCtx ? [this._backgroundCanvas, this._foregroundCanvas] : null;
    this._dirtyBackground = true;
    this._dirtyForeground = true;
    return this._layers;
  }

  _resizeCanvas(canvas, width, height) {
    if (!canvas) return false;
    let changed = false;
    if (canvas.width !== width) { canvas.width = width; changed = true; }
    if (canvas.height !== height) { canvas.height = height; changed = true; }
    return changed;
  }

  _composite(ctx, layers, width, height) {
    if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, width, height);
    for (const layer of layers) if (typeof ctx.drawImage === 'function') ctx.drawImage(layer, 0, 0);
  }

  _drawScene(ctx, options) {
    if (!ctx || !this.scene) return;
    const width = options.exportWidth || this.viewport.width;
    const height = options.exportHeight || this.viewport.height;
    const dpr = options.dpr || this.viewport.dpr;
    const camera = this._camera();
    if (typeof ctx.setTransform === 'function') ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (options.direct) {
      this._drawBackground(ctx, width, height, camera, options);
      this._drawForeground(ctx, width, height, camera, options);
    } else if (options.background) this._drawBackground(ctx, width, height, camera, options);
    else this._drawForeground(ctx, width, height, camera, options);
  }

  _drawBackground(ctx, width, height, camera, options) {
    const fill = this.paleta.bg || PALETA_BASE.bg;
    if (typeof ctx.fillStyle !== 'undefined') ctx.fillStyle = fill;
    if (typeof ctx.fillRect === 'function') ctx.fillRect(0, 0, width, height);
    if (typeof ctx.save === 'function') ctx.save();
    if (typeof ctx.translate === 'function') ctx.translate(camera.x, camera.y);
    if (typeof ctx.scale === 'function') ctx.scale(camera.k, camera.k);
    if (this._edgeDashK !== camera.k) {
      this._edgeDash[0] = 5 / camera.k;
      this._edgeDash[1] = 4 / camera.k;
      this._edgeDashK = camera.k;
    }
    const sobre = texto(this.estado.sobre);
    for (const edge of this.scene.edges) {
      if (!this._edgeVisible(edge)) continue;
      if (!this._boundsOnScreen(edge.bounds, camera, width, height)) continue;
      const a = this._nodeById.get(edge.a);
      const b = this._nodeById.get(edge.b);
      const encima = !!sobre && (edge.a === sobre || edge.b === sobre);
      if (ctx.strokeStyle !== undefined) ctx.strokeStyle = this._edgeColor(edge);
      if (ctx.lineWidth !== undefined) ctx.lineWidth = (encima ? 1.6 : 1.25) / camera.k;
      if (ctx.setLineDash) ctx.setLineDash(edge.motivo ? DASH_VACIO : this._edgeDash);
      this._strokeEdge(ctx, edge, a, b, options.low);
    }
    if (ctx.setLineDash) ctx.setLineDash(DASH_VACIO);
    if (typeof ctx.restore === 'function') ctx.restore();
  }

  _drawForeground(ctx, width, height, camera) {
    if (this.scene.mode === 'capas' && typeof ctx.strokeStyle !== 'undefined') ctx.strokeStyle = this.paleta.grid;
    if (typeof ctx.font !== 'undefined') ctx.font = '12px system-ui, sans-serif';
    for (const layer of this.scene.layers || []) {
      const x = layer.x * camera.k + camera.x;
      const y0 = layer.y0 * camera.k + camera.y;
      const y1 = layer.y1 * camera.k + camera.y;
      if (typeof ctx.strokeRect === 'function') ctx.strokeRect(x - 14, y0, 28, Math.max(0, y1 - y0));
      if (typeof ctx.fillStyle !== 'undefined') ctx.fillStyle = this.paleta.text;
      if (typeof ctx.fillText === 'function') ctx.fillText(layer.nombre || layer.name || '', x + 14, y0 - 12);
    }
    const bounds = this._nodeBoundsScratch;
    for (const node of this.scene.nodes) {
      if (!this._nodeVisible(node)) continue;
      bounds.minX = node.x - node.radio;
      bounds.minY = node.y - node.radio;
      bounds.maxX = node.x + node.radio;
      bounds.maxY = node.y + node.radio;
      if (!this._boundsOnScreen(bounds, camera, width, height)) continue;
      this._drawNode(ctx, node, camera);
    }
    for (const label of this._labels) {
      if (typeof ctx.strokeStyle !== 'undefined') ctx.strokeStyle = this.paleta.labelHalo;
      if (ctx.lineWidth !== undefined) ctx.lineWidth = 3;
      if (typeof ctx.strokeText === 'function') ctx.strokeText(label.title, label.rect.x, label.rect.y + 13);
      if (ctx.fillStyle !== undefined) ctx.fillStyle = this.paleta.text;
      if (typeof ctx.fillText === 'function') ctx.fillText(label.title, label.rect.x, label.rect.y + 13);
    }
    this._drawIndicators(ctx, camera);
  }

  _drawNode(ctx, node, camera) {
    const x = node.x * camera.k + camera.x;
    const y = node.y * camera.k + camera.y;
    const r = node.radio * camera.k;
    const color = this._nodeColor(node);
    if (ctx.fillStyle !== undefined) ctx.fillStyle = color;
    if (typeof ctx.beginPath === 'function') ctx.beginPath();
    if (node.fuenteVisual) {
      if (typeof ctx.moveTo === 'function') ctx.moveTo(x, y - r);
      if (typeof ctx.lineTo === 'function') ctx.lineTo(x + r, y);
      if (typeof ctx.lineTo === 'function') ctx.lineTo(x, y + r);
      if (typeof ctx.lineTo === 'function') ctx.lineTo(x - r, y);
      if (typeof ctx.closePath === 'function') ctx.closePath();
    } else if (typeof ctx.arc === 'function') ctx.arc(x, y, r, 0, TAU);
    if (typeof ctx.fill === 'function') ctx.fill();
    const unhealthy = esSaludable(node, this.estado);
    if (node.supernode || unhealthy) {
      if (ctx.strokeStyle !== undefined) ctx.strokeStyle = this.paleta.text;
      if (ctx.lineWidth !== undefined) ctx.lineWidth = 1.5;
      if (unhealthy && ctx.setLineDash) ctx.setLineDash(DASH_SALUD);
      if (typeof ctx.beginPath === 'function') ctx.beginPath();
      if (typeof ctx.arc === 'function') ctx.arc(x, y, r + 4, 0, TAU);
      if (typeof ctx.stroke === 'function') ctx.stroke();
      if (unhealthy && ctx.setLineDash) ctx.setLineDash(DASH_VACIO);
    }
    if (texto(this.estado.sobre) === node.id) {
      if (ctx.strokeStyle !== undefined) ctx.strokeStyle = this.paleta.accent;
      if (ctx.lineWidth !== undefined) ctx.lineWidth = 1.5;
      if (typeof ctx.beginPath === 'function') ctx.beginPath();
      if (typeof ctx.arc === 'function') ctx.arc(x, y, r + 6, 0, TAU);
      if (typeof ctx.stroke === 'function') ctx.stroke();
    }
    if (this._pathIds.has(node.id) || texto(this.estado.seleccion) === node.id) {
      if (ctx.strokeStyle !== undefined) ctx.strokeStyle = this.paleta.accent;
      if (ctx.lineWidth !== undefined) ctx.lineWidth = 2;
      if (typeof ctx.beginPath === 'function') ctx.beginPath();
      if (typeof ctx.arc === 'function') ctx.arc(x, y, r + 7, 0, TAU);
      if (typeof ctx.stroke === 'function') ctx.stroke();
    }
  }

  _drawIndicators(ctx, camera) {
    if (this.scene.mode !== 'radial' || !this.scene.rings) return;
    const center = this._nodeById.get(this.scene.focus);
    if (!center) return;
    for (const ring of this.scene.rings) {
      if (!ring.depth) continue;
      const x = center.x * camera.k + camera.x;
      const y = (center.y - ring.radio) * camera.k + camera.y;
      // [1.33] Traducido (decía «salto» también en inglés): el rótulo del anillo con su cuenta.
      if (typeof ctx.fillText === 'function') {
        ctx.fillStyle = this.paleta.muted;
        ctx.fillText(`${T('{0} salto(s)', ring.depth)} · ${ring.count}`, x + 6, y - 8);
        if (ring.omitted) {
          ctx.fillStyle = this.paleta.warning;
          ctx.fillText(`+${ring.omitted}`, x + 6, y + 6);
        }
      }
    }
  }

  _strokeEdge(ctx, edge, a, b, low) {
    if (low) {
      if (edge.straightPath && typeof ctx.stroke === 'function') { ctx.stroke(edge.straightPath); return; }
      if (typeof ctx.beginPath === 'function') ctx.beginPath();
      if (typeof ctx.moveTo === 'function') ctx.moveTo(a.x, a.y);
      if (typeof ctx.lineTo === 'function') ctx.lineTo(b.x, b.y);
      if (typeof ctx.stroke === 'function') ctx.stroke();
      return;
    }
    if (edge.path && typeof ctx.stroke === 'function') { ctx.stroke(edge.path); return; }
    if (typeof ctx.beginPath === 'function') ctx.beginPath();
    if (typeof ctx.moveTo === 'function') ctx.moveTo(a.x, a.y);
    if (typeof ctx.bezierCurveTo === 'function') ctx.bezierCurveTo(edge.c1x, edge.c1y, edge.c2x, edge.c2y, b.x, b.y);
    else if (typeof ctx.lineTo === 'function') ctx.lineTo(b.x, b.y);
    if (typeof ctx.stroke === 'function') ctx.stroke();
  }

  _makePath(a, b, edge, straight = false) {
    if (!this._Path2D || typeof this._Path2D !== 'function') return null;
    try {
      const path = new this._Path2D();
      path.moveTo(a.x, a.y);
      if (straight || typeof path.bezierCurveTo !== 'function') path.lineTo(b.x, b.y);
      else path.bezierCurveTo(edge.c1x, edge.c1y, edge.c2x, edge.c2y, b.x, b.y);
      return path;
    } catch { return null; }
  }

  _boundsOnScreen(bounds, camera, width, height) {
    const right = this._visibleScreenBounds ? this._visibleScreenBounds.maxX : width;
    const bottom = this._visibleScreenBounds ? this._visibleScreenBounds.maxY : height;
    const minWorldX = (0 - camera.x) / camera.k;
    const maxWorldX = (right - camera.x) / camera.k;
    const minWorldY = (0 - camera.y) / camera.k;
    const maxWorldY = (bottom - camera.y) / camera.k;
    const pad = 8 / camera.k;
    return bounds.maxX >= minWorldX - pad && bounds.minX <= maxWorldX + pad
      && bounds.maxY >= minWorldY - pad && bounds.minY <= maxWorldY + pad;
  }

  _edgeColor(edge) {
    if (this.estado.salud && !edge.motivo) return this.paleta.danger;
    if (this._pathIds.has(edge.a) || this._pathIds.has(edge.b)) return this.paleta.accent;
    const sobre = texto(this.estado.sobre);
    if (sobre && (edge.a === sobre || edge.b === sobre)) return this.paleta.accent;
    return this.paleta.edge;
  }

  _nodeColor(node) {
    const topic = this.datos && this.datos.temas && node.tema && this.datos.temas[node.tema];
    if (Array.isArray(topic) && topic[1]) return topic[1];
    if (topic && topic.color) return topic.color;
    return node.fuenteVisual ? this.paleta.source : node.supernode ? this.paleta.accent : this.paleta.node;
  }

  _mobile() {
    return this.preferencias.mobile === true || this.viewport.width < 640;
  }

  _createCanvas() {
    const factory = this.preferencias.crearCanvas || this.preferencias.createCanvas;
    if (typeof factory === 'function') {
      try { return factory(); } catch { return null; }
    }
    const ownerDocument = this.canvas && this.canvas.ownerDocument;
    if (ownerDocument && typeof ownerDocument.createElement === 'function') {
      try { return ownerDocument.createElement('canvas'); } catch { return null; }
    }
    if (typeof document !== 'undefined' && document && typeof document.createElement === 'function') {
      try { return document.createElement('canvas'); } catch { return null; }
    }
    return null;
  }
}
