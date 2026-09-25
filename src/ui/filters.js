import { T } from '../i18n.js';
import { aplicarFiltros, normalizarEstado } from '../view/state.js';

function text(value) { return value == null ? '' : String(value); }
function nodesOf(datos) { return Array.isArray(datos?.nodos) ? datos.nodos.filter(Boolean) : Object.values(datos?.nodos || {}); }
function docFor(container, document) { return document || container?.ownerDocument || (typeof globalThis !== 'undefined' && globalThis.document) || null; }
function el(document, tag) {
  if (document?.createElement) return document.createElement(tag);
  return {
    tagName: String(tag).toUpperCase(), children: [], attributes: {}, style: {}, value: '', checked: false, disabled: false,
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }, setAttribute(name, value) { this.attributes[name] = text(value); },
    getAttribute(name) { return this.attributes[name] ?? null; }, addEventListener() {}, removeEventListener() {}, focus() {},
  };
}
function add(parent, child) { parent.appendChild(child); return child; }
function nodes(datos) {
  return nodesOf(datos).filter((node) => node && !node.virtual).sort((a, b) => Number(a.capa) - Number(b.capa) || text(a.titulo).localeCompare(text(b.titulo), undefined, { numeric: true, sensitivity: 'base' }));
}
function nameTopic(datos, id) {
  const value = datos?.temas?.[id];
  return text(Array.isArray(value) ? value[0] : value?.nombre || value?.name || id);
}
function nameLayer(datos, index) {
  const value = datos?.capas?.[index];
  return text(Array.isArray(value) ? value[1] || value[0] : value?.nombre || value?.name || value || index + 1);
}
function filterCount(state) {
  return state.temas.length + state.capas.length + (state.rangoGrado.min > 0 || state.rangoGrado.max !== null ? 1 : 0)
    + (state.actividadDias ? 1 : 0) + (state.soloExternas ? 1 : 0) + (state.soloLargoAlcance ? 1 : 0);
}

/** Popover de filtros per-view; el modo de fuentes sigue siendo una preferencia global. */
export class FilterPopover {
  constructor(options = {}) {
    this.container = options.container || null;
    this.document = docFor(this.container, options.document);
    this.datos = options.datos || { nodos: [], aristas: [] };
    this.estado = normalizarEstado(options.state || {}, { datos: this.datos });
    this.sourceMode = ['no', 'demanda', 'todas'].includes(options.sourceMode) ? options.sourceMode : 'demanda';
    this.callbacks = options.callbacks || options;
    this.listeners = [];
    this._build();
    this.setGraph(this.datos);
  }

  _listen(target, type, handler) {
    if (typeof target?.addEventListener !== 'function') return;
    target.addEventListener(type, handler);
    this.listeners.push([target, type, handler]);
  }

  _build() {
    const document = this.document;
    this.element = add(this.container || el(document, 'div'), el(document, 'section'));
    this.element.className = 'mn-workbench-filters';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'false');
    this.element.setAttribute('aria-label', T('Filtros del mapa'));
    this.element.hidden = true;
    const header = add(this.element, el(document, 'h2')); header.textContent = T('Filtros del mapa');
    this.summary = add(this.element, el(document, 'p')); this.summary.className = 'mn-filter-summary';

    this.topicFieldset = this._fieldset(T('Temas'));
    this.layerFieldset = this._fieldset(T('Capas'));
    this.degreeFieldset = this._fieldset(T('Grado'));
    this.minInput = this._number(T('Grado mínimo'), 0); add(this.degreeFieldset, this.minInput.label);
    this.maxInput = this._number(T('Grado máximo'), 0); add(this.degreeFieldset, this.maxInput.label);

    this.activityLabel = add(this.element, el(document, 'label')); this.activityLabel.textContent = T('Actividad'); this.activityLabel.setAttribute('for', 'why-graph-activity-filter');
    this.activity = add(this.element, el(document, 'select')); this.activity.id = 'why-graph-activity-filter';
    for (const [value, label] of [[0, T('Toda la actividad')], [7, T('Últimos 7 días')], [30, T('Últimos 30 días')], [90, T('Últimos 90 días')]]) {
      const option = add(this.activity, el(document, 'option')); option.value = String(value); option.textContent = label;
    }
    this.external = this._toggle(T('Solo notas con enlaces externos'));
    this.longRange = this._toggle(T('Solo enlaces de largo alcance'));

    const sourceFieldset = this._fieldset(T('Modo de fuentes (preferencia de todo el vault)'));
    this.sourceSelect = add(sourceFieldset, el(document, 'select')); this.sourceSelect.setAttribute('aria-label', T('Modo de fuentes (preferencia de todo el vault)'));
    for (const [value, label] of [['no', T('No mostrar fuentes')], ['demanda', T('Mostrar fuentes cuando se necesitan')], ['todas', T('Mostrar todas las fuentes')]]) {
      const option = add(this.sourceSelect, el(document, 'option')); option.value = value; option.textContent = label;
    }
    const sourceHelp = add(sourceFieldset, el(document, 'p')); sourceHelp.textContent = T('Esta preferencia se aplica a todas las vistas del vault.');
    this._listen(this.sourceSelect, 'change', () => {
      this.sourceMode = ['no', 'demanda', 'todas'].includes(this.sourceSelect.value) ? this.sourceSelect.value : 'demanda';
      this._call('onSourceMode', this.sourceMode);
    });

