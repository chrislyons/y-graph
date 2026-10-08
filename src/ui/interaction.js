import { T } from '../i18n.js';
import { aplicarFiltros, normalizarEstado } from '../view/state.js';

function value(value, fallback = '') { return value == null ? fallback : String(value); }
function nodeId(node) { return value(node && node.id || node && node.ruta); }
function nodesOf(data) {
  if (!data) return [];
  if (Array.isArray(data.nodos)) return data.nodos.filter(Boolean);
  return data.nodos && typeof data.nodos === 'object' ? Object.values(data.nodos).filter(Boolean) : [];
}
function edgesOf(data) { return data && Array.isArray(data.aristas) ? data.aristas.filter(Boolean) : []; }
function edgePart(edge, index) {
  if (Array.isArray(edge)) return edge[index];
  if (!edge) return undefined;
  return [edge.a, edge.b, edge.motivo, edge.frase, edge.linea][index];
}
function makeElement(doc, tag) {
  if (doc && typeof doc.createElement === 'function') return doc.createElement(tag);
  return {
    tagName: String(tag).toUpperCase(), children: [], attributes: {}, style: {},
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    insertBefore(child, before) { const index = this.children.indexOf(before); this.children.splice(index < 0 ? 0 : index, 0, child); child.parentNode = this; return child; },
    setAttribute(name, val) { this.attributes[name] = value(val); }, getAttribute(name) { return this.attributes[name] || null; },
    addEventListener() {}, removeEventListener() {}, focus() { this.focused = true; }, contains() { return false; },
    get firstChild() { return this.children[0] || null; }, getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
  };
}
function append(parent, child) { if (parent && typeof parent.appendChild === 'function') parent.appendChild(child); else if (parent && Array.isArray(parent.children)) parent.children.push(child); return child; }
function clear(node) {
  if (!node) return;
  if (typeof node.empty === 'function') node.empty();
  else if (typeof node.replaceChildren === 'function') node.replaceChildren();
  else if (node.innerHTML != null) node.innerHTML = '';
  else if (Array.isArray(node.children)) node.children.length = 0;
}
function eventKey(event) { return value(event && (event.key || event.code)).toLowerCase(); }
function point(event, element) {
  const rect = element && typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : { left: 0, top: 0 };
  return { x: Number(event && (event.clientX != null ? event.clientX : event.pageX)) - Number(rect.left || 0), y: Number(event && (event.clientY != null ? event.clientY : event.pageY)) - Number(rect.top || 0) };
}
function clamp(valueNumber, min, max) { return Math.max(min, Math.min(max, valueNumber)); }

/** DOM controller for pointer, keyboard, and assistive graph interaction. */
export class InteractionController {
  constructor(canvasOrOptions, rendererOrUndefined, optionsOrUndefined) {
    const options = canvasOrOptions && canvasOrOptions.canvas
      ? canvasOrOptions
      : { ...(optionsOrUndefined || {}), canvas: canvasOrOptions, renderer: rendererOrUndefined };
    this.canvas = options.canvas || null;
    this.renderer = options.renderer || null;
    this.document = options.document || (this.canvas && this.canvas.ownerDocument) || (typeof document !== 'undefined' ? document : null);
    this.parent = options.parent || (this.canvas && this.canvas.parentNode) || null;
    this.onSelect = options.onSelect || null;
    this.onOpen = options.onOpen || null;
    this.onCenter = options.onCenter || null;
    this.onFit = options.onFit || null;
    this.onSearch = options.onSearch || null;
    this.onHover = options.onHover || null;
    this.onPan = options.onPan || null;
    this.onZoom = options.onZoom || null;
    this.onLongPress = options.onLongPress || null;
    this.longPressMs = Number(options.longPressMs) || 500;
    this.datos = options.datos || null;
    this.estado = normalizarEstado(options.estado || {}, { datos: this.datos });
    this.searchInput = options.searchInput || null;
    this.group = options.group || null;
    this.listbox = null;
    this.live = null;
    this.searchResults = null;
    this.searchOptions = [];
    this.searchIndex = -1;
    this._listeners = [];
    this._pointers = new Map();
    this._gesture = null;
    this._longPressTimer = null;
    this._active = null;
    this._destroyed = false;
    this._buildSemantics();
    this._bind();
    this.setGraph(this.datos, this.estado);
  }

