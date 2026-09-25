/* Contrato puro del estado per-view: normalización, restauración y filtros. */
const { cargarPlugin, pruebas } = require('./simulado.cjs');
const { interno } = cargarPlugin(process.argv[2]);
const { normalizarEstado, aplicarFiltros } = interno;
const p = pruebas('estado');

const HOY = Date.now();
const DATOS = {
  nodos: [
    { id: 'a', capa: 0, tema: 'rojo', grado: 2, updated: HOY, enlaces: [{ url: 'https://a.example' }] },
    { id: 'b', capa: 1, tema: 'azul', grado: 2, updated: HOY - 2 * 86400000, enlaces: [] },
    { id: 'c', capa: 2, tema: 'rojo', grado: 2, updated: HOY - 20 * 86400000, enlaces: [] },
    { id: 'd', capa: 3, tema: 'azul', grado: 1, updated: HOY - 100 * 86400000, enlaces: [] },
    { id: 'raw:s', capa: 0, tema: null, grado: 1, updated: HOY, fuente: true, enlaces: [] },
  ],
  aristas: [
    ['a', 'b', 'porque A sostiene B'],
    ['b', 'c', ''],
    ['a', 'c', 'A llega a C'],
    ['raw:s', 'd', 'cita'],
  ],
};

const base = normalizarEstado(null, { datos: DATOS });
p.igual('estado vacío limpio', base, {
  modo: 'capas', camara: { x: 0, y: 0, k: 1 }, filtro: '', temas: [], capas: [],
  rangoGrado: { min: 0, max: null }, actividadDias: 0, soloExternas: false,
  soloLargoAlcance: false, colapsados: [], seleccion: null, ruta: [], panel: null,
  temaVisual: 'tema',
});
p.cierto('el estado per-view no contiene la preferencia de fuentes', !Object.hasOwn(base, 'fuentes'));

const mal = normalizarEstado({
  modo: 'invalido', camara: { x: '2.5', y: 'malo', k: 99 }, filtro: ' .search  ',
  temas: [' rojo ', 'rojo', 'fantasma', 4], capas: ['2', 0, 1, 1, 99, 'x'],
  rangoGrado: { min: '-2', max: 0.5 }, actividadDias: 14, soloExternas: 'true',
  soloLargoAlcance: 1, colapsados: [' azul ', 'fantasma'], seleccion: ' b ',
  ruta: ['a', 'b'], panel: 'ajeno', temaVisual: 'claro', extra: 'ignorado',
}, { datos: DATOS });
p.igual('rechaza enumeraciones desconocidas y conserva tipos válidos', [mal.modo, mal.panel, mal.temaVisual, mal.actividadDias, mal.soloExternas, mal.soloLargoAlcance], ['capas', null, 'tema', 0, false, false]);
p.igual('normaliza cámara y recorta el zoom', mal.camara, { x: 2.5, y: 0, k: 6 });
p.igual('normaliza texto y elimina IDs obsoletos/repetidos', [mal.filtro, mal.temas, mal.capas, mal.colapsados, mal.seleccion], ['.search', ['rojo'], [0, 1, 2], ['azul'], 'b']);
p.igual('normaliza rango grado', mal.rangoGrado, { min: 0, max: null });
p.cierto('descarta campos desconocidos', !Object.hasOwn(mal, 'extra'));
p.igual('zoom inferior usa el mínimo existente', normalizarEstado({ camara: { k: 0 } }).camara.k, 0.3);
p.igual('grado máximo menor que mínimo se descarta', normalizarEstado({ rangoGrado: { min: 3, max: 2 } }).rangoGrado, { min: 3, max: null });

const muchosTemas = Array.from({ length: 300 }, (_, i) => `t${String(i).padStart(3, '0')}`).reverse();
const muchasCapas = Array.from({ length: 300 }, (_, i) => i).reverse();
const topes = normalizarEstado({ temas: muchosTemas, capas: muchasCapas }, {
  temasIds: new Set(muchosTemas), capasIds: new Set(muchasCapas),
});
p.igual('tema vacío significa sin restricción y limita a 256', [topes.temas.length, topes.temas[0], topes.temas[255]], [256, 't299', 't044']);
p.igual('ordena y limita capas numéricas', [topes.capas.length, topes.capas[0], topes.capas[255]], [256, 0, 255]);
const idsRuta = new Set(['a', 'b', 'c']);
p.igual('conserva una ruta válida y trimmeada', normalizarEstado({ ruta: [' a ', 'b', 'c'] }, { ids: idsRuta }).ruta, ['a', 'b', 'c']);
p.igual('descarta ruta desconocida o duplicada', normalizarEstado({ ruta: ['a', 'x', 'c'] }, { ids: idsRuta }).ruta, []);
p.igual('descarta una ruta repetida', normalizarEstado({ ruta: ['a', 'b', 'a'] }, { ids: idsRuta }).ruta, []);
p.igual('descarta una ruta de más de 2000 nodos', normalizarEstado({ ruta: Array.from({ length: 2001 }, (_, i) => `n${i}`) }, { ids: new Set(Array.from({ length: 2001 }, (_, i) => `n${i}`)) }).ruta, []);

const visible = (estado) => [...aplicarFiltros(DATOS, estado).visibles].sort();
p.igual('sin filtros muestra todas las notas y fuentes', visible({}), ['a', 'b', 'c', 'd', 'raw:s']);
p.igual('selección de capas es inclusiva', visible({ capas: [1, 3] }), ['b', 'd']);
p.igual('selección de temas es inclusiva', visible({ temas: ['rojo'] }), ['a', 'c']);
p.igual('rango de grado incluye extremos', visible({ rangoGrado: { min: 2, max: 2 } }), ['a', 'b', 'c']);
p.igual('actividad conserva nodos dentro de la ventana', visible({ actividadDias: 7 }), ['a', 'b', 'raw:s']);
p.igual('filtra notas con enlaces externos', visible({ soloExternas: true }), ['a']);
p.igual('largo alcance usa distancia de capas de los extremos', visible({ soloLargoAlcance: true }), ['a', 'c', 'd', 'raw:s']);

const antes = JSON.stringify(DATOS);
const filtrado = aplicarFiltros(DATOS, { capas: [0], rangoGrado: { min: 2, max: null }, soloExternas: true });
p.igual('no muta los datos', JSON.stringify(DATOS), antes);
p.cierto('visibles es un Set', filtrado.visibles instanceof Set);
p.igual('alcance identifica el ámbito visible y sus aristas', [filtrado.alcance.tipo, filtrado.alcance.ids, filtrado.alcance.aristas], ['visible', ['a'], []]);
p.igual('conteos distingue totales, visibles y explicadas', [filtrado.conteos.notas, filtrado.conteos.fuentes, filtrado.conteos.enlaces, filtrado.conteos.visibles, filtrado.conteos.fuera, filtrado.conteos.enlacesVisibles, filtrado.conteos.explicadas], [4, 1, 4, 1, 4, 0, 0]);
p.igual('conteos por capa y tema son deterministas', [filtrado.conteos.porCapa, filtrado.conteos.porTema], [{ 0: 1 }, { rojo: 1 }]);

process.exit(p.cerrar() ? 1 : 0);
