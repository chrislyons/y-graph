import { T } from '../i18n.js';
import { metricas, diagnosticos, vacios } from '../model/analysis.js';
import { aplicarFiltros, normalizarEstado } from '../view/state.js';
import { renderTablaGrafo } from '../view/table.js';

function text(value) { return value == null ? '' : String(value); }
function docFor(container, document) { return document || container?.ownerDocument || (typeof globalThis !== 'undefined' && globalThis.document) || null; }
function el(document, tag) {
  if (document?.createElement) return document.createElement(tag);
  return {
    tagName: String(tag).toUpperCase(), children: [], attributes: {}, style: {}, value: '', hidden: false, disabled: false,
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }, removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); },
    setAttribute(name, value) { this.attributes[name] = text(value); }, getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener() {}, removeEventListener() {}, focus() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 380, height: 600 }; },
  };
}
function add(parent, child) { parent.appendChild(child); return child; }
function clear(node) { if (node.replaceChildren) node.replaceChildren(); else if (node.innerHTML != null) node.innerHTML = ''; else if (Array.isArray(node.children)) node.children.length = 0; }
function nodesOf(datos) { return Array.isArray(datos?.nodos) ? datos.nodos.filter(Boolean) : Object.values(datos?.nodos || {}); }
function edgeParts(edge) { return Array.isArray(edge) ? edge : [edge?.a, edge?.b, edge?.motivo, edge?.frase, edge?.linea]; }
function edgeId(a, b) { return JSON.stringify([text(a), text(b)].sort()); }
function phrase(value) { return typeof value === 'string' ? value : text(value?.texto || value?.frase || value?.valor); }
function line(value) { return text(value && typeof value === 'object' ? value.linea : value); }
function topic(datos, id) { const value = datos?.temas?.[id]; return text(Array.isArray(value) ? value[0] : value?.nombre || value || id); }
function layer(datos, index) { const value = datos?.capas?.[index]; return text(Array.isArray(value) ? value[1] || value[0] : value?.nombre || value || index + 1); }
function status(node) { if (node.fuente) return T('Fuente'); if (node.hub || node.agrupados) return T('Supernodo'); if (node.salud || node.rota || Number(node.sinMotivo) > 0) return T('Con problemas'); return T('Nota'); }
function action(document, label, callback, className = '') { const node = el(document, 'button'); node.type = 'button'; node.textContent = label; node.setAttribute('aria-label', label); node.className = `mn-inspector-action ${className}`.trim(); if (callback) node.addEventListener('click', callback); return node; }

/** Shell semántico del inspector de escritorio y del bottom sheet móvil. */
export class InspectorController {
  constructor(options = {}) {
    this.container = options.container || null;
    this.document = docFor(this.container, options.document);
    this.datos = options.datos || { nodos: [], aristas: [], capas: [], temas: {} };
    this.estado = normalizarEstado(options.state || {}, { datos: this.datos });
    this.selectionType = options.selectionType === 'arista' ? 'arista' : 'nodo';
    this.callbacks = options.callbacks || options;
    this.mobile = !!options.mobile;
    this.listeners = [];
    this._build();
    this.setMobile(this.mobile);
    this.update(this.datos, this.estado, options);
  }

