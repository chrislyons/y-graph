/* Regresión de rendimiento y recursos: 5.000 notas, 17.500 enlaces y APIs públicas. */
const assert = require('assert');
const { performance } = require('node:perf_hooks');
const { cargarPlugin, vaultSimulado } = require('./simulado.cjs');

const { GraphStore, GraphRenderer, layoutCapas, AJUSTES_BASE, edgeId } = cargarPlugin(process.argv[2]).interno;
const NOTAS = 5000;
const ARISTAS = 17500;
const MUESTRAS_BUILD = 5;
const MUESTRAS_RENDER = 5;
const MUESTRAS_INTERACCION = 10;
const MUESTRAS_HIT = 5;
const MAX_PENDIENTES = 1;

const metodo = () => {};
function contextoFalso() {
  const contexto = { measureText: (text) => ({ width: String(text).length * 6 }) };
  for (const name of [
    'beginPath', 'moveTo', 'lineTo', 'arc', 'fill', 'stroke', 'fillRect', 'strokeRect',
    'setLineDash', 'bezierCurveTo', 'save', 'restore', 'translate', 'scale', 'clearRect',
    'fillText', 'closePath', 'quadraticCurveTo', 'setTransform', 'resetTransform', 'rotate',
    'clip', 'rect', 'roundRect', 'arcTo', 'ellipse', 'drawImage', 'strokeText',
  ]) contexto[name] = metodo;
  return contexto;
}

function canvasFalso() {
  const ctx = contextoFalso();
  return { width: 0, height: 0, ctx, getContext: (type) => type === '2d' ? ctx : null };
}

function crearFixture() {
  const destinos = Array.from({ length: NOTAS }, () => []);
  const pares = new Set();
  const agregar = (a, b, indice) => {
    if (a === b) return;
    const id = edgeId(`notas/nota-${String(a).padStart(5, '0')}.md`, `notas/nota-${String(b).padStart(5, '0')}.md`);
    assert(!pares.has(id), `la fixture duplicó el enlace ${id}`);
    pares.add(id);
    destinos[a].push({ b, indice });
  };

  for (let i = 0; i < NOTAS; i++) agregar(i, (i + 1) % NOTAS, i);
  for (let i = 0; i < ARISTAS - NOTAS; i++) {
    const origen = i % NOTAS;
    const separacion = 2 + Math.floor(i / NOTAS);
    agregar(origen, (origen + separacion) % NOTAS, NOTAS + i);
  }

  const notas = Object.create(null);
  for (let i = 0; i < NOTAS; i++) {
    const nombre = `nota-${String(i).padStart(5, '0')}`;
    const cuerpo = destinos[i].map(({ b, indice }) => {
      const destino = `nota-${String(b).padStart(5, '0')}`;
      return `- [[${destino}]] — relación determinista ${indice}`;
    }).join('\n');
    notas[`notas/${nombre}.md`] = [
      '---',
      `title: Nota ${String(i).padStart(5, '0')}`,
      `tema: tema-${i % 8}`,
      '---',
      cuerpo,
    ].join('\n');
  }
  assert.strictEqual(pares.size, ARISTAS, 'la fixture no produjo exactamente 17.500 enlaces únicos');
  return { notas, pares };
}

function percentile(valores, porcentaje) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const posicion = (ordenados.length - 1) * porcentaje;
  const bajo = Math.floor(posicion);
  const alto = Math.ceil(posicion);
  const peso = posicion - bajo;
  return ordenados[bajo] * (1 - peso) + ordenados[alto] * peso;
}

const milisegundos = (valor) => `${valor.toFixed(3)} ms`;

function imprimir(nombre, valores, detalle = '') {
  console.log(`${nombre}: mediana ${milisegundos(percentile(valores, 0.5))}; p95 ${milisegundos(percentile(valores, 0.95))}${detalle ? ` (${detalle})` : ''}`);
}

function medir(fn) {
  const inicio = performance.now();
  const resultado = fn();
  return { duracion: performance.now() - inicio, resultado };
}

