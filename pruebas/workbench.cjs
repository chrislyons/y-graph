/* Contrato DOM-agnóstico del workbench: toolbar, popover de filtros e inspector. */
const { cargarPlugin, pruebas } = require('./simulado.cjs');
const { interno } = cargarPlugin(process.argv[2]);
const { WorkbenchToolbar, FilterPopover, InspectorController } = interno;
const p = pruebas('workbench');

class Nodo {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parentNode = null;
    this.attributes = Object.create(null); this.style = {}; this.listeners = Object.create(null); this.value = ''; this.checked = false; this.disabled = false; this.hidden = false;
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((item) => item !== child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] == null ? null : this.attributes[name]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== fn); }
  dispatch(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ target: this, preventDefault() {}, ...event }); }
  focus() { this.focused = true; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 380, height: 700 }; }
}
class Doc { createElement(tag) { return new Nodo(tag, this); } }
function all(node, tag, out = []) { for (const child of node.children || []) { if (child.tagName === tag.toUpperCase()) out.push(child); all(child, tag, out); } return out; }

const hoy = Date.now();
const datos = {
  nodos: [
    { id: 'a', titulo: 'Alfa', ruta: 'a.md', capa: 0, tema: 'rojo', grado: 2, updated: hoy },
    { id: 'b', titulo: 'Beta', ruta: 'b.md', capa: 1, tema: 'azul', grado: 2, updated: hoy, resumen: 'Resumen' },
    { id: 'c', titulo: 'Gamma', ruta: 'c.md', capa: 1, tema: 'rojo', grado: 1, updated: hoy, resumenAprobado: true },
  ],
  aristas: [['a', 'b', 'motivo A', { texto: 'frase', linea: 4 }], ['b', 'c', '', { texto: 'otra', linea: 9 }]],
  capas: [['L0', 'Entrada'], ['L1', 'Salida']],
  temas: { rojo: ['Rojo', '#f00'], azul: ['Azul', '#00f'] },
};
const doc = new Doc();
const root = doc.createElement('div');
const cambios = [];
const toolbar = new WorkbenchToolbar({
  container: root, document: doc, datos,
  callbacks: { onMode: (mode) => cambios.push(['mode', mode]), onFilter: () => cambios.push(['filter']), onSearch: (q) => cambios.push(['search', q]), onState: (state) => cambios.push(['state', state.modo]) },
});
p.igual('la toolbar tiene dos filas', toolbar.primary.parentNode === toolbar.element && toolbar.actions.parentNode === toolbar.element, true);
p.igual('los modos son un control segmentado', [toolbar.mode.getAttribute('role'), toolbar.layeredButton.getAttribute('aria-pressed'), toolbar.radialButton.disabled], ['group', 'true', true]);
p.igual('las acciones públicos están traducidas y nombradas', ['Filters', 'Save view', 'Restore view', 'Health', 'Gaps', 'Data table', 'Export', 'Help'].every((name) => all(root, 'button').some((button) => button.getAttribute('aria-label') === name)), true);
toolbar.searchInput.value = 'beta'; toolbar.searchInput.dispatch('input');
toolbar.setState({ ...toolbar.getState(), seleccion: 'a' });
p.igual(' Radial se habilita al seleccionar', toolbar.radialButton.disabled, false);
toolbar.radialButton.dispatch('click');
p.igual('el modo radial delega el cambio', cambios.some((item) => item[0] === 'mode' && item[1] === 'radial'), true);