    this.clear = add(this.element, el(document, 'button')); this.clear.type = 'button'; this.clear.textContent = T('Borrar todo');
    this._listen(this.clear, 'click', () => this.clearAll());
    this._listen(this.activity, 'change', () => this._change({ actividadDias: Number(this.activity.value) }));
    this._listen(this.minInput.input, 'change', () => this._change({ rangoGrado: { min: Number(this.minInput.input.value) || 0, max: this.maxInput.input.value === '' ? null : Number(this.maxInput.input.value) } }));
    this._listen(this.maxInput.input, 'change', () => this._change({ rangoGrado: { min: Number(this.minInput.input.value) || 0, max: this.maxInput.input.value === '' ? null : Number(this.maxInput.input.value) } }));
  }

  _fieldset(label) { const fieldset = add(this.element, el(this.document, 'fieldset')); const legend = add(fieldset, el(this.document, 'legend')); legend.textContent = label; return fieldset; }
  _number(label, value) {
    const wrapper = el(this.document, 'label'); const control = el(this.document, 'input'); control.type = 'number'; control.min = String(value); control.step = '1'; control.value = ''; control.setAttribute('aria-label', label);
    add(wrapper, el(this.document, 'span')).textContent = label; wrapper.appendChild(control);
    return { label: wrapper, input: control };
  }
  _toggle(label) {
    const wrapper = el(this.document, 'label'); const control = add(wrapper, el(this.document, 'input')); control.type = 'checkbox';
    add(wrapper, el(this.document, 'span')).textContent = label; add(this.element, wrapper);
    this._listen(control, 'change', () => this._change(control === this.external ? { soloExternas: control.checked } : { soloLargoAlcance: control.checked }));
    return control;
  }
  _call(name, ...args) { if (typeof this.callbacks[name] === 'function') this.callbacks[name](...args); }
  _change(partial) {
    this.estado = normalizarEstado({ ...this.estado, ...partial }, { datos: this.datos });
    this.result = aplicarFiltros(this.datos, this.estado);
    this._syncControls();
    this._call('onChange', this.estado, this.result);
  }

  setGraph(datos) {
    this.datos = datos || { nodos: [], aristas: [] };
    this._buildChoices();
    return this.setState(this.estado);
  }

  _buildChoices() {
    for (const fieldset of [this.topicFieldset, this.layerFieldset]) while (fieldset.children.length > 1) fieldset.removeChild(fieldset.lastChild);
    this.topicInputs = []; this.layerInputs = [];
    const uniqueTopics = [...new Set(nodes(this.datos).map((node) => text(node.tema)).filter(Boolean))].sort((a, b) => nameTopic(this.datos, a).localeCompare(nameTopic(this.datos, b), undefined, { numeric: true, sensitivity: 'base' }));
    for (const topic of uniqueTopics) {
      const input = add(this.topicFieldset, el(this.document, 'input')); input.type = 'checkbox'; input.value = topic;
      const label = add(this.topicFieldset, el(this.document, 'label')); label.textContent = nameTopic(this.datos, topic); label.appendChild(input);
      this.topicInputs.push(input);
      this._listen(input, 'change', () => this._change({ temas: this.topicInputs.filter((item) => item.checked).map((item) => item.value) }));
    }
    const layers = [...new Set(nodes(this.datos).map((node) => Number(node.capa)).filter(Number.isInteger))].sort((a, b) => a - b);
    for (const layer of layers) {
      const input = add(this.layerFieldset, el(this.document, 'input')); input.type = 'checkbox'; input.value = String(layer);
      const label = add(this.layerFieldset, el(this.document, 'label')); label.textContent = nameLayer(this.datos, layer); label.appendChild(input);
      this.layerInputs.push(input);
      this._listen(input, 'change', () => this._change({ capas: this.layerInputs.filter((item) => item.checked).map((item) => Number(item.value)) }));
    }
  }

  _syncControls() {
    for (const input of this.topicInputs || []) input.checked = this.estado.temas.includes(input.value);
    for (const input of this.layerInputs || []) input.checked = this.estado.capas.includes(Number(input.value));
    this.minInput.input.value = this.estado.rangoGrado.min > 0 ? String(this.estado.rangoGrado.min) : '';
    this.maxInput.input.value = this.estado.rangoGrado.max === null ? '' : String(this.estado.rangoGrado.max);
    this.activity.value = String(this.estado.actividadDias); this.external.checked = this.estado.soloExternas; this.longRange.checked = this.estado.soloLargoAlcance;
    this.sourceSelect.value = this.sourceMode;
    this.summary.textContent = T('{0} filtro(s) activo(s)', filterCount(this.estado));
  }

  setSourceMode(mode) { if (['no', 'demanda', 'todas'].includes(mode)) { this.sourceMode = mode; this.sourceSelect.value = mode; } return this; }
  setState(state) {
    this.estado = normalizarEstado(state || {}, { datos: this.datos });
    this.result = aplicarFiltros(this.datos, this.estado);
    this._syncControls();
    return this;
  }
  getState() { return this.estado; }
  setOpen(open) { this.element.hidden = !open; if (open) this._call('onOpen'); return this; }
  toggle() { return this.setOpen(this.element.hidden); }
  clearAll() {
    this.estado = normalizarEstado({ ...this.estado, temas: [], capas: [], rangoGrado: { min: 0, max: null }, actividadDias: 0, soloExternas: false, soloLargoAlcance: false }, { datos: this.datos });
    this._syncControls();
    this.result = aplicarFiltros(this.datos, this.estado);
    this._call('onChange', this.estado, this.result);
  }
  destroy() { for (const [target, type, handler] of this.listeners.splice(0)) target.removeEventListener?.(type, handler); }
}

export { FilterPopover as default };
