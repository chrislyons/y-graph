/* Contrato DOM-agnóstico de tabla, teclado, búsqueda y selección. */
const { cargarPlugin, pruebas } = require('./simulado.cjs');
const { interno } = cargarPlugin(process.argv[2]);
const { renderTablaGrafo, InteractionController } = interno;
const p = pruebas('interaccion');

class Nodo {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parentNode = null;
    this.attributes = Object.create(null); this.style = {}; this.value = ''; this.focused = false; this.listeners = Object.create(null);
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  insertBefore(child, before) { const i = this.children.indexOf(before); this.children.splice(i < 0 ? 0 : i, 0, child); child.parentNode = this; return child; }
  removeChild(child) { this.children = this.children.filter((item) => item !== child); return child; }
  setAttribute(name, val) { this.attributes[name] = String(val); }
  getAttribute(name) { return this.attributes[name] == null ? null : this.attributes[name]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== fn); }
  dispatch(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...event }); }
  focus() { this.focused = true; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 600 }; }
}
class Doc { constructor() { this.root = new Nodo('body', this); } createElement(tag) { return new Nodo(tag, this); } }
function descendants(node, out = []) { for (const child of node.children || []) { out.push(child); descendants(child, out); } return out; }
function byTag(node, tag) { return descendants(node).filter((item) => item.tagName === tag.toUpperCase()); }

const HOY = Date.now();
const datos = {
  nodos: [
    { id: 'b', titulo: 'Beta', capa: 1, tema: 'z', grado: 2, updated: HOY },
    { id: 'a', titulo: 'Alfa', capa: 0, tema: 'a', grado: 2, updated: HOY },
    { id: 'c', titulo: 'Gamma', capa: 1, tema: 'a', grado: 1, updated: HOY },
  ],
  aristas: [['a', 'b', 'motivo A', { texto: 'frase literal', linea: 4 }], ['b', 'c', '', { texto: 'otra frase', linea: 9 }]],
  capas: [['L0', 'Entrada'], ['L1', 'Salida']],
  temas: { a: ['Alfa', '#f00'], z: ['Zeta', '#00f'] },
};
const doc = new Doc();
const tableRoot = doc.createElement('div');
const before = JSON.stringify(datos);
const rendered = renderTablaGrafo(tableRoot, datos, { capas: [0, 1] }, { onSelect: (id, kind) => selected.push([id, kind]) });
const selected = [];
const tables = byTag(tableRoot, 'table');
p.igual('renderiza dos tablas semánticas', tables.length, 2);
p.igual('cada tabla tiene caption', tables.map((table) => byTag(table, 'caption').length), [1, 1]);
p.igual('los encabezados de tabla son th de columna', tables.every((table) => byTag(table, 'thead')[0].children[0].children.every((th) => th.getAttribute('scope') === 'col')), true);
p.cierto('la tabla de nodos usa th de fila', byTag(tables[0], 'tbody')[0].children.every((row) => row.children[0].tagName === 'TH' && row.children[0].getAttribute('scope') === 'row'));
p.igual('la tabla no muta los datos', JSON.stringify(datos), before);
p.igual('los filtros determinan las filas', [byTag(tables[0], 'tbody')[0].children.length, byTag(tables[1], 'tbody')[0].children.length], [3, 2]);
p.igual('la razón y la frase se muestran', byTag(tables[1], 'tbody')[0].children[0].children.map((cell) => cell.textContent || cell.children?.[0]?.textContent || ''), [JSON.stringify(['a', 'b']), 'a — b', 'Entrada — Salida', 'motivo A', 'frase literal', '4']);
byTag(tables[0], 'tbody')[0].children[0].dispatch('click');
byTag(tables[1], 'tbody')[0].children[0].dispatch('click');
p.igual('onSelect recibe id y tipo', selected, [['a', 'nodo'], [JSON.stringify(['a', 'b']), 'arista']]);
const emptyTable = doc.createElement('div');
renderTablaGrafo(emptyTable, {}, {}, {});
p.igual('datos vacíos producen captions accesibles', byTag(emptyTable, 'table').map((table) => byTag(table, 'caption')[0].textContent), ['Visible nodes (0)', 'Visible links (0)']);