const filterRoot = doc.createElement('div');
let filtered = null, source = null;
const filters = new FilterPopover({ container: filterRoot, document: doc, datos, callbacks: { onChange: (state, result) => { filtered = [state, result]; }, onSourceMode: (mode) => { source = mode; } } });
p.igual('el popover es un diálogo semántico', [filters.element.getAttribute('role'), filters.element.hidden], ['dialog', true]);
p.igual('hay listas de temas y capas', [filters.topicInputs.length, filters.layerInputs.length], [2, 2]);
const redFilter = filters.topicInputs.find((input) => input.value === 'rojo'); redFilter.checked = true; redFilter.dispatch('change');
p.igual('un tema actualiza el estado y el resultado normalizado', [filtered[0].temas, [...filtered[1].visibles]], [['rojo'], ['a', 'c']]);
filters.minInput.input.value = '2'; filters.minInput.input.dispatch('change');
p.igual('el grado mínimo filtra nodos y enlaces', [[...filtered[1].visibles], filtered[1].conteos.enlacesVisibles], [['a'], 0]);
filters.clear.dispatch('click');
p.igual('Borrar todo restaura el alcance', filtered[1].conteos.enlacesVisibles, 2);
filters.sourceSelect.value = 'todas'; filters.sourceSelect.dispatch('change');
p.igual('el modo de fuentes se separa como preferencia global', source, 'todas');
filters.setOpen(true);
p.igual('el popover abre semánticamente', filters.element.hidden, false);

const inspectorRoot = doc.createElement('div');
const selected = [];
const inspector = new InspectorController({ container: inspectorRoot, document: doc, datos, callbacks: { onSelect: (id, type) => selected.push([id, type]) } });
p.igual('el inspector es complementario y redimensionable', [inspector.element.getAttribute('role'), inspector.resizer.getAttribute('aria-valuemin'), inspector.resizer.getAttribute('aria-valuemax')], ['complementary', '320', '560']);
// El resumen (métricas + acciones) se mudó a la barra inferior de la escena: en reposo el
// inspector no dibuja nada — ni el rótulo «Map overview» ni la lista de métricas.
p.igual('el inspector en reposo no muestra el resumen', [inspector.title.textContent, all(inspector.content, 'dl').length, all(inspector.content, 'p').length, inspector.element.getAttribute('data-panel')], ['', 0, 0, 'idle']);
inspector.setWidth(200); inspector.setWidth(700);
p.igual('el ancho se limita entre 320 y 560', inspector.resizer.getAttribute('aria-valuenow'), '560');
inspector.setTransientSelection('b', 'nodo'); inspector.update(datos, { ...inspector.getState(), seleccion: 'b' }, { selectionId: 'b', selectionType: 'nodo' });
p.igual('el nodo muestra título, metadatos y razones', [inspector.title.textContent, all(inspector.content, 'dd').length >= 4, all(inspector.content, 'li').length >= 2], ['Beta', true, true]);
inspector.setTransientSelection(JSON.stringify(['a', 'b']), 'arista'); inspector.update(datos, inspector.getState(), { selectionId: JSON.stringify(['a', 'b']), selectionType: 'arista' });
p.igual('la arista muestra extremos y motivo', [all(inspector.content, 'button').some((node) => node.textContent === 'Alfa'), all(inspector.content, 'p').some((node) => node.textContent === 'motivo A')], [true, true]);
inspector.update(datos, { ...inspector.getState(), panel: 'salud' }, { diagnostics: [{ id: 'test', tipo: 'huerfana', severidad: 'grave', nodos: ['a'], mensaje: 'diagnóstico de prueba' }] });
p.igual('salud tiene diagnóstico y acción de foco', [inspector.title.textContent, all(inspector.content, 'button').some((node) => node.getAttribute('aria-label') === 'Focus a')], ['Health', true]);
inspector.update(datos, { ...inspector.getState(), panel: 'tabla' }, { tableMode: true });
p.igual('la tabla de datos añade dos tablas semánticas', all(inspector.tableRegion, 'table').length, 2);
p.igual('las filas de tabla seleccionan nodos o aristas', all(inspector.tableRegion, 'tr').some((row) => row.getAttribute('data-kind') === 'nodo') && all(inspector.tableRegion, 'tr').some((row) => row.getAttribute('data-kind') === 'arista'), true);
inspector.setMobile(true);
p.igual('el inspector móvil se convierte en bottom sheet', inspector.element.getAttribute('data-mobile'), 'true');
inspector.update(datos, { ...inspector.getState(), panel: null }, { selectionId: '', tableMode: false });
p.igual('en el teléfono el reposo oculta la hoja (nada de hoja vacía)', [inspector.element.hidden, inspector.title.textContent], [true, '']);

toolbar.destroy(); filters.destroy(); inspector.destroy();
process.exit(p.cerrar() ? 1 : 0);
