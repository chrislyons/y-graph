/* Contrato del motor de escenas: orden estable, etiquetas, Canvas mínimo, hit spatial y limpieza. */
const { cargarPlugin, pruebas } = require('./simulado.cjs');
const { interno } = cargarPlugin(process.argv[2]);
const { layoutCapas, layoutRadial, GraphRenderer } = interno;
const p = pruebas('render');

const nodo = (id, capa, titulo, extra = {}) => ({ id, capa, titulo, tema: 'tema', grado: 0, ...extra });
const arista = (a, b, motivo = '') => [a, b, motivo];
const datosCapas = {
  nodos: [
    nodo('a1', 0, 'AMX2'), nodo('a2', 0, 'AMX10'), nodo('a3', 0, 'AMX1'),
    nodo('b1', 1, 'B comparador'), nodo('b2', 1, 'B enlazado'),
    nodo('c1', 2, 'C terminal', { hub: true }), nodo('raw:paper', 0, 'raw:paper', { fuente: true }),
    nodo('high', 2, 'Alto grado', { grado: 5, updated: '2025-01-01' }),
  ],
  aristas: [arista('a2', 'b2', 'relación'), arista('a1', 'b1'), arista('b1', 'c1')],
  capas: [['e', 'Entrada'], ['b', 'Notas'], ['t', 'Terminales']],
  temas: { tema: ['Tema', '#5B95FF'] },
};

const autoA = layoutCapas(datosCapas, { width: 1000, height: 700 }, { orden: 'auto' });
const autoB = layoutCapas(datosCapas, { width: 1000, height: 700 }, { orden: 'auto' });
p.igual('la misma entrada produce exactamente el mismo orden y coordenadas', autoA, autoB);
const cruce = layoutCapas({
  nodos: [nodo('a1', 0, 'A1'), nodo('a2', 0, 'A2'), nodo('linked', 1, 'Linked'), nodo('comparator', 1, 'Comparator')],
  aristas: [arista('a2', 'linked')], capas: [['a', 'A'], ['b', 'B']], temas: {},
}, { width: 1000, height: 700 }, { orden: 'auto' });
p.igual('las seis pasadas ponderadas bajan el nodo enlazado frente al comparador',
  cruce.nodes.filter((n) => n.capa === 1).map((n) => n.id), ['comparator', 'linked']);
const curvasMismas = layoutCapas({
  nodos: [nodo('s1', 0, 'S1'), nodo('s2', 0, 'S2'), nodo('t1', 1, 'T1')],
  aristas: [arista('s1', 's2'), arista('s2', 't1')], capas: [['u', 'Única'], ['v', 'Siguiente']], temas: {},
}, { width: 900, height: 600 }, { orden: 'auto' });
p.igual('la escena conserva los dos criss-cross de curva', [curvasMismas.edges.map((edge) => edge.kind).sort(), curvasMismas.edges.every((edge) => Number.isFinite(edge.c1x) && Number.isFinite(edge.c2y) && edge.bounds.minX <= edge.bounds.maxX)],
  [['cross', 'same'], true]);

const alfabeto = layoutCapas(datosCapas, { width: 1000, height: 700 }, { orden: 'alfabetico' });
p.igual('el orden alfabético usa comparación natural numérica',
  alfabeto.nodes.filter((n) => n.capa === 0 && !n.fuente).map((n) => n.titulo), ['AMX1', 'AMX2', 'AMX10']);
const datosRecientes = {
  nodos: [
    nodo('viejo', 0, 'B', { updated: '2024-01-01' }), nodo('nuevo', 0, 'D', { updated: '2025-01-01' }),
    nodo('igual', 0, 'A', { updated: '2025-01-01' }),
  ], aristas: [], capas: [['u', 'Única']], temas: {},
};
p.igual('reciente ordena fecha descendente, título natural e ID',
  layoutCapas(datosRecientes, { width: 800, height: 600 }, { orden: 'reciente' }).orderedIds, ['igual', 'nuevo', 'viejo']);

