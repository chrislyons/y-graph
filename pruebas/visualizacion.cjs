/* Regresión determinista del layout, el presupuesto de etiquetas, el culling, el hit-test,
 * los anillos BFS y la normalización de vistas guardadas. No abre red ni depende del DOM real.
 */
const { cargarPlugin, pruebas } = require('./simulado.cjs');
const { interno } = cargarPlugin(process.argv[2]);
const { layoutCapas, layoutRadial, GraphRenderer, normalizarEstado } = interno;
const p = pruebas('visualización determinista');

function registroContexto() {
  return { fillText: [], strokeText: [], arc: [], moveTo: [], lineTo: [], bezierCurveTo: [] };
}

function contextoFalso(registro) {
  const noop = () => {};
  for (const name of [
    'beginPath', 'closePath', 'save', 'restore', 'translate', 'scale', 'clearRect', 'fill',
    'stroke', 'fillRect', 'strokeRect', 'setLineDash', 'setTransform', 'resetTransform',
    'rotate', 'clip', 'rect', 'roundRect', 'arcTo', 'ellipse', 'quadraticCurveTo', 'drawImage',
  ]) noop[name] = noop;
  const registrar = (name) => (...args) => { registro[name].push(args); };
  const ctx = { measureText: (text) => ({ width: String(text).length * 6.5 }) };
  for (const name of ['fillText', 'strokeText', 'arc', 'moveTo', 'lineTo', 'bezierCurveTo']) {
    ctx[name] = registrar(name);
  }
  ctx.createLinearGradient = () => ({ addColorStop() {} });
  ctx.createRadialGradient = () => ({ addColorStop() {} });
  return ctx;
}

function canvasFalso() {
  const foreground = registroContexto();
  const ctx = contextoFalso(foreground);
  return {
    width: 0,
    height: 0,
    foreground,
    getContext(type) { return type === '2d' ? ctx : null; },
  };
}

function crearRenderer(datos, viewport, estado, preferencias = {}) {
  const principal = canvasFalso();
  const capas = [];
  const renderer = new GraphRenderer(principal, {
    path2D: null,
    medirTexto: (text) => ({ width: String(text).length * 5 }),
    paleta: { bg: '#fff', text: '#000', edge: '#777', node: '#345', accent: '#07f' },
    preferencias: {
      ordenCapas: 'auto',
      ...preferencias,
      crearCanvas: () => {
        const canvas = canvasFalso();
        capas.push(canvas);
        return canvas;
      },
    },
  });
  renderer.setViewport({ ...viewport, dpr: 1 }).setGraph(datos, estado);
  return { renderer, principal, capas };
}

function etiquetasDeCapa(capa) {
  if (!capa) return [];
  return capa.foreground.strokeText.map(([titulo, x, baseline]) => ({
    titulo: String(titulo),
    rect: { x, y: baseline - 13, w: String(titulo).length * 5, h: 18 },
  }));
}

function ultimaEtiqueta(capa, titulo) {
  const labels = etiquetasDeCapa(capa);
  for (let i = labels.length - 1; i >= 0; i--) if (labels[i].titulo === titulo) return labels[i];
  return undefined;
}