  _buildSemantics() {
    if (!this.canvas) return;
    const doc = this.document;
    if (!this.group) {
      this.group = makeElement(doc, 'div');
      if (this.parent && typeof this.parent.insertBefore === 'function') this.parent.insertBefore(this.group, this.canvas);
      else if (this.parent && typeof this.parent.appendChild === 'function') this.parent.appendChild(this.group);
      append(this.group, this.canvas);
    }
    this.group.setAttribute('role', 'group');
    this.group.setAttribute('aria-label', T('Explorador del grafo'));
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('aria-label', T('Explorador del grafo'));
    this.canvas.setAttribute('role', 'img');
    this.live = makeElement(doc, 'div');
    this.live.setAttribute('aria-live', 'polite');
    this.live.setAttribute('aria-atomic', 'true');
    this.live.id = 'why-graph-live-' + Math.random().toString(36).slice(2);
    this.fallback = makeElement(doc, 'p');
    this.fallback.id = 'why-graph-fallback';
    this.fallback.textContent = T('Por favor, usa el mapa de datos para consultar el grafo');
    this.canvas.setAttribute('aria-describedby', `${this.live.id} ${this.fallback.id} why-graph-table-nodes why-graph-table-edges`);
    append(this.group || this.parent, this.fallback);
    append(this.group || this.parent, this.live);
    this.listbox = makeElement(doc, 'ul');
    this.listbox.setAttribute('role', 'listbox');
    this.listbox.setAttribute('aria-label', T('Nodos visibles'));
    this.listbox.id = 'why-graph-nodes-' + Math.random().toString(36).slice(2);
    append(this.group || this.parent, this.listbox);
    if (!this.searchInput) {
      this.searchInput = makeElement(doc, 'input');
      this.searchInput.setAttribute('type', 'search');
      this.searchInput.setAttribute('aria-label', T('Buscar en el grafo'));
      this.searchInput.setAttribute('role', 'combobox');
      append(this.group || this.parent, this.searchInput);
    } else { this.searchInput.setAttribute('aria-label', T('Buscar en el grafo')); this.searchInput.setAttribute('role', 'combobox'); this.searchInput.setAttribute('aria-autocomplete', 'list'); }
    this.searchResults = makeElement(doc, 'ul');
    this.searchResults.setAttribute('role', 'listbox');
    this.searchResults.setAttribute('aria-label', T('Resultados de búsqueda'));
    this.searchResults.id = 'why-graph-search-' + Math.random().toString(36).slice(2);
    this.searchInput.setAttribute('aria-controls', this.searchResults.id);
    append(this.group || this.parent, this.searchResults);
  }