const conPanel = layoutCapas(datosCapas, { width: 1000, height: 700 }, { orden: 'auto', reservaPanel: 360 });
p.igual('reservar panel cambia el transform, no posiciones ni orden', conPanel.nodes.map((n) => [n.id, n.x, n.y]),
  autoA.nodes.map((n) => [n.id, n.x, n.y]));

const datosRadiales = {
  nodos: [nodo('foco', 0, 'Foco'), ...Array.from({ length: 5 }, (_, i) => nodo(`d${i}`, 0, `Depth ${i}`)), nodo('lejos', 0, 'Lejos')],
  aristas: [arista('foco', 'd0'), arista('d0', 'd1'), arista('d1', 'd2'), arista('d2', 'd3'), arista('d3', 'd4'), arista('d1', 'lejos')],
  capas: [['r', 'Radial']], temas: {},
};
for (const depth of [1, 2, 3, 4]) {
  const radial = layoutRadial(datosRadiales, 'foco', { width: 1200, height: 800 }, { profundidad: depth, presupuestoAnillos: 20 });
  p.igual(`radial ${depth} contiene exactamente BFS hasta esa profundidad`, radial.rings.map((ring) => ring.ids),
    [[['foco'], ['d0']], [['foco'], ['d0'], ['d1']], [['foco'], ['d0'], ['d1'], ['d2', 'lejos']], [['foco'], ['d0'], ['d1'], ['d2', 'lejos'], ['d3']]][depth - 1]);
}
const radialOrdenado = layoutRadial({
  nodos: [nodo('f', 0, 'F', { tema: 'b' }), nodo('z', 0, 'Z', { tema: 'a' }), nodo('a', 0, 'A', { tema: 'a' })],
  aristas: [arista('f', 'z'), arista('f', 'a')], capas: [], temas: { a: ['A'], b: ['B'] },
}, 'f', { width: 900, height: 700 }, { profundidad: 1 });
p.igual('radial ordena por tema y después por ID', radialOrdenado.rings[1].ids, ['a', 'z']);
const radialBudget = layoutRadial({
  nodos: [nodo('foco', 0, 'Foco'), nodo('d0', 0, 'D0'), nodo('d1', 0, 'D1'), nodo('d2', 0, 'D2'), nodo('d3', 0, 'D3')],
  aristas: [arista('foco', 'd0'), arista('d0', 'd1'), arista('d0', 'd2'), arista('d0', 'd3')],
  capas: [], temas: {},
}, 'foco', { width: 1200, height: 800 }, { profundidad: 2, presupuestoAnillos: 1, estado: { seleccion: 'd1' } });
p.cierto('el presupuesto radial conserva selección y registra omitidas', radialBudget.omitted.has('d2') && radialBudget.rings[2].visibleIds.includes('d1'));

function contextoFalso() {
  const ctx = { llamadas: [], bezier: 0, line: 0 };
  const registra = (name) => () => { ctx.llamadas.push(name); if (name === 'bezierCurveTo') ctx.bezier++; if (name === 'lineTo') ctx.line++; };
  for (const name of ['beginPath', 'moveTo', 'lineTo', 'arc', 'fill', 'stroke', 'fillRect', 'strokeRect', 'setLineDash', 'bezierCurveTo', 'save', 'restore', 'translate', 'scale', 'clearRect', 'fillText', 'closePath', 'quadraticCurveTo', 'setTransform', 'resetTransform', 'drawImage', 'strokeText']) ctx[name] = registra(name);
  ctx.measureText = (text) => ({ width: String(text).length * 6 });
  return ctx;
}
function canvasFalso() {
  const ctx = contextoFalso();
  return { width: 0, height: 0, ctx, getContext(type) { return type === '2d' ? ctx : null; } };
}

