/* Contrato de exportaciones deterministas: alcances, CSV, SVG/HTML, PNG y escrituras seguras. */
const { cargarPlugin, pruebas } = require('./simulado.cjs');
const { interno } = cargarPlugin(process.argv[2]);
const {
  datosExportables,
  crearPNG,
  crearSVG,
  crearHTML,
  crearJSON,
  crearCSV,
  exportarVista,
} = interno;
const p = pruebas('exports');

const FECHA = new Date('2026-09-25T12:00:00Z');
const GRAFO = {
  nodos: [
    { id: 'a.md', titulo: 'Alpha <& "rare"', capa: 0, tema: 't1', propio: true, grado: 2, updated: '2026-09-25' },
    { id: 'b.md', titulo: 'Beta & C', capa: 1, tema: 't1', propio: true, grado: 2, updated: '2026-09-24' },
    { id: 'c.md', titulo: 'Gamma', capa: 1, tema: 't2', propio: true, grado: 1, updated: '2026-09-20' },
    { id: 'raw:paper.md', ruta: 'raw/paper.md', titulo: 'Fuente <&>', capa: 0, fuente: true, rota: false, grado: 1 },
  ],
  aristas: [
    ['a.md', 'b.md', 'soporta, "sí"\nsegunda', { origen: 'a.md', destino: 'b.md', texto: 'frase, "literal"\nlínea', linea: 7 }],
    ['a.md', 'c.md', '', null, { origen: 'a.md', linea: 11 }],
    ['a.md', 'raw:paper.md', 'fuente citada en la página', null, { origen: 'a.md', linea: 3 }],
    ['b.md', 'a.md'],
  ],
  capas: [['e', 'Entrada <raw>', 'lo que entra'], ['s', 'Síntesis & decisiones', 'lo que sale']],
  temas: { t1: ['Tema & uno', '#2563eb'], t2: ['Tema dos', '#16a34a'] },
  contexto: { profundidadRadial: 2 },
};
const ESTADO = {
  modo: 'capas', camara: { x: 25, y: -10, k: 1.5 }, capas: [1], rangoGrado: { min: 0, max: null },
  actividadDias: 0, seleccion: 'a.md', ruta: [],
};
const ESCENA = {
  nodes: [
    { id: 'a.md', x: 100, y: 80, radio: 7, kind: 'note' },
    { id: 'b.md', x: 340, y: 120, radio: 7, kind: 'note' },
    { id: 'c.md', x: 340, y: 200, radio: 7, kind: 'note' },
    { id: 'raw:paper.md', x: 100, y: 180, radio: 7, kind: 'source' },
  ],
  edges: [
    { a: 'a.md', b: 'b.md', c1x: 180, c1y: 80, c2x: 260, c2y: 120, motivo: 'sí' },
    { a: 'a.md', b: 'c.md', c1x: 180, c1y: 80, c2x: 260, c2y: 200 },
    { a: 'a.md', b: 'raw:paper.md', c1x: 100, c1y: 120, c2x: 100, c2y: 150, motivo: 'fuente' },
  ],
  layers: [{ x: 80, y0: 50, y1: 240, nombre: 'Entrada <raw>' }, { x: 320, y0: 50, y1: 240, nombre: 'Síntesis & decisiones' }],
};