  _listen(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler, options);
    this._listeners.push([target, type, handler, options]);
  }

  _bind() {
    this._listen(this.canvas, 'pointerdown', (e) => this._pointerDown(e));
    this._listen(this.canvas, 'pointermove', (e) => this._pointerMove(e));
    this._listen(this.canvas, 'pointerleave', () => this._hoverClear());
    this._listen(this.canvas, 'pointerup', (e) => this._pointerUp(e));
    this._listen(this.canvas, 'pointercancel', (e) => this._pointerCancel(e));
    this._listen(this.canvas, 'wheel', (e) => this._wheel(e), { passive: false });
    this._listen(this.canvas, 'keydown', (e) => this._key(e));
    this._listen(this.searchInput, 'input', (e) => this._search(value(e && e.target && e.target.value)));
    this._listen(this.searchInput, 'keydown', (e) => this._searchKey(e));
  }

  setGraph(datos, estado = this.estado) {
    this.datos = datos || { nodos: [], aristas: [] };
    this.estado = normalizarEstado(estado || {}, { datos: this.datos });
    if (this.renderer && typeof this.renderer.setGraph === 'function') this.renderer.setGraph(this.datos, this.estado);
    this._refreshNodes();
    return this;
  }

  setState(estado) { return this.setGraph(this.datos, { ...this.estado, ...(estado || {}) }); }
  getState() { return this.estado; }
  getNodeOrder() { return this._order.map((id) => id); }
  getStableNodeOrder() { return this.getNodeOrder(); }
  get stableNodeOrder() { return this.getNodeOrder(); }

  _filtered() {
    const result = aplicarFiltros(this.datos || { nodos: [], aristas: [] }, this.estado);
    return result.visibles instanceof Set ? result.visibles : new Set(result.visibles || []);
  }

  _stableOrder() {
    const byId = new Map(nodesOf(this.datos).map((node) => [nodeId(node), node]));
    const ady = new Map([...byId.keys()].map((id) => [id, 0]));
    for (const edge of edgesOf(this.datos)) {
      const a = value(edgePart(edge, 0)), b = value(edgePart(edge, 1));
      if (ady.has(a) && ady.has(b)) { ady.set(a, ady.get(a) + 1); ady.set(b, ady.get(b) + 1); }
    }
    return [...byId.entries()].filter(([id]) => this._visible().has(id)).sort(([a, na], [b, nb]) =>
      (Number(na.capa) || 0) - (Number(nb.capa) || 0) || value(na.tema).localeCompare(value(nb.tema), undefined, { numeric: true, sensitivity: 'base' }) || ady.get(b) - ady.get(a) || a.localeCompare(b)).map(([id]) => id);
  }

  _visible() { if (!this._visibleIds) this._visibleIds = this._filtered(); return this._visibleIds; }
  _refreshNodes() {
    this._visibleIds = this._filtered();
    this._order = this._stableOrder();
    if (!this._order.includes(this._active)) { const selected = value(this.estado.seleccion); this._active = this._order.includes(selected) ? selected : this._order[0] || null; }
    clear(this.listbox);
    for (const id of this._order) {
      const item = makeElement(this.document, 'li');
      const node = nodesOf(this.datos).find((n) => nodeId(n) === id) || { id };
      item.id = this.listbox.id + '-' + id.replace(/[^A-Za-z0-9_-]/g, '-');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', id === this._active ? 'true' : 'false');
      item.textContent = value(node.titulo || id);
      this._listen(item, 'click', () => this.select(id, 'nodo'));
      append(this.listbox, item);
    }
    this._setActive(this._active, false);
    this._announce();
    this._updateSearch();
  }


  _setActive(id, announce = true) {
    if (!this.listbox) return;
    this._active = id || null;
    this.listbox.setAttribute('aria-activedescendant', this._active ? this.listbox.id + '-' + this._active.replace(/[^A-Za-z0-9_-]/g, '-') : '');
    for (const child of this.listbox.children || []) child.setAttribute('aria-selected', child.id === this.listbox.getAttribute('aria-activedescendant') ? 'true' : 'false');
    if (announce) this._announce();
  }

  select(id, tipo = 'nodo', hit = null) {
    this.estado.seleccion = value(id);
    if (tipo === 'nodo') this._setActive(id, false);
    this._announce();
    if (this.renderer && typeof this.renderer.setGraph === 'function') this.renderer.setGraph(this.datos, this.estado);
    if (typeof this.onSelect === 'function') this.onSelect(value(id), tipo, hit);
  }

  _announce() {
    if (!this.live || !this._active) { if (this.live) this.live.textContent = ''; return; }
    const node = nodesOf(this.datos).find((n) => nodeId(n) === this._active);
    if (!node) return;
    let reasons = 0;
    for (const edge of edgesOf(this.datos)) {
      if ((value(edgePart(edge, 0)) === this._active || value(edgePart(edge, 1)) === this._active) && value(edgePart(edge, 2))) reasons++;
    }
    this.live.textContent = T('Nodo seleccionado: {0}, capa {1}, tema {2}, grado {3}, motivos {4}', value(node.titulo || node.id), Number(node.capa) + 1, value(node.tema) || T('sin tema'), Number(node.grado) || 0, reasons);
  }

  _pointerDown(event) {
    if (this._destroyed) return;
    const pointerId = event && event.pointerId != null ? event.pointerId : 0;
    const p = point(event, this.canvas);
    this._pointers.set(pointerId, p);
    if (this._pointers.size === 1) {
      this._gesture = { id: pointerId, start: p, last: p, moved: false };
      const timerHost = typeof window !== 'undefined' ? window : null;
      this._longPressTimer = (timerHost ? timerHost.setTimeout.bind(timerHost) : setTimeout)(() => {
        if (this._gesture && !this._gesture.moved) {
          const hit = this.renderer && typeof this.renderer.hitTest === 'function' ? this.renderer.hitTest(p.x, p.y) : null;
          if (hit && typeof this.onLongPress === 'function') this.onLongPress(hit.id, hit.tipo);
        }
      }, this.longPressMs);
    } else if (this._pointers.size === 2) this._gesture = { pinch: true, distance: this._pinchDistance() };
  }

  _pointerMove(event) {
    if (!this._gesture) { this._hover(event); return; }
    const p = point(event, this.canvas);
    const pointerId = event && event.pointerId != null ? event.pointerId : 0;
    if (this._pointers.has(pointerId)) this._pointers.set(pointerId, p);
    if (this._gesture.pinch) {
      const next = this._pinchDistance();
      if (this._gesture.distance > 0 && next > 0) this._zoom(next / this._gesture.distance);
      this._gesture.distance = next;
      return;
    }
    const g = this._gesture;
    const dx = p.x - g.last.x, dy = p.y - g.last.y;
    if (Math.hypot(p.x - g.start.x, p.y - g.start.y) > 4) { g.moved = true; this._clearLongPress(); }
    g.last = p;
    this.estado.camara.x += dx; this.estado.camara.y += dy;
    this._renderCamera();
    if (typeof this.onPan === 'function') this.onPan({ dx, dy, camera: this.estado.camara });
  }

  /** Resalta el nodo bajo el cursor del ratón (solo mouse, sin gesto activo). */
  _hover(event) {
    if (this._destroyed || !this.canvas) return;
    if (event && event.pointerType && event.pointerType !== 'mouse') return;
    const p = point(event, this.canvas);
    const hit = this.renderer && typeof this.renderer.hitTest === 'function' ? this.renderer.hitTest(p.x, p.y) : null;
    this._applyHover(hit && hit.tipo === 'nodo' ? hit.id : null);
  }

  _hoverClear() { this._applyHover(null); }

  _applyHover(id) {
    const next = id == null || id === '' ? null : String(id);
    if ((this.estado.sobre || null) === next) return;
    this.estado.sobre = next;
    if (this.canvas && this.canvas.classList && typeof this.canvas.classList.toggle === 'function') this.canvas.classList.toggle('mn-sobre-nodo', !!next);
    if (typeof this.onHover === 'function') this.onHover(next);
    else this._render();
  }

  _pointerUp(event) {
    const pointerId = event && event.pointerId != null ? event.pointerId : 0;
    const p = this._pointers.get(pointerId) || point(event, this.canvas);
    this._pointers.delete(pointerId);
    this._clearLongPress();
    if (this._pointers.size) { if (this._pointers.size === 1) this._gesture = { start: [...this._pointers.values()][0], last: [...this._pointers.values()][0], moved: true }; return; }
    const g = this._gesture; this._gesture = null;
    if (!g || g.moved) return;
    const hit = this.renderer && typeof this.renderer.hitTest === 'function' ? this.renderer.hitTest(p.x, p.y) : null;
    if (hit) this.select(hit.id, hit.tipo, hit);
  }

  _pointerCancel() { this._pointers.clear(); this._gesture = null; this._clearLongPress(); }
  _clearLongPress() { const timerHost = typeof window !== 'undefined' ? window : null; if (timerHost) timerHost.clearTimeout(this._longPressTimer); this._longPressTimer = null; }
  _pinchDistance() { const p = [...this._pointers.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }

  _wheel(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const delta = Number(event && event.deltaY) || 0;
    this._zoom(delta < 0 ? 1.1 : 1 / 1.1);
  }

  _zoom(factor) {
    const camera = this.estado.camara;
    camera.k = clamp(camera.k * factor, 0.3, 6);
    this._renderCamera();
    if (typeof this.onZoom === 'function') this.onZoom(camera.k);
  }

  _render() { if (this.renderer && typeof this.renderer.setGraph === 'function') this.renderer.setGraph(this.datos, this.estado); if (this.renderer && typeof this.renderer.invalidate === 'function') this.renderer.invalidate(); }

  /** Pan/zoom de teclado o puntero: la cámara no cambia visibilidad ni prioridades. */
  _renderCamera() {
    if (!this.renderer) return;
    if (typeof this.renderer.setCamera === 'function') { this.renderer.setCamera(this.estado); return; }
    if (typeof this.renderer.setGraph === 'function') this.renderer.setGraph(this.datos, this.estado);
    if (typeof this.renderer.invalidate === 'function') this.renderer.invalidate();
  }

  _key(event) {
    const key = eventKey(event);
    if (key === 'tab') return;
    const handled = ['j', 'k', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '=', '-', 'f', 'enter', ' ', '/', 'escape'];
    if (!handled.includes(key)) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (key === 'j' || key === 'k') {
      const index = this._order.indexOf(this._active);
      const next = this._order[(index + (key === 'j' ? 1 : -1) + this._order.length) % this._order.length];
      if (next) this.select(next, 'nodo');
    } else if (key.startsWith('arrow')) {
      const step = event.shiftKey ? 240 : 80;
      if (key === 'arrowleft') this.estado.camara.x -= step;
      if (key === 'arrowright') this.estado.camara.x += step;
      if (key === 'arrowup') this.estado.camara.y -= step;
      if (key === 'arrowdown') this.estado.camara.y += step;
      this._renderCamera();
    } else if (key === '+' || key === '=') this._zoom(1.2);
    else if (key === '-') this._zoom(1 / 1.2);
    else if (key === 'f') { if (typeof this.onFit === 'function') this.onFit(); else { this.estado.camara = { x: 0, y: 0, k: 1 }; this._renderCamera(); } }
    else if (key === 'enter' && this._active) { if (typeof this.onOpen === 'function') this.onOpen(this._active, 'nodo'); }
    else if (key === ' ' && this._active) { if (typeof this.onCenter === 'function') this.onCenter(this._active); }
    else if (key === '/' && this.searchInput) { if (typeof this.searchInput.focus === 'function') this.searchInput.focus(); }
    else if (key === 'escape') {
      if (this.estado.ruta && this.estado.ruta.length) { this.estado.ruta = []; this._render(); }
      else { this.estado.seleccion = null; this._active = null; this._setActive(null); this._render(); }
      if (this.searchInput) this.searchInput.value = '';
      this._updateSearch();
    }
  }

  _search(query) {
    this.estado.filtro = value(query);
    this._visibleIds = this._filtered();
    this._refreshNodes();
    if (typeof this.onSearch === 'function') this.onSearch(this.estado.filtro);
  }

  _updateSearch() {
    if (!this.searchResults) return;
    clear(this.searchResults);
    this.searchOptions = [];
    const q = this.estado.filtro.trim().toLocaleLowerCase();
    const results = q ? this._order.filter((id) => {
      const n = nodesOf(this.datos).find((node) => nodeId(node) === id) || {};
      return value(n.titulo || id).toLocaleLowerCase().includes(q) || value(n.tema).toLocaleLowerCase().includes(q);
    }) : [];
    for (const id of results) {
      const option = makeElement(this.document, 'li');
      const node = nodesOf(this.datos).find((n) => nodeId(n) === id) || {};
      option.id = this.searchResults.id + '-' + id.replace(/[^A-Za-z0-9_-]/g, '-');
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.textContent = value(node.titulo || id);
      this._listen(option, 'click', () => this.select(id, 'nodo'));
      append(this.searchResults, option);
      this.searchOptions.push(id);
    }
    if (!results.length) { const empty = makeElement(this.document, 'li'); empty.textContent = T('Ningún resultado'); append(this.searchResults, empty); }
    this.searchIndex = -1;
    this.searchResults.setAttribute('aria-activedescendant', '');
    this.searchInput.setAttribute('aria-activedescendant', '');
  }

  _searchKey(event) {
    const key = eventKey(event);
    if (key === 'arrowdown' || key === 'arrowup') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (!this.searchOptions.length) return;
      this.searchIndex = (this.searchIndex + (key === 'arrowdown' ? 1 : -1) + this.searchOptions.length) % this.searchOptions.length;
      const id = this.searchOptions[this.searchIndex];
      this.searchResults.setAttribute('aria-activedescendant', this.searchResults.id + '-' + id.replace(/[^A-Za-z0-9_-]/g, '-'));
      const optionId = this.searchResults.id + '-' + id.replace(/[^A-Za-z0-9_-]/g, '-');
      this.searchResults.setAttribute('aria-activedescendant', optionId);
      this.searchInput.setAttribute('aria-activedescendant', optionId);
      for (const option of this.searchResults.children || []) option.setAttribute('aria-selected', option.id === optionId ? 'true' : 'false');
    } else if (key === 'enter' && this.searchIndex >= 0) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      const id = this.searchOptions[this.searchIndex];
      this.select(id, 'nodo');
      const optionId = this.searchResults.id + '-' + id.replace(/[^A-Za-z0-9_-]/g, '-');
      this.searchResults.setAttribute('aria-activedescendant', optionId);
      this.searchInput.setAttribute('aria-activedescendant', optionId);
    } else if (key === 'escape') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      this.searchInput.value = ''; this.estado.filtro = ''; this._updateSearch();
      if (typeof this.searchInput.focus === 'function') this.searchInput.focus();
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._clearLongPress();
    for (const [target, type, handler, options] of this._listeners.splice(0)) if (typeof target.removeEventListener === 'function') target.removeEventListener(type, handler, options);
    this._pointers.clear();
    this._gesture = null;
    if (this.renderer && typeof this.renderer.destroy === 'function') this.renderer.destroy();
  }
}

export function createInteractionController(canvas, renderer, options) { return new InteractionController(canvas, renderer, options); }