async function medirAsync(fn) {
  const inicio = performance.now();
  const resultado = await fn();
  return { duracion: performance.now() - inicio, resultado };
}

(async () => {
  const fixture = crearFixture();
  const simulacion = vaultSimulado(fixture.notas);
  const app = simulacion.app;
  const archivos = app.vault.getMarkdownFiles().map((file, index) => ({
    ...file,
    stat: { mtime: 1700000000000 + index },
  }));
  app.vault.getMarkdownFiles = () => archivos;
  const ajustes = {
    ...AJUSTES_BASE,
    capas: 'Rendimiento | fixture determinista',
    carpetas: 'notas = 0',
    temas: Array.from({ length: 8 }, (_, i) => `tema-${i} = Tema ${i}`).join('\n'),
    excluir: '',
    fuentes: 'no',
  };

  let datos = null;
  const tiemposBuild = [];
  for (let muestra = 0; muestra < MUESTRAS_BUILD; muestra++) {
    const store = new GraphStore();
    const medicion = await medirAsync(() => store.rebuild(app, ajustes));
    tiemposBuild.push(medicion.duracion);
    assert.strictEqual(medicion.resultado.nodos.length, NOTAS, 'GraphStore no produjo 5.000 nodos');
    assert.strictEqual(medicion.resultado.aristas.length, ARISTAS, 'GraphStore no produjo 17.500 aristas');
    if (!datos) datos = medicion.resultado;
    store.clear();
  }

  const layoutPublico = layoutCapas(datos, { width: 1440, height: 900 }, { orden: 'auto' });
  assert.strictEqual(layoutPublico.nodes.length, NOTAS, 'layoutCapas no layouteó los 5.000 nodos');
  assert.strictEqual(layoutPublico.edges.length, ARISTAS, 'layoutCapas no layouteó los 17.500 enlaces');

  const estadoBase = { modo: 'capas', camara: { x: 0, y: 0, k: 1 }, ruta: [] };
  const crearRenderer = (fabrica = canvasFalso) => {
    const renderer = new GraphRenderer(canvasFalso(), {
      path2D: null,
      medirTexto: (text) => ({ width: String(text).length * 6 }),
      preferencias: { ordenCapas: 'auto', crearCanvas: fabrica },
    });
    renderer.setViewport({ width: 1440, height: 900, dpr: 1 });
    return renderer;
  };

  const tiemposPrimerRender = [];
  for (let muestra = 0; muestra < MUESTRAS_RENDER; muestra++) {
    const renderer = crearRenderer();
    const medicion = medir(() => {
      renderer.setGraph(datos, estadoBase);
      renderer.render(1000 + muestra);
    });
    tiemposPrimerRender.push(medicion.duracion);
    assert(renderer.scene && renderer.scene.nodes.length === NOTAS, 'el primer render no indexó los 5.000 nodos');
    assert.strictEqual(renderer.scene.edges.length, ARISTAS, 'el primer render no indexó los 17.500 enlaces');
    renderer.destroy();
  }

  let lienzosCreados = 0;
  const renderer = crearRenderer(() => { lienzosCreados++; return canvasFalso(); });
  medir(() => {
    renderer.setGraph(datos, estadoBase);
    renderer.render(2000);
  });
  assert.strictEqual(lienzosCreados, 2, 'el renderizador no reutiliza exactamente dos canvas fuera de pantalla');

  renderer.preferencias.pointerDown = false;
  renderer.preferencias.wheelActive = false;
  renderer.preferencias.wheelUntil = 0;
  const tiemposPan = [];
  for (let muestra = 0; muestra < MUESTRAS_INTERACCION; muestra++) {
    const estado = {
      ...estadoBase,
      camara: { x: 17 + muestra * 11, y: -23 + muestra * 7, k: 1 },
    };
    const medicion = medir(() => {
      renderer.setGraph(datos, estado);
      renderer.render(3000 + muestra);
    });
    tiemposPan.push(medicion.duracion);
  }

  const tiemposZoom = [];
  for (let muestra = 0; muestra < MUESTRAS_INTERACCION; muestra++) {
    const escala = 0.75 + muestra * 0.12;
    const estado = { ...estadoBase, camara: { x: 9, y: -6, k: escala } };
    const medicion = medir(() => {
      renderer.setGraph(datos, estado);
      renderer.render(4000 + muestra);
    });
    tiemposZoom.push(medicion.duracion);
  }
  renderer.setGraph(datos, estadoBase);
  renderer.render(5000);
  const objetivos = renderer.scene.nodes;
  const primerObjetivo = objetivos[0];
  assert.strictEqual(renderer.hitTest(primerObjetivo.x, primerObjetivo.y)?.id, primerObjetivo.id,
    'el punto de control del hit test no alcanza el nodo esperado');
  const tiemposHit = [];
  let aciertos = 0;
  for (let muestra = 0; muestra < MUESTRAS_HIT; muestra++) {
    const medicion = medir(() => {
      let acumulado = 0;
      for (let i = 0; i < 1000; i++) {
        const nodo = objetivos[(i + muestra * 137) % objetivos.length];
        const golpe = renderer.hitTest(nodo.x, nodo.y);
        if (golpe) { acumulado += golpe.id.length + golpe.distancia; aciertos++; }
      }
      return acumulado;
    });
    assert(Number.isFinite(medicion.resultado), 'los hit tests no consumieron una geometría válida');
    tiemposHit.push(medicion.duracion);
  }
  assert.strictEqual(aciertos, MUESTRAS_HIT * 1000, 'los 1.000 hit tests por muestra deben alcanzar un elemento visible');

  let maxPendientes = renderer._pendingFrames;
  for (let i = 0; i < 10000; i++) {
    renderer.invalidate();
    maxPendientes = Math.max(maxPendientes, renderer._pendingFrames);
  }
  assert(maxPendientes <= MAX_PENDIENTES, `la cola de frames creció sin límite a ${maxPendientes}`);
  assert.strictEqual(renderer._pendingFrames, 0, 'invalidate no debe encolar un frame duplicado');
  renderer.render(6000);
  assert.strictEqual(renderer._pendingFrames, 0, 'quedaron frames pendientes después del render');
  assert.strictEqual(renderer._dirtyBackground, false, 'la capa de fondo quedó sucia después de renderizar');
  console.log('umbrales numéricos de regresión: NO VERIFICADOS; se requieren ejecuciones de calibración en macOS objetivo, CI y navegador headless antes de fijar límites.');

  renderer.destroy();
  assert.deepStrictEqual([
    renderer.canvas,
    renderer.ctx,
    renderer._backgroundCanvas,
    renderer._backgroundCtx,
    renderer._foregroundCanvas,
    renderer._foregroundCtx,
    renderer.scene,
    renderer._pendingFrames,
  ], [null, null, null, null, null, null, null, 0], 'destroy retuvo canvas, contexts o escena del renderizador');
  assert.strictEqual(renderer.hitTest(0, 0), null, 'el renderizador destruido todavía procesa hit tests');

  console.log('rendimiento: fixture 5.000 nodos / 17.500 enlaces');
  imprimir('GraphStore.rebuild', tiemposBuild, `${MUESTRAS_BUILD} reconstrucciones frías`);
  imprimir('primer render', tiemposPrimerRender, 'setGraph + render inicial');
  imprimir('pan asentado', tiemposPan, 'curvas restauradas');
  imprimir('zoom asentado', tiemposZoom, 'curvas restauradas');
  imprimir('hit tests', tiemposHit, 'mediana/p95 por lote de 1.000');
  console.log(`recursos: ${aciertos} hit tests found; ${lienzosCreados} canvas fuera de pantalla; máximo pendiente ${maxPendientes}; destroy liberó todos los canvas`);
  console.log('umbrales numéricos de regresión: NO VERIFICADOS; se requierenRuns de calibración en macOS objetivo, CI y navegador headless antes de fijar límites.');
})().catch((error) => {
  console.error('rendimiento: FAIL');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