async function main() {

const visible = datosExportables(GRAFO, 'visible', { estado: ESTADO, ahora: FECHA });
const focused = datosExportables(GRAFO, 'focused', { estado: ESTADO, ahora: FECHA });
const all = datosExportables(GRAFO, 'all', { estado: ESTADO, ahora: FECHA });
p.igual('visible usa exactamente la predicción normalizada', [visible.alcance, visible.nodos.map((n) => n.id), visible.fuentes.map((n) => n.id)], ['visible', ['b.md', 'c.md'], []]);
p.igual('focused incluye selección, vecinos BFS y aristas inducidas', [focused.alcance, focused.fuentes.map((n) => n.id), focused.enlaces.map((e) => [e.origen, e.destino])], ['focused', ['raw:paper.md'], [['a.md', 'b.md'], ['a.md', 'c.md'], ['a.md', 'raw:paper.md']]]);
p.igual('all ignora filtros y conserva IDs de fuentes', [all.alcance, all.nodos.length, all.fuentes.map((n) => n.id), all.enlaces.length], ['all', 3, ['raw:paper.md'], 3]);
p.igual('cada artefacto usa el mismo alcance que sus datos', [crearJSON(visible, { ahora: FECHA }).includes('"alcance": "visible"'), focused.enlaces.length, all.resumen.aristas], [true, 3, 3]);
p.igual('el resumen y las métricas cuentan el alcance real', [visible.resumen.nodos, visible.resumen.enlaces, visible.metricas.mapa.notas, visible.metricas.mapa.enlaces], [2, 0, 2, 0]);
const visibleFuentes = datosExportables(GRAFO, 'visible', { estado: { ...ESTADO, capas: [] }, ahora: FECHA });
p.igual('visible conserva fuentes filtradas y solo aristas inducidas', [visibleFuentes.fuentes.map((n) => n.id), visibleFuentes.enlaces.length], [['raw:paper.md'], 3]);

const json = crearJSON(all, { ahora: FECHA });
p.igual('JSON schema 2 round-trip con reglas y resumen', (() => { const d = JSON.parse(json); return [d.schemaVersion, d.alcance, !!d.reglas, d.resumen.nodos, d.fuentes[0].id]; })(), [2, 'all', true, 3, 'raw:paper.md']);
p.cierto('fechas reproducibles por opciones locales', visible.fecha === '2026-09-25' && visible.generado === '2026-09-25T12:00:00.000Z');

const csv = crearCSV(all, { ahora: FECHA });
p.igual('CSV conserva las seis columnas y añade las tres de origen', csv.split('\n')[0], 'origen,destino,capa_origen,capa_destino,motivo,frase,motivo_origen,frase_origen,linea_origen');
p.cierto('CSV escapa comas, comillas y saltos de línea exactamente', csv.includes('a.md,b.md,0,1,"soporta, ""sí""\nsegunda","frase, ""literal""\nlínea","soporta, ""sí""\nsegunda","frase, ""literal""\nlínea",7')
  && csv.includes('a.md,c.md,0,1,,,,,11')
  && csv.includes('a.md,raw:paper.md,0,0,fuente citada en la página,,fuente citada en la página,,3'));
p.igual('CSV duplicados inversos se consolidan', (csv.match(/^a\.md,b\.md,/gm) || []).length, 1);

const svg = crearSVG(focused, { ahora: FECHA, scene: ESCENA, width: 640, height: 480 });
const svgHostil = crearSVG(focused, { ahora: FECHA, scene: ESCENA, title: '<unsafe & "quoted">' });
p.cierto('SVG escapa title, desc y metadata', svgHostil.includes('&lt;unsafe &amp; &quot;quoted&quot;&gt;') && !svgHostil.includes('<unsafe &'));
p.cierto('SVG incluye leyenda, filtro, fecha, conteos y zoom', ['id="why-graph-legend"', 'Filtros:', '2026-09-25', '4 nodos', 'zoom 150%'].every((part) => svg.includes(part)));
p.cierto('SVG no contiene recursos externos', !/<(?:script|image|a)\b[^>]*(?:src|href)=["']https?:/i.test(svg));
p.cierto('SVG no contiene recursos ni URLs externas', !/(?:src|href|xlink:href)=["']https?:/i.test(svg));
p.cierto('SVG no emite barra de escala', !/data-scale|physical-scale|barra de escala/i.test(svg));

const dataURL = 'data:image/png;base64,AA==';
const html = await crearHTML(focused, { ahora: FECHA, scene: ESCENA, pngDataUrl: dataURL, title: 'Alpha <& "visible">' });
p.cierto('HTML incluye SVG, tabla y metadata JSON', html.includes('<svg') && html.includes('<table>') && html.includes('id="why-graph-metadata"'));
p.cierto('HTML escapa el título visible', html.includes('<h1>Alpha &lt;&amp; &quot;visible&quot;&gt;</h1>'));
p.cierto('HTML no solicita recursos externos', !/<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:/i.test(html));
p.cierto('HTML ofrece descargas PNG y SVG mediante data URLs', html.includes(`href="${dataURL}"`) && html.includes('href="data:image/svg+xml;charset=utf-8,'));
p.igual('el JSON embebido vuelve a leerse sin cerrar el script', JSON.parse(html.match(/<script type="application\/json" id="why-graph-metadata">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&')).alcance, 'focused');

const legacy = datosExportables(GRAFO, 'all', { estado: ESTADO, ahora: FECHA, compatibilidadLegada: true });
p.igual('el adaptador legado conserva nodos, fuentes y enlaces de notas', [legacy.nodos.length, legacy.fuentes.length, legacy.enlaces.length, legacy.resumen.enlaces], [3, 1, 2, 2]);
p.igual('el adaptador legado conserva las primeras seis columnas', crearCSV(legacy, { compatibilidadLegada: true }).split('\n')[0], 'origen,destino,capa_origen,capa_destino,motivo,frase');

let dimensionesPNG;
const renderer = {
  viewport: { width: 5000, height: 1000 },
  frameForExport(options) {
    dimensionesPNG = options;
    return { width: options.width, height: options.height, canvas: { width: Math.round(options.width * options.dpr), height: Math.round(options.height * options.dpr), toBlob(callback) { callback(null); }, toDataURL() { return dataURL; } } };
  },
};

const png = await crearPNG(renderer, { width: 5000, height: 1000 });
p.igual('PNG limita frameForExport a 8192 px y cae a toDataURL', [dimensionesPNG.dpr, png.blob, png.dataUrl, png.ancho, png.alto], [8192 / 5000, null, dataURL, 8192, 1638]);
function adaptador({ fallarEn = null, existentes = new Set() } = {}) {
  const archivos = new Map();
  const carpetas = new Set();
  const escrituras = [];
  return {
    archivos, carpetas, escrituras,
    async existe(ruta) { return existentes.has(ruta) || archivos.has(ruta); },
    async carpetaExiste(ruta) { return carpetas.has(ruta); },
    async crearCarpeta(ruta) { carpetas.add(ruta); },
    async escribirTexto(ruta, contenido) {
      if (fallarEn === ruta) throw new Error('fallo');
      archivos.set(ruta, contenido); escrituras.push(['texto', ruta, contenido]);
    },
    async escribirBinario(ruta, contenido) {
      if (fallarEn === ruta) throw new Error('fallo');
      archivos.set(ruta, contenido); escrituras.push(['binario', ruta, contenido]);
    },
  };
}

const sinCarpeta = adaptador();
const escritura = await exportarVista(GRAFO, {
  alcance: 'visible', estado: ESTADO, ahora: FECHA, formatos: ['json', 'csv'], carpeta: 'Exportes nuevo', adapter: sinCarpeta,
});
p.igual('crea la carpeta únicamente al exportar y escribe en serie', [sinCarpeta.carpetas.size, sinCarpeta.escrituras.map(([, ruta]) => ruta)], [1, ['Exportes nuevo/mapa-neuronal-2026-09-25.json', 'Exportes nuevo/mapa-neuronal-2026-09-25.csv']]);
p.cierto('no crea carpeta al preparar un artefacto puro', !crearJSON(GRAFO, { estado: ESTADO }).includes('adapter'));

const conConflictos = adaptador({ existentes: new Set(['Exportes/mapa-neuronal-2026-09-25.json', 'Exportes/mapa-neuronal-2026-09-25.csv', 'Exportes/mapa-neuronal-2026-09-25-focused.svg']) });
const conflictos = await exportarVista(GRAFO, { alcance: 'focused', estado: ESTADO, ahora: FECHA, formatos: ['json', 'svg'], carpeta: 'Exportes', adapter: conConflictos, scene: ESCENA });

p.igual('resuelve conflictos por archivo sin pisar', conflictos.paths, ['Exportes/mapa-neuronal-2026-09-25-focused.json', 'Exportes/mapa-neuronal-2026-09-25-focused-2.svg']);
const fallo = adaptador({ fallarEn: 'Salidas/mapa-neuronal-2026-09-25-all.csv' });
let errorFallo = null;
try {
  await exportarVista(GRAFO, { alcance: 'all', estado: ESTADO, ahora: FECHA, formatos: ['json', 'csv'], carpeta: 'Salidas', adapter: fallo });
} catch (error) { errorFallo = error; }
p.igual('un fallo secuencial se detiene y expone lo ya guardado', [fallo.escrituras.length, errorFallo.succeededPaths], [1, ['Salidas/mapa-neuronal-2026-09-25-all.json']]);
p.cierto('el error identifica el archivo que no pudo escribirse', errorFallo.failedPath === 'Salidas/mapa-neuronal-2026-09-25-all.csv' && errorFallo.message.includes('mapa-neuronal-2026-09-25-all.csv'));
const avisos = [];
const falloAviso = adaptador({ fallarEn: 'Avisos/mapa-neuronal-2026-09-25.json' });
try {
  await exportarVista(GRAFO, { alcance: 'visible', estado: ESTADO, ahora: FECHA, formatos: ['json'], carpeta: 'Avisos', adapter: falloAviso, onNotice: (mensaje) => avisos.push(mensaje), crearMensajeFallo: (ruta, exitos) => `Fallo traducido: ${ruta}; previos=${exitos.join('|')}` });
} catch { }
p.igual('el aviso de fallo traducido identifica lo que sí se guardó', avisos, ['Fallo traducido: Avisos/mapa-neuronal-2026-09-25.json; previos=']);
  process.exitCode = p.cerrar() ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