function solapan(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function idArista(a, b) {
  return JSON.stringify([a, b].sort());
}

function crearFixtureGrande() {
  const idsInventario = ['inventory-101', 'inventory-102', 'inventory-103'];
  const titulosInventario = ['AMX101', 'AMX102', 'AMX103'];
  const nodos = Array.from({ length: 1200 }, (_, indice) => ({
    id: indice < 3 ? idsInventario[indice] : `node-${String(indice).padStart(4, '0')}`,
    titulo: indice < 3 ? titulosInventario[indice] : `Nodo ${String(indice).padStart(4, '0')}`,
    capa: indice < 600 ? 0 : 1,
    tema: indice % 2 ? 'beta' : 'alpha',
    updated: '2025-01-01',
    grado: 0,
  }));


  const aristas = [];
  const vistas = new Set();
  const agregar = (a, b) => {
    if (a === b) return;
    const id = idArista(a, b);
    if (vistas.has(id)) return;
    vistas.add(id);
    aristas.push([a, b, `motivo-${aristas.length + 1}`]);
  };
  for (let i = 0; i < nodos.length; i++) {
    agregar(nodos[i].id, nodos[(i + 1) % nodos.length].id);
    agregar(nodos[i].id, nodos[(i + 37) % nodos.length].id);
  }
  for (let i = 0; i < 600; i++) agregar(nodos[i].id, nodos[(i + 211) % nodos.length].id);
  for (const nodo of nodos) nodo.grado = aristas.reduce((total, [a, b]) => total + (a === nodo.id || b === nodo.id ? 1 : 0), 0);

  return {
    nodos,
    aristas,
    capas: [['entrada', 'Entrada'], ['salida', 'Salida']],
    temas: { alpha: ['Alfa', '#345'], beta: ['Beta', '#765'] },
  };
}

const fixture = crearFixtureGrande();
p.igual('el fixture determinista contiene exactamente 1.200 nodos', fixture.nodos.length, 1200);
p.igual('el fixture determinista contiene exactamente 3.000 aristas', fixture.aristas.length, 3000);

const viewportGrande = { width: 1440, height: 900 };
const layoutA = layoutCapas(fixture, viewportGrande, { orden: 'auto' });
const layoutB = layoutCapas(fixture, viewportGrande, { orden: 'auto' });
const idsA = Buffer.from(JSON.stringify(layoutA.orderedIds), 'utf8');
const idsB = Buffer.from(JSON.stringify(layoutB.orderedIds), 'utf8');
p.igual('misma entrada y mismo viewport: IDs ordenados byte por byte idénticos', Buffer.compare(idsA, idsB), 0);
p.igual('el resultado ordenado conserva los 1.200 IDs del fixture', layoutA.orderedIds.length, 1200);

const inventario = layoutCapas({
  nodos: [
    { id: 'inventory-103', titulo: 'AMX103', capa: 0, tema: 'inventario' },
    { id: 'inventory-101', titulo: 'AMX101', capa: 0, tema: 'inventario' },
    { id: 'inventory-102', titulo: 'AMX102', capa: 0, tema: 'inventario' },
  ],
  aristas: [['inventory-103', 'inventory-101', 'vecino'], ['inventory-101', 'inventory-102', 'vecino']],
  capas: [['inventory', 'Inventario']],
  temas: { inventario: ['Inventario'] },
}, { width: 800, height: 600 }, { orden: 'alfabetico' });
p.igual('el inventario usa orden natural numérico AMX101 < AMX102 < AMX103',
  inventario.orderedIds, ['inventory-101', 'inventory-102', 'inventory-103']);

const cruce = layoutCapas({
  nodos: [
    { id: 'source-a', titulo: 'A1', capa: 0, tema: 'red' },
    { id: 'source-b', titulo: 'A2', capa: 0, tema: 'red' },
    { id: 'linked', titulo: 'Linked', capa: 1, tema: 'red' },
    { id: 'comparator', titulo: 'Comparator', capa: 1, tema: 'red' },
  ],
  aristas: [['source-b', 'linked', 'linked']],
  capas: [['source', 'Entrada'], ['target', 'Salida']],
  temas: { red: ['Red'] },
}, { width: 1000, height: 700 }, { orden: 'auto' });
p.igual('el fixture de cruce coloca Linked debajo de Comparator',
  cruce.nodes.filter((node) => node.capa === 1).map((node) => node.id), ['comparator', 'linked']);
const yLinked = cruce.nodes.find((node) => node.id === 'linked').y;
const yComparator = cruce.nodes.find((node) => node.id === 'comparator').y;
p.cierto('las coordenadas confirman que el nodo enlazado queda físicamente debajo', yLinked > yComparator);

const viewportEtiquetas = { width: 1000, height: 700 };
const estadoCapa600 = { modo: 'capas', camara: { x: 0, y: 0, k: 1 }, capas: [0], ruta: [] };
const presupuesto = crearRenderer(fixture, viewportEtiquetas, estadoCapa600);
presupuesto.renderer.render(1000);
const capa600 = presupuesto.capas[1];
const etiquetas600 = etiquetasDeCapa(capa600);
const budgetEsperado = Math.max(24, Math.min(96, Math.floor(viewportEtiquetas.width * viewportEtiquetas.height / 9000)));
p.cierto('la capa de 600 nodos coloca etiquetas dentro del presupuesto desktop', etiquetas600.length > 0 && etiquetas600.length <= budgetEsperado);
const colision600 = etiquetas600.find((a, i) => etiquetas600.slice(i + 1).some((b) => solapan(a.rect, b.rect))) || null;
p.igual('ninguna etiqueta de la capa de 600 nodos colisiona', colision600, null);
presupuesto.renderer.destroy();

const datosPrioridad = {
  nodos: [
    ...Array.from({ length: 40 }, (_, i) => ({
      id: `high-${String(i).padStart(2, '0')}`,
      titulo: `High degree ${String(i).padStart(2, '0')}`,
      capa: 0,
      tema: 'alpha',
      grado: 20,
    })),
    { id: 'selected-low', titulo: 'Selected', capa: 1, tema: 'beta', grado: 0 },
    { id: 'path-low', titulo: 'Path node', capa: 1, tema: 'beta', grado: 0 },
  ],
  aristas: [['high-00', 'high-01', 'high'], ['high-01', 'high-02', 'high'], ['selected-low', 'path-low', 'path']],
  capas: [['high', 'High degree'], ['low', 'Important']],
  temas: { alpha: ['Alpha'], beta: ['Beta'] },
};
const viewportPrioridad = { width: 639, height: 1200 };
const estadoPrioridad = {
  modo: 'capas',
  camara: { x: 0, y: 0, k: 1 },
  seleccion: 'selected-low',
  ruta: ['path-low'],
};
const prioridad = crearRenderer(datosPrioridad, viewportPrioridad, estadoPrioridad);
prioridad.renderer.render(2000);
const etiquetasPrioridad = etiquetasDeCapa(prioridad.capas[1]);
const budgetPrioridad = Math.max(12, Math.min(40, Math.floor(639 * 1200 / 13000)));
p.igual('selección y ruta de grado cero ganan los dos slots anteriores al alto grado',
  [etiquetasPrioridad.some((label) => label.titulo === 'Selected'),
    etiquetasPrioridad.some((label) => label.titulo === 'Path node'),
    etiquetasPrioridad.filter((label) => label.titulo.startsWith('High degree')).length],
  [true, true, 38]);
p.igual('la prioridad de etiquetas respeta el presupuesto mobile exacto', etiquetasPrioridad.length, budgetPrioridad);

const selectedAntes = etiquetasPrioridad.find((label) => label.titulo === 'Selected');
prioridad.renderer.setGraph(datosPrioridad, {
  ...estadoPrioridad,
  camara: { x: 5, y: 0, k: 1 },
});
prioridad.renderer.render(2001);
const selectedDespues = ultimaEtiqueta(prioridad.capas[1], 'Selected');
p.igual('una etiqueta visible antes de un pan pequeño permanece y se desplaza exactamente 5 px',
  selectedDespues && selectedAntes ? [selectedDespues.rect.x - selectedAntes.rect.x, selectedDespues.rect.y] : null,
  [5, selectedAntes ? selectedAntes.rect.y : null]);
prioridad.renderer.destroy();

const datosCulling = {
  nodos: [
    { id: 'hit-a', titulo: 'A', capa: 0, tema: 'red' },
    { id: 'hit-b', titulo: 'B', capa: 1, tema: 'red' },
  ],
  aristas: [['hit-a', 'hit-b', 'relación exacta']],
  capas: [['a', 'A'], ['b', 'B']],
  temas: { red: ['Red'] },
};
const viewportCulling = { width: 640, height: 300 };
const escenaCulling = layoutCapas(datosCulling, viewportCulling, { orden: 'auto' });
const culling = crearRenderer(datosCulling, viewportCulling, {
  modo: 'capas', camara: { x: 0, y: 0, k: 1 }, seleccion: 'hit-b', ruta: [],
});
culling.renderer.render(3000);
const nodoA = escenaCulling.nodes.find((node) => node.id === 'hit-a');
const nodoB = escenaCulling.nodes.find((node) => node.id === 'hit-b');
p.igual('el hit del nodo seleccionado usa exactamente su centro', culling.renderer.hitTest(nodoB.x, nodoB.y),
  { tipo: 'nodo', id: 'hit-b', distancia: 0 });
const aristaCulling = escenaCulling.edges.find((edge) => edge.a === 'hit-a' && edge.b === 'hit-b');
const puntoArista = { x: (nodoA.x + nodoB.x) / 2, y: (nodoA.y + nodoB.y) / 2 };
const hitArista = culling.renderer.hitTest(puntoArista.x, puntoArista.y);
p.igual('el hit en el punto conocido devuelve exactamente la arista seleccionada',
  [hitArista && hitArista.tipo, hitArista && hitArista.id, hitArista && hitArista.a, hitArista && hitArista.b],
  ['arista', aristaCulling.id, 'hit-a', 'hit-b']);

const inicioPan = culling.capas[1].foreground.arc.length;
const inicioCurvas = culling.capas[0].foreground.bezierCurveTo.length;
const inicioTexto = culling.capas[1].foreground.strokeText.length;
culling.renderer.setGraph(datosCulling, {
  modo: 'capas', camara: { x: 5000, y: 0, k: 1 }, seleccion: 'hit-b', ruta: [],
});
culling.renderer.render(3001);
p.igual('tras el pan ningún nodo fuera del viewport se dibuja',
  culling.capas[1].foreground.arc.slice(inicioPan), []);
p.igual('tras el pan ninguna arista fuera del viewport se dibuja',
  culling.capas[0].foreground.bezierCurveTo.slice(inicioCurvas), []);
p.igual('tras el pan ninguna etiqueta fuera del viewport se dibuja',
  culling.capas[1].foreground.strokeText.slice(inicioTexto), []);
p.igual('un nodo fuera del viewport no se puede acertar en sus coordenadas transformadas',
  culling.renderer.hitTest(nodoA.x + 5000, nodoA.y), null);
p.igual('un punto visible del viewport no activa un nodo culled', culling.renderer.hitTest(320, 150), null);
culling.renderer.destroy();

const datosRadiales = {
  nodos: [
    { id: 'root', titulo: 'Root', capa: 0, tema: 'radial' },
    { id: 'ring-1', titulo: 'Depth 1', capa: 0, tema: 'radial' },
    { id: 'ring-2-a', titulo: 'Depth 2 A', capa: 0, tema: 'radial' },
    { id: 'ring-2-b', titulo: 'Depth 2 B', capa: 0, tema: 'radial' },
    { id: 'ring-3-a', titulo: 'Depth 3 A', capa: 0, tema: 'radial' },
    { id: 'ring-3-b', titulo: 'Depth 3 B', capa: 0, tema: 'radial' },
    { id: 'ring-4-a', titulo: 'Depth 4 A', capa: 0, tema: 'radial' },
    { id: 'ring-4-b', titulo: 'Depth 4 B', capa: 0, tema: 'radial' },
    { id: 'isolated', titulo: 'Isolated', capa: 0, tema: 'radial' },
  ],
  aristas: [
    ['root', 'ring-1', 'one'],
    ['ring-1', 'ring-2-a', 'two-a'],
    ['ring-1', 'ring-2-b', 'two-b'],
    ['ring-2-a', 'ring-3-a', 'three-a'],
    ['ring-2-a', 'ring-3-b', 'three-b'],
    ['ring-3-a', 'ring-4-a', 'four-a'],
    ['ring-3-a', 'ring-4-b', 'four-b'],
  ],
  capas: [['radial', 'Radial']],
  temas: { radial: ['Radial'] },
};
const anillosEsperados = [
  ['root'],
  ['ring-1'],
  ['ring-2-a', 'ring-2-b'],
  ['ring-3-a', 'ring-3-b'],
  ['ring-4-a', 'ring-4-b'],
];
for (let profundidad = 1; profundidad <= 4; profundidad++) {
  const radial = layoutRadial(datosRadiales, 'root', { width: 1200, height: 800 }, {
    profundidad,
    presupuestoAnillos: 20,
  });
  p.igual(`radial ${profundidad}: las profundidades BFS son exactamente 0..${profundidad}`,
    radial.rings.map((ring) => ring.depth), Array.from({ length: profundidad + 1 }, (_, i) => i));
  p.igual(`radial ${profundidad}: cada anillo contiene exactamente sus nodos BFS`,
    radial.rings.map((ring) => ring.ids), anillosEsperados.slice(0, profundidad + 1));
  p.igual(`radial ${profundidad}: no omite nodos con el presupuesto de prueba`,
    radial.omitted.size, 0);
}

const estadoNormalEsperado = {
  modo: 'capas',
  camara: { x: 0, y: 0, k: 1 },
  filtro: '',
  temas: [],
  capas: [],
  rangoGrado: { min: 0, max: null },
  actividadDias: 0,
  soloExternas: false,
  soloLargoAlcance: false,
  colapsados: [],
  seleccion: null,
  sobre: null,
  ruta: [],
  panel: null,
  temaVisual: 'tema',
};
let normalMalformado;
let errorNormalizacion = null;
try {
  normalMalformado = normalizarEstado({
    modo: 'satélite',
    camara: { x: 'horizontal', y: null, k: 99 },
    filtro: 42,
    temas: ['alpha', ' alpha ', 'alpha', 'unknown'],
    capas: ['2', '1', 0, 0, -4, 'bad'],
    rangoGrado: 'rango inválido',
    actividadDias: 17,
    soloExternas: 'sí',
    soloLargoAlcance: 1,
    colapsados: ['beta', 'beta', 'unknown'],
    seleccion: 'node-eliminado',
    ruta: Array.from({ length: 2001 }, (_, i) => `node-${String(i % 1200).padStart(4, '0')}`),
    panel: 'inventado',
    temaVisual: 'arcoíris',
  }, { datos: fixture });
} catch (error) {
  errorNormalizacion = error;
}
p.igual('un estado guardado malformado no lanza excepciones', errorNormalizacion, null);
p.igual('un estado guardado malformado conserva sólo filtros válidos y IDs conocidos',
  normalMalformado, {
    ...estadoNormalEsperado,
    camara: { x: 0, y: 0, k: 6 },
    temas: ['alpha'],
    capas: [0, 1],
    colapsados: ['beta'],
  });
p.igual('un valor guardado que no es objeto se reemplaza por el estado por defecto',
  normalizarEstado('estado roto', { datos: fixture }), estadoNormalEsperado);
p.igual('null se reemplaza por el estado por defecto sin lanzar',
  normalizarEstado(null, { datos: fixture }), estadoNormalEsperado);

process.exitCode = p.cerrar() ? 1 : 0;