  _listen(target, type, handler) { if (typeof target?.addEventListener === 'function') { target.addEventListener(type, handler); this.listeners.push([target, type, handler]); } }
  _call(name, ...args) { if (typeof this.callbacks[name] === 'function') this.callbacks[name](...args); }
  _build() {
    const document = this.document;
    this.element = add(this.container || el(document, 'div'), el(document, 'aside'));
    this.element.className = 'mn-workbench-inspector';
    this.element.setAttribute('role', 'complementary');
    this.element.setAttribute('aria-label', T('Inspector del mapa'));
    this.resizer = add(this.element, el(document, 'div'));
    this.resizer.className = 'mn-inspector-resizer'; this.resizer.setAttribute('role', 'separator'); this.resizer.setAttribute('tabindex', '0');
    this.resizer.setAttribute('aria-orientation', 'vertical'); this.resizer.setAttribute('aria-valuemin', '320'); this.resizer.setAttribute('aria-valuemax', '560'); this.resizer.setAttribute('aria-label', T('Cambiar ancho del inspector'));
    this.header = add(this.element, el(document, 'header')); this.header.className = 'mn-inspector-header';
    this.title = add(this.header, el(document, 'h2'));
    this.close = add(this.header, action(document, T('Cerrar'), () => this._call('onClose')));
    this.content = add(this.element, el(document, 'div')); this.content.className = 'mn-inspector-content';
    this.tableRegion = add(this.element, el(document, 'div')); this.tableRegion.className = 'mn-inspector-table'; this.tableRegion.hidden = true;
    this._listen(this.resizer, 'pointerdown', (event) => this._startResize(event));
    this._listen(this.resizer, 'keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event?.key)) return;
      event.preventDefault?.();
      const current = Number(this.resizer.getAttribute('aria-valuenow')) || 380;
      this.setWidth(current + (event.key === 'ArrowRight' ? 16 : -16));
    });
  }

  _startResize(event) {
    event.preventDefault?.();
    const doc = this.element.ownerDocument;
    const view = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
    if (!view) return;
    const move = (next) => this.setWidth((next?.clientX || 0) - this.element.getBoundingClientRect().left);
    const up = () => { view.removeEventListener?.('pointermove', move); view.removeEventListener?.('pointerup', up); };
    view.addEventListener?.('pointermove', move); view.addEventListener?.('pointerup', up, { once: true });
  }
  setWidth(value) {
    this.width = Math.max(320, Math.min(560, Number(value) || this.width || 380));
    this.element.style.width = `${this.width}px`; this.resizer.setAttribute('aria-valuenow', String(this.width));
    this._call('onResize', this.width); return this;
  }

  setMobile(mobile) { this.mobile = !!mobile; this.element.classList?.toggle('mn-mobile-sheet', this.mobile); this.element.setAttribute('data-mobile', this.mobile ? 'true' : 'false'); if (!this.mobile) this.setWidth(this.width || 380); return this; }

  setGraph(datos) { this.datos = datos || { nodos: [], aristas: [], capas: [], temas: {} }; this.estado = normalizarEstado(this.estado, { datos: this.datos }); return this.update(this.datos, this.estado); }
  setState(state, selectionType = this.selectionType) { this.estado = normalizarEstado(state || {}, { datos: this.datos }); this.selectionType = selectionType; return this.update(this.datos, this.estado); }
  setTransientSelection(id, type = 'nodo') { this.selectedId = text(id); this.selectionType = type === 'arista' ? 'arista' : 'nodo'; return this; }
  getState() { return this.estado; }

  _overview() {
    const result = this.result || aplicarFiltros(this.datos, this.estado);
    const metrics = this.metrics || metricas(this.datos, this.estado.filtro);
    const intro = add(this.content, el(this.document, 'p')); intro.textContent = T('Selecciona una nota o un enlace para ver por qué forma parte del mapa.');
    const list = add(this.content, el(this.document, 'dl')); list.className = 'mn-overview-metrics';
    for (const [label, value] of [[T('Notas visibles'), result.conteos.notasVisibles ?? result.conteos.visibles ?? 0], [T('Enlaces visibles'), result.conteos.enlacesVisibles ?? 0], [T('Explicadas'), metrics.explicadas], [T('Fuentes'), result.conteos.fuentes ?? 0]]) {
      add(list, el(this.document, 'dt')).textContent = label; add(list, el(this.document, 'dd')).textContent = text(value);
    }
    const actions = add(this.content, el(this.document, 'div')); actions.className = 'mn-inspector-actions';
    add(actions, action(this.document, T('Tabla de datos'), () => this._call('onTable'), 'mn-primary'));
    add(actions, action(this.document, T('Salud'), () => this._call('onHealth')));
    add(actions, action(this.document, T('Vacíos'), () => this._call('onGaps')));
  }

  _node(node) {
    const id = text(node.id);
    this.title.textContent = text(node.titulo || node.ruta || id);
    const meta = add(this.content, el(this.document, 'dl')); meta.className = 'mn-node-metadata';
    const edges = this.datos.aristas.filter((edge) => { const [a, b] = edgeParts(edge); return text(a) === id || text(b) === id; });
    for (const [label, value] of [[T('Tipo'), status(node)], [T('Capa'), layer(this.datos, node.capa)], [T('Tema'), text(node.tema ? topic(this.datos, node.tema) : T('sin tema'))], [T('Grado'), text(node.grado ?? 0)], [T('Motivos'), edges.filter((edge) => text(edgeParts(edge)[2])).length], [T('Ruta'), text(node.ruta)], [T('Actualizada'), text(node.updated || '')]]) {
      if (!text(value)) continue; add(meta, el(this.document, 'dt')).textContent = label; add(meta, el(this.document, 'dd')).textContent = value;
    }
    const actions = add(this.content, el(this.document, 'div')); actions.className = 'mn-inspector-actions';
    if (node.ruta && !node.virtual && !(node.fuente && (node.rota || node.grupo))) add(actions, action(this.document, T('Abrir'), () => this._call('onOpen', id, 'nodo'), 'mn-primary'));
    add(actions, action(this.document, T('Radial'), () => this._call('onRadial', id)));
    add(actions, action(this.document, T('Camino'), () => this._call('onPath', id)));
    if (node.tema && (node.agrupados || node.capa === (this.datos.capas?.length || 1) - 1)) add(actions, action(this.document, T('Expandir o colapsar'), () => this._call('onCollapse', node.tema)));
    if (node.resumen && !node.resumenAprobado && !node.fuente && !node.virtual && !node.agrupados) add(actions, action(this.document, T('Resumir con IA'), () => this._call('onSummarize', id)));
    if (node.resumen && !node.fuente && !node.virtual && !node.agrupados) {
      const rs = add(this.content, el(this.document, 'div'));
      rs.className = 'mn-resumen2' + (node.resumenAprobado ? '' : ' mn-extraido');
      rs.textContent = node.resumen;
      if (node.resumenAprobado) { const lbl = add(this.content, el(this.document, 'div')); lbl.className = 'mn-capa'; lbl.textContent = T('Resumen aprobado (propiedad resumen).'); }
    }
    const reasons = add(this.content, el(this.document, 'section')); const heading = add(reasons, el(this.document, 'h3')); heading.textContent = T('Motivos y frases');
    const list = add(reasons, el(this.document, 'ul'));
    const byId = new Map(nodesOf(this.datos).map((node) => [text(node.id), node]));
    for (const edge of edges) {
      const parts = edgeParts(edge), other = text(parts[0]) === id ? text(parts[1]) : text(parts[0]);
      const item = add(list, el(this.document, 'li'));
      const target = action(this.document, text(byId.get(other)?.titulo || other), () => this._call('onSelect', other, 'nodo'), 'mn-link-action');
      add(item, target);
      const detail = add(item, el(this.document, 'p')); detail.textContent = text(parts[2]) || (phrase(parts[3]) ? T('en el texto: «{0}»', phrase(parts[3])) : T('enlazadas sin frase visible'));
      if (line(parts[4]) || line(parts[3])) add(item, el(this.document, 'small')).textContent = T('Línea de origen') + ': ' + (line(parts[4]) || line(parts[3]));
      if (!text(parts[2]) && phrase(parts[3]) && !node.fuente && !byId.get(other)?.fuente && !node.agrupados) add(item, action(this.document, T('Sugerir motivo ✦'), () => this._call('onSuggestReason', { origen: id, destino: other, linea: Number(line(parts[3])) || undefined }, parts[3]), 'mn-ai-action'));
    }
    if (!edges.length) add(list, el(this.document, 'li')).textContent = T('No hay motivos ni conexiones para mostrar.');
    if (node.enlaces?.length) {
      const external = add(this.content, el(this.document, 'section')); add(external, el(this.document, 'h3')).textContent = T('Enlaces externos');
      const externalList = add(external, el(this.document, 'ul'));
      for (const link of node.enlaces) {
        const item = add(externalList, el(this.document, 'li')); const anchor = add(item, el(this.document, 'a'));
        anchor.textContent = text(link.titulo || link.url); anchor.href = text(link.url); anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      }
    }
    if (node.agrupados) {
      const members = nodesOf(this.datos).filter((item) => item.tema === node.tema && !item.virtual).slice(0, 40);
      const section = add(this.content, el(this.document, 'section')); add(section, el(this.document, 'h3')).textContent = T('Notas dentro');
      const list = add(section, el(this.document, 'ul'));
      for (const member of members) add(add(list, el(this.document, 'li')), action(this.document, text(member.titulo || member.id), () => this._call('onSelect', text(member.id), 'nodo'), 'mn-link-action'));
    }
  }

  _edge(id) {
    const edge = this.datos.aristas.find((item) => edgeId(...edgeParts(item).slice(0, 2)) === id) || this.datos.aristas.find((item) => text(item?.id) === id);
    this.title.textContent = T('Enlace seleccionado');
    if (!edge) { add(this.content, el(this.document, 'p')).textContent = T('No se encontró el enlace seleccionado.'); return; }
    const parts = edgeParts(edge), byId = new Map(nodesOf(this.datos).map((node) => [text(node.id), node]));
    const endpoints = add(this.content, el(this.document, 'div')); endpoints.className = 'mn-edge-endpoints';
    for (const endpoint of [text(parts[0]), text(parts[1])]) add(endpoints, action(this.document, text(byId.get(endpoint)?.titulo || endpoint), () => this._call('onSelect', endpoint, 'nodo'), 'mn-link-action'));
    const reason = add(this.content, el(this.document, 'p')); reason.textContent = text(parts[2]) || (phrase(parts[3]) ? T('en el texto: «{0}»', phrase(parts[3])) : T('enlazadas sin frase visible'));
    if (line(parts[4]) || line(parts[3])) add(this.content, el(this.document, 'p')).textContent = T('Línea de origen') + ': ' + (line(parts[4]) || line(parts[3]));
  }
  _diagnosticSeverity(value) { return value === 'grave' ? T('grave') : value === 'advertencia' ? T('advertencia') : T('info'); }

  _health(items) {
    this.title.textContent = T('Salud');
    const list = add(this.content, el(this.document, 'ul')); list.className = 'mn-health-list';
    for (const item of items) {
      const row = add(list, el(this.document, 'li')); add(row, el(this.document, 'strong')).textContent = this._diagnosticSeverity(item.severidad);
      add(row, el(this.document, 'span')).textContent = text(item.mensaje || '');
      for (const node of item.nodos || []) { const id = text(typeof node === 'object' ? node.id || node.ruta : node); if (id) add(row, action(this.document, T('Enfocar {0}', id), () => this._call('onSelect', id, 'nodo'), 'mn-link-action')); }
    }
    if (!items.length) add(list, el(this.document, 'li')).textContent = T('No hay problemas de salud detectados.');
  }

  _gaps(items) {
    this.title.textContent = T('Vacíos entre temas');
    const list = add(this.content, el(this.document, 'ul')); list.className = 'mn-gap-list';
    for (const gap of items) {
      const row = add(list, el(this.document, 'li')); add(row, el(this.document, 'strong')).textContent = `${topic(this.datos, gap.ti)} ↔ ${topic(this.datos, gap.tj)}`;
      add(row, el(this.document, 'p')).textContent = T('{0} enlace(s); por su tamaño se esperarían ~{1}', gap.real, Math.round(gap.esperado));
      for (const candidate of gap.candidatos || []) add(row, action(this.document, T('Enfocar conexión sugerida'), () => this._call('onGapFocus', candidate, gap), 'mn-link-action'));
    }
    if (!items.length) add(list, el(this.document, 'li')).textContent = T('No hay vacíos marcados: los temas se enlazan entre sí en proporción a su tamaño.');
  }

  _path() {
    this.title.textContent = T('Camino · {0} salto(s)', Math.max(0, this.estado.ruta.length - 1));
    const list = add(this.content, el(this.document, 'ol')); const byId = new Map(nodesOf(this.datos).map((node) => [text(node.id), node]));
    for (const id of this.estado.ruta) {
      const item = add(list, el(this.document, 'li')); add(item, action(this.document, text(byId.get(id)?.titulo || id), () => this._call('onSelect', id, 'nodo'), 'mn-link-action'));
      const next = this.estado.ruta[this.estado.ruta.indexOf(id) + 1]; if (!next) continue;
      const edge = this.datos.aristas.find((item) => { const [a, b] = edgeParts(item); return (text(a) === id && text(b) === next) || (text(b) === id && text(a) === next); });
      const parts = edge ? edgeParts(edge) : []; add(item, el(this.document, 'p')).textContent = text(parts[2]) || (phrase(parts[3]) ? T('en el texto: «{0}»', phrase(parts[3])) : T('enlazadas'));
    }
  }

  update(datos = this.datos, state = this.estado, options = {}) {
    this.datos = datos || this.datos; this.estado = normalizarEstado(state || {}, { datos: this.datos });
    this.selectionType = options.selectionType || this.selectionType;
    this.result = aplicarFiltros(this.datos, this.estado);
    this.metrics = options.metrics || metricas(this.datos, this.estado.filtro);
    this.healthItems = options.diagnostics || diagnosticos(this.datos);
    this.gapItems = options.gaps || vacios(this.datos);
    this.tableMode = options.tableMode ?? this.estado.panel === 'tabla';
    clear(this.content); this.tableRegion.hidden = !this.tableMode;
    renderTablaGrafo(this.tableRegion, this.datos, this.estado, { onSelect: (id, type) => this._call('onSelect', id, type) });
    this.element.setAttribute('data-panel', this.estado.panel || 'overview');

    const selectedId = options.selectionId ?? this.selectedId ?? text(this.estado.seleccion);
    if (options.selectionId !== undefined) this.selectedId = text(options.selectionId);
    if (this.estado.ruta.length) this._path();
    else if (this.estado.panel === 'salud') this._health(this.healthItems);
    else if (this.estado.panel === 'vacios') this._gaps(this.gapItems);
    else if (selectedId && this.selectionType === 'arista') this._edge(text(selectedId));
    else {
      const node = nodesOf(this.datos).find((item) => text(item.id) === text(selectedId));
      if (node) this._node(node); else { this.title.textContent = T('Resumen del mapa'); this._overview(); }
    }
    if (this.tableMode) this.tableRegion.setAttribute('aria-label', T('Tabla de datos del grafo'));
    return this;
  }

  destroy() { for (const [target, type, handler] of this.listeners.splice(0)) target.removeEventListener?.(type, handler); }
}

export { InspectorController as default, InspectorController as Inspector };