const anterioresPath = global.Path2D;
global.Path2D = undefined;
const creados = [];
const principal = canvasFalso();
const renderer = new GraphRenderer(principal, {
  medirTexto: (text) => ({ width: String(text).length * 5 }),
  paleta: { bg: '#fff', text: '#000' },
  preferencias: { ordenCapas: 'auto', crearCanvas: () => { const canvas = canvasFalso(); creados.push(canvas); return canvas; } },
});
renderer.setViewport({ width: 1000, height: 700, dpr: 1 });
const estadoInicial = { modo: 'capas', camara: { x: 0, y: 0, k: 1 }, ruta: [] };
renderer.setGraph(datosCapas, estadoInicial);
const escenaCache = renderer.scene;
renderer.render(1000);
p.igual('el render crea exactamente dos capas fuera de pantalla', creados.length, 2);
p.cierto('Path2D ausente usa las primitivas de curva del contexto', renderer.scene.edges.every((edge) => edge.path === null)
  && renderer._backgroundCtx.bezier > 0);
const nodoA = renderer.scene.nodes.find((n) => n.id === 'a2');
const nodoB = renderer.scene.nodes.find((n) => n.id === 'b2');
p.igual('el hit del nodo usa centro y radio exactos', renderer.hitTest(nodoA.x, nodoA.y), { tipo: 'nodo', id: 'a2', distancia: 0 });
const aristaAB = renderer.scene.edges.find((edge) => edge.a === 'a2' && edge.b === 'b2');
p.igual('el hit de arista devuelve la arista exacta', [renderer.hitTest((nodoA.x + nodoB.x) / 2, (nodoA.y + nodoB.y) / 2).tipo, aristaAB.id],
  ['arista', aristaAB.id]);

const etiquetasDesktop = renderer.scene.labelPlacements;
p.cierto('la etiqueta respeta el presupuesto desktop', etiquetasDesktop.length <= Math.floor(1000 * 700 / 9000));
p.cierto('los encabezados de capa se reservan antes que las etiquetas', renderer.scene.layers.every((layer) => {
  const heading = { x: layer.x - 4, y: layer.y0 - 28, w: String(layer.nombre).length * 5 + 8, h: 18 };
  return etiquetasDesktop.every((label) => label.rect.x + label.rect.w <= heading.x || label.rect.x >= heading.x + heading.w
    || label.rect.y + label.rect.h <= heading.y || label.rect.y >= heading.y + heading.h);
}));
p.cierto('las etiquetas colocadas no colisionan', etiquetasDesktop.every((a, i) => etiquetasDesktop.slice(i + 1).every((b) => a.rect.x + a.rect.w <= b.rect.x || a.rect.x >= b.rect.x + b.rect.w
  || a.rect.y + a.rect.h <= b.rect.y || a.rect.y >= b.rect.y + b.rect.h)));

const datosMovil = {
  nodos: Array.from({ length: 120 }, (_, i) => nodo(`m${i}`, 0, `Mobile ${i}`)),
  aristas: [], capas: [['m', 'Mobile']], temas: {},
};
const rendererMovil = new GraphRenderer(canvasFalso(), { medirTexto: (text) => ({ width: String(text).length * 5 }), preferencias: { crearCanvas: canvasFalso } });
rendererMovil.setViewport({ width: 390, height: 844, dpr: 1 }).setGraph(datosMovil, { modo: 'capas', camara: { x: 0, y: 0, k: 1 } });
rendererMovil.render(1000);
p.igual('el presupuesto mobile usa área/13000 acotada', rendererMovil.scene.labelBudget, 25);
p.cierto('el presupuesto mobile nunca se excede', rendererMovil.scene.labelPlacements.length <= 25);
const datosEscenaGrande = {
  nodos: Array.from({ length: 600 }, (_, i) => nodo(`g${i}`, 0, `Grande ${i}`)),
  aristas: [], capas: [['g', 'Grande']], temas: {},
};
rendererMovil.setViewport({ width: 1000, height: 700, dpr: 1 }).setGraph(datosEscenaGrande, { modo: 'capas', camara: { x: 0, y: 0, k: 1 } });
rendererMovil.render(1000);
p.igual('una capa de 600 nodos usa el presupuesto desktop exacto', rendererMovil.scene.labelBudget, 77);
p.cierto('una capa de 600 nodos no excede el presupuesto desktop', rendererMovil.scene.labelPlacements.length <= 77);
rendererMovil.destroy();

