import { T } from '../i18n.js';
import { normalizarEstado } from '../view/state.js';

function text(value) { return value == null ? '' : String(value); }
function documentOf(container, document) {
  return document || container?.ownerDocument || (typeof globalThis !== 'undefined' && globalThis.document) || null;
}
function element(document, tag) {
  if (document && typeof document.createElement === 'function') return document.createElement(tag);
  return {
    tagName: String(tag).toUpperCase(), children: [], attributes: {}, style: {}, value: '', checked: false, disabled: false,
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    setAttribute(name, value) { this.attributes[name] = text(value); },
    getAttribute(name) { return this.attributes[name] == null ? null : this.attributes[name]; },
    addEventListener() {}, removeEventListener() {}, focus() {},
  };
}
function append(parent, child) { parent.appendChild(child); return child; }
function setClass(node, value) { node.className = value; }
function button(document, label, action, className = '') {
  const node = element(document, 'button');
  node.type = 'button';
  node.textContent = label;
  node.setAttribute('aria-label', label);
  node.setAttribute('title', label);
  setClass(node, `mn-workbench-button ${className}`.trim());
  if (typeof action === 'function') node.addEventListener('click', action);
  return node;
}
function activeFilterCount(state) {
  return state.temas.length + state.capas.length
    + (state.rangoGrado.min > 0 || state.rangoGrado.max !== null ? 1 : 0)
    + (state.actividadDias ? 1 : 0) + (state.soloExternas ? 1 : 0) + (state.soloLargoAlcance ? 1 : 0);
}

/** Controller DOM-agnóstico de las dos filas públicas del workbench. */
export class WorkbenchToolbar {
  constructor(options = {}) {
    this.container = options.container || null;
    this.document = documentOf(this.container, options.document);
    this.callbacks = options.callbacks || options;
    this.datos = options.datos || { nodos: [], aristas: [] };
    this.estado = normalizarEstado(options.state || options.estado || {}, { datos: this.datos });
    this.listeners = [];
    this._build();
    this.setState(this.estado, options.result);
  }

  _build() {
    const document = this.document;
    this.element = element(document, 'header');
    setClass(this.element, 'mn-workbench-toolbar');
    this.element.setAttribute('aria-label', T('Why Graph'));

    this.primary = append(this.element, element(document, 'div'));
    setClass(this.primary, 'mn-workbench-primary');
    this.brand = append(this.primary, element(document, 'h1'));
    this.brand.textContent = T('Why Graph');
    this.metrics = append(this.primary, element(document, 'p'));
    setClass(this.metrics, 'mn-workbench-metrics');
    this.metrics.setAttribute('aria-live', 'polite');
    this.searchInput = append(this.primary, element(document, 'input'));
    this.searchInput.type = 'search';
    setClass(this.searchInput, 'mn-buscar'); // la clase que esperan styles.css (objetivos táctiles) y el mirador
    this.searchInput.setAttribute('aria-label', T('Buscar en el grafo'));
    this.searchInput.setAttribute('placeholder', T('Buscar en el grafo'));
    this._listen(this.searchInput, 'input', () => {
      const value = this.searchInput.value;
      this.estado.filtro = value;
      if (typeof this.callbacks.onSearch === 'function') this.callbacks.onSearch(value);
    });

    this.actions = append(this.element, element(document, 'div'));
    setClass(this.actions, 'mn-workbench-actions');
    this.actions.setAttribute('role', 'toolbar');
    this.actions.setAttribute('aria-label', T('Herramientas del mapa'));

    this.mode = append(this.actions, element(document, 'div'));
    setClass(this.mode, 'mn-workbench-segmented');
    this.mode.setAttribute('role', 'group');
    this.mode.setAttribute('aria-label', T('Modo de visualización'));
    this.layeredButton = append(this.mode, button(document, T('Capas'), () => this._mode('capas'), 'mn-workbench-mode'));
    this.radialButton = append(this.mode, button(document, T('Radial'), () => this._mode('radial'), 'mn-workbench-mode'));

    this.filterButton = append(this.actions, button(document, T('Filtros'), () => this._call('onFilter')));
    this.saveButton = append(this.actions, button(document, T('Guardar vista'), () => this._call('onSaveView')));
    this.restoreButton = append(this.actions, button(document, T('Restaurar vista'), () => this._call('onRestoreView')));
    this.healthButton = append(this.actions, button(document, T('Salud'), () => this._call('onHealth')));
    this.gapsButton = append(this.actions, button(document, T('Vacíos'), () => this._call('onGaps')));
    this.tableButton = append(this.actions, button(document, T('Tabla de datos'), () => this._call('onTable')));
    this.exportButton = append(this.actions, button(document, T('Exportar'), () => this._call('onExport')));
    this.helpButton = append(this.actions, button(document, T('Ayuda'), () => this._call('onHelp')));
    if (this.container) this.container.appendChild(this.element);
  }

  _listen(target, type, handler) {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler);
    this.listeners.push([target, type, handler]);
  }

  _call(name, ...args) { if (typeof this.callbacks[name] === 'function') this.callbacks[name](...args); }
  _mode(modo) {
    if (modo === 'radial' && !this.estado.seleccion) return;
    this.estado.modo = modo;
    this.setState(this.estado);
    this._call('onMode', modo, this.estado);
  }

  setGraph(datos) {
    this.datos = datos || { nodos: [], aristas: [] };
    this.estado = normalizarEstado(this.estado, { datos: this.datos });
    return this.setState(this.estado);
  }

  setState(state, result = null) {
    this.estado = normalizarEstado(state || {}, { datos: this.datos });
    const counts = result?.conteos || {};
    const notes = counts.notasVisibles ?? counts.visibles ?? this.datos.nodos?.length ?? 0;
    const links = counts.enlacesVisibles ?? this.datos.aristas?.length ?? 0;
    this.metrics.textContent = T('{0} notas · {1} enlaces visibles', notes, links);
    this.searchInput.value = this.estado.filtro;
    this.layeredButton.setAttribute('aria-pressed', this.estado.modo === 'capas' ? 'true' : 'false');
    this.radialButton.setAttribute('aria-pressed', this.estado.modo === 'radial' ? 'true' : 'false');
    this.radialButton.disabled = !this.estado.seleccion;
    const count = activeFilterCount(this.estado);
    const filterLabel = T('Filtros') + (count ? T(' ({0} activos)', count) : '');
    this.filterButton.setAttribute('aria-label', filterLabel);
    this.filterButton.setAttribute('title', filterLabel);
    this.healthButton.setAttribute('aria-pressed', this.estado.panel === 'salud' ? 'true' : 'false');
    this.gapsButton.setAttribute('aria-pressed', this.estado.panel === 'vacios' ? 'true' : 'false');
    this.tableButton.setAttribute('aria-pressed', this.estado.panel === 'tabla' ? 'true' : 'false');
    if (typeof this.callbacks.onState === 'function') this.callbacks.onState(this.estado, result || null);
    return this;
  }

  getState() { return this.estado; }
  focusSearch() { if (typeof this.searchInput.focus === 'function') this.searchInput.focus(); }

  destroy() {
    for (const [target, type, handler] of this.listeners.splice(0)) if (typeof target.removeEventListener === 'function') target.removeEventListener(type, handler);
  }
}

export { WorkbenchToolbar as default, WorkbenchToolbar as Toolbar };