const renderer = {
  hitTest(x, y) { return y > 40 ? { tipo: 'arista', id: JSON.stringify(['a', 'b']), a: 'a', b: 'b', distancia: 1 } : { tipo: 'nodo', id: x > 20 ? 'b' : 'a', distancia: 0 }; },
  setGraph() { return this; }, invalidate() {}, destroy() {},
};
const canvasParent = doc.createElement('div');
const canvas = doc.createElement('canvas'); canvasParent.appendChild(canvas);
let selection = null, opened = null, centered = null, fitted = 0, searched = null;
const controller = new InteractionController({
  canvas, renderer, document: doc, datos, estado: { camara: { x: 0, y: 0, k: 1 } },
  onSelect: (id, kind) => { selection = [id, kind]; }, onOpen: (id) => { opened = id; }, onCenter: (id) => { centered = id; }, onFit: () => { fitted++; }, onSearch: (q) => { searched = q; },
});
p.igual('el canvas queda en un group con nombre', canvasParent.children[0].getAttribute('role'), 'group');
p.igual('el canvas es focusable y descrito', [canvas.getAttribute('tabindex'), canvas.getAttribute('aria-label'), !!canvas.getAttribute('aria-describedby')], ['0', 'Graph explorer', true]);
p.igual('existe live region y listbox', [controller.live.getAttribute('aria-live'), controller.listbox.getAttribute('role')], ['polite', 'listbox']);
p.igual('orden j/k estable', controller.getStableNodeOrder(), ['a', 'c', 'b']);
let prevented = false;
canvas.dispatch('keydown', { key: 'Tab', preventDefault() { prevented = true; } });
p.igual('Tab no se intercepta', prevented, false);
canvas.dispatch('keydown', { key: 'j', preventDefault() {} });
p.igual('j avanza nodos', [controller._active, selection[0]], ['c', 'c']);
canvas.dispatch('keydown', { key: 'ArrowRight', shiftKey: true, preventDefault() {} });
p.igual('flecha con Shift panea 240', controller.getState().camara.x, 240);
canvas.dispatch('keydown', { key: '+', preventDefault() {} });
p.igual('plus acerca', controller.getState().camara.k > 1, true);
canvas.dispatch('keydown', { key: 'f', preventDefault() {} });
canvas.dispatch('keydown', { key: 'Enter', preventDefault() {} });
canvas.dispatch('keydown', { key: ' ', preventDefault() {} });
canvas.dispatch('keydown', { key: '/', preventDefault() {} });
p.igual('F, Enter, Space y / delegan acciones', [fitted, opened, centered, controller.searchInput.focused], [1, 'c', 'c', true]);
canvas.dispatch('pointerdown', { pointerId: 1, clientX: 1, clientY: 1 }); canvas.dispatch('pointerup', { pointerId: 1, clientX: 1, clientY: 1 });
p.igual('un tap selecciona nodo', selection, ['a', 'nodo']);
canvas.dispatch('pointerdown', { pointerId: 2, clientX: 1, clientY: 100 }); canvas.dispatch('pointerup', { pointerId: 2, clientX: 1, clientY: 100 });
p.igual('un tap selecciona arista', selection, [JSON.stringify(['a', 'b']), 'arista']);
controller.searchInput.value = 'gam'; controller.searchInput.dispatch('input');
p.igual('la búsqueda produce opciones', [controller.searchOptions, searched], [['c'], 'gam']);
controller.searchInput.dispatch('keydown', { key: 'ArrowDown', preventDefault() {} });
controller.searchInput.dispatch('keydown', { key: 'Enter', preventDefault() {} });
p.igual('Enter elige el resultado de búsqueda', selection, ['c', 'nodo']);
controller.searchInput.dispatch('keydown', { key: 'Escape', preventDefault() {} });
p.igual('Escape limpia la búsqueda', [controller.getState().filtro, controller.searchInput.value], ['', '']);
controller.setState({ ruta: ['a', 'b'] }); canvas.dispatch('keydown', { key: 'Escape', preventDefault() {} });
p.igual('Escape limpia primero la ruta', [controller.getState().ruta, controller.getState().seleccion], [[], 'c']);
canvas.dispatch('keydown', { key: 'Escape', preventDefault() {} });
p.igual('Escape limpia después la selección', controller.getState().seleccion, null);
canvas.dispatch('keydown', { key: 'j', preventDefault() {} });
canvas.dispatch('keydown', { key: 'k', preventDefault() {} });
p.igual('j/k mantienen el orden estable', [controller._active, selection[0]], ['b', 'b']);

process.exit(p.cerrar() ? 1 : 0);