const estadoPrioridad = { ...estadoInicial, seleccion: 'a3', ruta: ['a1', 'b1'], focoTeclado: 'a2', filtro: 'B enlazado' };
renderer.setGraph(datosCapas, estadoPrioridad);
renderer.render(1001);
p.cierto('setGraph con la misma identidad conserva la escena estable', renderer.scene === escenaCache);
const prioridades = new Map(renderer.scene.labelPlacements.map((label) => [label.id, label.priority]));
p.igual('selección, ruta, foco, búsqueda, hub y grado alto conservan su prioridad',
  [prioridades.get('a3'), prioridades.get('a1'), prioridades.get('a2'), prioridades.get('b2'), prioridades.get('c1'), prioridades.get('high')],
  [0, 1, 2, 3, 4, 5]);

const rectAntes = renderer.scene.labelPlacements.find((label) => label.id === 'a3')?.rect;
renderer.setGraph(datosCapas, { ...estadoPrioridad, camara: { x: 5, y: 0, k: 1 } });
renderer.render(1002);
const rectDespues = renderer.scene.labelPlacements.find((label) => label.id === 'a3')?.rect;
p.cierto('un pan chico conserva la etiqueta con histéresis', !!(rectAntes && rectDespues
  && Math.abs(rectDespues.x - (rectAntes.x + 5)) < 0.001));

const fillsAntes = renderer._backgroundCtx.llamadas.filter((name) => name === 'fill').length;
renderer.setGraph(datosCapas, { ...estadoPrioridad, camara: { x: 2000, y: 0, k: 1 } });
renderer.render(1003);
p.igual('un nodo culled fuera del viewport no es hit', renderer.hitTest(2000, 350), null);
p.igual('un nodo culled fuera del viewport no se pinta', renderer._backgroundCtx.llamadas.filter((name) => name === 'fill').length, fillsAntes);

renderer.setGraph(datosCapas, estadoInicial);
const rectasAntes = renderer._backgroundCtx.line;
renderer.preferencias.pointerDown = true;
renderer.render(1004);
p.cierto('pointer-down dibuja LOD recto', renderer._backgroundCtx.line > rectasAntes);
renderer.preferencias.pointerDown = false;
const curvasAntes = renderer._backgroundCtx.bezier;
renderer.render(1125);
p.cierto('tras 120 ms vuelve la curva', renderer._backgroundCtx.bezier > curvasAntes);
renderer.preferencias.wheelUntil = 2000;
renderer.render(1126);
p.cierto('wheel activo también fuerza LOD recto', renderer._lastLowDetail === true);
renderer.preferencias.wheelUntil = 0;

const exportFrame = renderer.frameForExport({ width: 640, height: 480, dpr: 2, modoPresentacion: true });
p.igual('frameForExport devuelve un canvas fresco con dimensiones lógicas', [exportFrame.width, exportFrame.height, exportFrame.canvas.width, exportFrame.canvas.height], [640, 480, 1280, 960]);
p.cierto('frameForExport no reemplaza las capas internas', renderer._backgroundCanvas === creados[0] && renderer._foregroundCanvas === creados[1]);
p.igual('no existe una cola duplicada de frames', renderer._pendingFrames, 0);
renderer.destroy();
p.igual('destroy libera contexts, canvases y escena', [renderer.canvas, renderer.ctx, renderer.scene, renderer._backgroundCanvas,renderer._foregroundCanvas], [null, null, null, null, null]);
global.Path2D = anterioresPath;

process.exitCode = p.cerrar() ? 1 : 0;
