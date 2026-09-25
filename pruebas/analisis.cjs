/* Contrato puro de analítica: conteos, salud, vecindades, rutas y vacíos. */
const { cargarPlugin, pruebas } = require('./simulado.cjs');
const { interno } = cargarPlugin(process.argv[2]);
const { metricas, diagnosticos, vecindades, rutaMasCorta, vacios } = interno;
const p = pruebas('analisis');

const nodo = (id, capa, tema, extra = {}) => ({
  id, capa, tema, propio: true, grado: 0, sinMotivo: 0, ...extra,
});
const arista = (a, b, motivo = '', frase = null) => [a, b, motivo, frase];

const DATOS = {
  nodos: [
    nodo('n1', 0, 'a'), nodo('n2', 1, 'a'), nodo('n3', 1, 'b'),
    nodo('n4', 1, 'b', { propio: false }), nodo('n6', 2, 'a'),
    nodo('raw:ok', 0, null, { fuente: true }),
    nodo('raw:missing.md', 0, null, { fuente: true, rota: true }),
  ],
  aristas: [
    arista('n2', 'n1', 'explicada'),
    arista('n1', 'n3', '', { texto: 'primera frase', linea: 3 }),
    arista('n3', 'n1', '', { texto: 'segunda frase', linea: 9 }),
    arista('n4', 'n2'),
    arista('raw:ok', 'n1', 'fuente citada en la página'),
  ],
  capas: [['E', 'Entrada'], ['N', 'Notas'], ['T', 'Temas']],
  temas: { a: ['A', '#fff'], b: ['B', '#000'] },
  config: { sinCapa: [], carpetasVacias: [] },
};

const metricasCompletas = metricas(DATOS);
p.igual('conteos del mapa separan notas, enlaces entre notas y fuentes', metricasCompletas.mapa, { notas: 5, enlaces: 3, fuentes: 2 });
p.igual('distingue motivo curado, frase literal y enlace totalmente sin explicar',
  [metricasCompletas.explicadas, metricasCompletas.conFrase, metricasCompletas.sinExplicacion, metricasCompletas.porcentajeExplicadas],
  [1, 1, 2, 1 / 3]);
p.igual('cuenta huérfanas, referencias rotas, temas inferidos y agrupación', [
  metricasCompletas.huerfanas, metricasCompletas.referenciasRotas, metricasCompletas.temasInferidos,
  metricasCompletas.porCapa, metricasCompletas.porTema,
], [1, 1, 1, [1, 3, 1], { a: 3, b: 2 }]);

const metricasSet = metricas(DATOS, new Set(['n1', 'n3']));
p.igual('un filtro Set conserva solo el subgrafo inducido', [
  metricasSet.mapa, metricasSet.explicadas, metricasSet.conFrase, metricasSet.huerfanas,
  metricasSet.porCapa, metricasSet.porTema,
], [{ notas: 2, enlaces: 1, fuentes: 0 }, 0, 1, 0, [1, 1, 0], { a: 1, b: 1 }]);
const metricasPredicado = metricas(DATOS, (n, id) => n.capa === 1 && id === n.id);
p.igual('un predicado recibe el nodo y su ID', metricasPredicado.mapa, { notas: 3, enlaces: 1, fuentes: 0 });
p.igual('el filtro no excluye aristas entre nodos visibles', [metricasPredicado.explicadas, metricasPredicado.conFrase, metricasPredicado.huerfanas], [0, 0, 1]);
const antes = JSON.stringify(DATOS);
metricas(DATOS); metricas(DATOS, new Set(['n1'])); metricas(DATOS, (n) => n.capa === 0);
p.igual('las métricas no mutan los datos', JSON.stringify(DATOS), antes);
p.igual('sin enlaces entre notas la proporción es cero', metricas({ nodos: [], aristas: [], capas: [] }).porcentajeExplicadas, 0);

const diagnosticosNodos = [nodo('raw:roto', 0, null, { fuente: true, rota: true }), nodo('huerfana', 1, 'a')];
for (let i = 1; i <= 10; i++) diagnosticosNodos.push(nodo(`e${String(i).padStart(2, '0')}`, 1, 'motivo', { sinMotivo: 11 - i }));
diagnosticosNodos.push(nodo('soporte', 0, 'soporte'));
diagnosticosNodos.push(nodo('inferida', 1, 'inferido', { propio: false }));
diagnosticosNodos.push(nodo('hub-a', 2, 'terminal'));
diagnosticosNodos.push(nodo('hub-b', 2, 'terminal', { hub: true }));
diagnosticosNodos.push(nodo('hub-c', 2, 'terminal'));
const aristasDiagnostico = [];
for (const n of diagnosticosNodos) if (n.id !== 'huerfana' && n.id !== 'raw:roto') aristasDiagnostico.push(arista('soporte', n.id, 'conectado'));
const DIAGNOSTICOS = {
  nodos: diagnosticosNodos,
  aristas: aristasDiagnostico,
  capas: [['0', 'Entrada'], ['1', 'Notas'], ['2', 'Terminal']],
  config: {
    propiedadTema: 'area',
    sinCapa: ['fuera/z.md', 'fuera/a.md', 'fuera/a.md'],
    carpetasVacias: ['vacia/z', 'vacia/a'],
  },
};
const salud = diagnosticos(DIAGNOSTICOS);
const tiposPermitidos = new Set(['referencia-rota', 'huerfana', 'tema-inferido', 'sin-motivo', 'fuera-capa', 'carpeta-vacia']);
const severidadesPermitidas = new Set(['grave', 'advertencia', 'info']);
p.cierto('los diagnósticos solo usan tipos permitidos', salud.every((d) => tiposPermitidos.has(d.tipo)));
p.cierto('los diagnósticos solo usan severidades permitidas', salud.every((d) => severidadesPermitidas.has(d.severidad)));
p.igual('diagnósticos tienen IDs, tipos y severidades estables', salud.map((d) => [d.id, d.tipo, d.severidad]), [
  ['diagnostico:referencia-rota', 'referencia-rota', 'grave'],
  ['diagnostico:huerfana', 'huerfana', 'grave'],
  ['diagnostico:tema-inferido', 'tema-inferido', 'grave'],
  ['diagnostico:sin-motivo:grave', 'sin-motivo', 'grave'],
  ['diagnostico:sin-motivo:advertencia', 'sin-motivo', 'advertencia'],
  ['diagnostico:fuera-capa:rutas', 'fuera-capa', 'advertencia'],
  ['diagnostico:fuera-capa:hub-terminal', 'fuera-capa', 'grave'],
  ['diagnostico:carpeta-vacia', 'carpeta-vacia', 'advertencia'],
]);
p.igual('el percentil 90 agrupa los motivos graves y deja los inferiores en aviso', [
  salud.find((d) => d.id === 'diagnostico:sin-motivo:grave').nodos,
  salud.find((d) => d.id === 'diagnostico:sin-motivo:advertencia').nodos,
], [['e01', 'e02'], ['e03', 'e04', 'e05', 'e06', 'e07', 'e08', 'e09', 'e10']]);
p.igual('inferencia usa la propiedad presente sin inventar otra', salud.find((d) => d.tipo === 'tema-inferido').nodos, ['inferida']);
p.cierto('el mensaje de inferencia nombra la propiedad configurada', salud.find((d) => d.tipo === 'tema-inferido').mensaje.includes('«area»'));
p.igual('la regla terminal conserva una hub y diagnostica a sus competidoras',
  salud.find((d) => d.id === 'diagnostico:fuera-capa:hub-terminal').nodos, ['hub-a', 'hub-c']);
p.cierto('el diagnóstico terminal explica el conflicto de hub', /hub.*última capa|última capa.*hub/.test(salud.find((d) => d.id === 'diagnostico:fuera-capa:hub-terminal').mensaje));
p.igual('configuración fuera de capa y carpetas vacías se normaliza y ordena', [
  salud.find((d) => d.id === 'diagnostico:fuera-capa:rutas').nodos,
  salud.find((d) => d.tipo === 'carpeta-vacia').nodos,
], [['fuera/a.md', 'fuera/z.md'], ['vacia/a', 'vacia/z']]);
p.cierto('todos los arrays de nodos de diagnóstico están ordenados', salud.every((d) => d.nodos.every((id, i) => !i || d.nodos[i - 1] < id)));

const frase = { texto: 'la primera frase', linea: 4 };
const conFrase = diagnosticos({
  nodos: [nodo('p', 1, 'x'), nodo('q', 1, 'x')],
  aristas: [arista('p', 'q', '', frase), arista('q', 'p', '', { texto: 'la segunda', linea: 8 })],
  capas: [['0', 'Entrada'], ['1', 'Notas']],
  config: {},
}).find((d) => d.tipo === 'sin-motivo');
p.igual('una arista recíproca conserva una sola frase y aparece en ambos extremos', [conFrase.nodos, conFrase.mensaje.includes('1 arista(s)')], [['p', 'q'], true]);
p.igual('sin configuración de propiedad el mensaje de inferencia es genérico', diagnosticos({
  nodos: [nodo('soporte', 0, 'x'), nodo('inferida', 1, 'x', { propio: false })],
  aristas: [arista('soporte', 'inferida', 'relación')],
  capas: [['0', 'Entrada'], ['1', 'Notas']],
}).find((d) => d.tipo === 'tema-inferido').mensaje.includes('«'), false);

const VECINOS = {
  nodos: ['root', 'a', 'b', 'c', 'd'].map((id) => nodo(id, 0, 'x')),
  aristas: [arista('root', 'b'), arista('root', 'a'), arista('b', 'c'), arista('c', 'd'), arista('root', 'fantasma')],
  capas: [['0', 'Única']],
  contexto: { profundidadRadial: 3 },
};
const anillo3 = vecindades(VECINOS, 'root', 99);
p.igual('la profundidad se recorta al contexto y ordena IDs', anillo3.ids, ['a', 'b', 'c', 'd', 'root']);
p.igual('BFS usa anillos exactos y la raíz a distancia cero', Object.fromEntries(anillo3.distancias), { root: 0, a: 1, b: 1, c: 2, d: 3 });
p.igual('profundidad cero y negativa conservan solo la raíz', [vecindades(VECINOS, 'root', 0).ids, vecindades(VECINOS, 'root', -8).ids], [['root'], ['root']]);
p.igual('una profundidad fraccionaria es un anillo entero', vecindades(VECINOS, 'root', 1.9).ids, ['a', 'b', 'root']);
p.igual('una raíz o una arista desconocidas no expandsen el BFS', [vecindades(VECINOS, 'fantasma', 3).ids, [...vecindades(VECINOS, 'fantasma', 3).distancias]], [[], []]);

const RUTA_PREFERIDA = {
  nodos: [nodo('s', 1, 'x'), nodo('entrada', 0, 'e'), nodo('medio', 1, 'm'), nodo('meta', 1, 'x')],
  capas: [['0', 'Entrada'], ['1', 'Notas']],
  aristas: [arista('s', 'medio'), arista('medio', 'meta'), arista('s', 'entrada'), arista('entrada', 'meta')],
};
p.igual('la ruta evita nodos intermedios de la capa de entrada', rutaMasCorta(RUTA_PREFERIDA, 's', 'meta'), ['s', 'medio', 'meta']);
p.igual('desactivar la preferencia permite la ruta directa por entrada', rutaMasCorta(RUTA_PREFERIDA, 's', 'meta', { evitarCapaEntrada: false }), ['s', 'entrada', 'meta']);
const RUTA_FALLBACK = {
  nodos: [nodo('s', 1, 'x'), nodo('i', 0, 'e'), nodo('t', 1, 'x')],
  aristas: [arista('s', 'i'), arista('i', 't')],
  capas: [['0', 'Entrada'], ['1', 'Notas']],
};
p.igual('si no hay ruta sin entrada se usa el fallback', rutaMasCorta(RUTA_FALLBACK, 's', 't'), ['s', 'i', 't']);
const RUTA_TIE = {
  nodos: ['s', 'a', 'z', 't'].map((id) => nodo(id, 1, 'x')),
  aristas: [arista('s', 'z'), arista('s', 'a'), arista('z', 't'), arista('a', 't')],
  capas: [['0', 'Entrada'], ['1', 'Notas']],
};
p.igual('los vecinos ordenados hacen determinista el empate de BFS', rutaMasCorta(RUTA_TIE, 's', 't'), ['s', 'a', 't']);
p.igual('una ruta a sí misma es un solo nodo y los desconocidos no tienen ruta', [rutaMasCorta(RUTA_TIE, 's', 's'), rutaMasCorta(RUTA_TIE, 's', 'missing')], [['s'], null]);

const VACIOS_NODOS = [], VACIOS_ARISTAS = [arista('a-2', 'a-3', 'unión interna')];
for (const tema of ['a', 'b', 'c', 'd', 'e', 'f']) for (let i = 1; i <= 3; i++) VACIOS_NODOS.push(nodo(`${tema}-${i}`, 0, tema));
for (const tema of ['b', 'c', 'd', 'e', 'f']) for (let i = 1; i <= 3; i++) VACIOS_ARISTAS.push(arista('a-1', `${tema}-${i}`, 'vecino común'));
const topVacios = vacios({ nodos: VACIOS_NODOS, aristas: VACIOS_ARISTAS, capas: [['0', 'Notas'], ['1', 'Terminal']] });
p.igual('el umbral original descarta pares con esperado menor a 2', topVacios, []);
p.igual('vacíos es determinista y seguro cuando no supera el umbral', vacios({ nodos: VACIOS_NODOS, aristas: VACIOS_ARISTAS, capas: [['0', 'Notas'], ['1', 'Terminal']] }), topVacios);
p.igual('los candidatos no inventan pares cuando no hay un gap', topVacios.every((v) => Array.isArray(v.candidatos)), true);

p.igual('métricas defensivas para datos ausentes', metricas(null), {
  mapa: { notas: 0, enlaces: 0, fuentes: 0 }, explicadas: 0, conFrase: 0, sinExplicacion: 0,
  porcentajeExplicadas: 0, huerfanas: 0, referenciasRotas: 0, temasInferidos: 0, porCapa: [], porTema: {},
});
p.igual('diagnósticos, vecindades, rutas y vacíos son seguros ante datos ausentes', [
  diagnosticos(null), vecindades(null, 'x', 9).ids, rutaMasCorta(null, 'x', 'y'), vacios(null),
], [[], [], null, []]);
const MALFORMADO = { nodos: [null, {}, { id: 'ok', capa: 0, tema: 'x', propio: true }], aristas: [null, ['ok', 'fantasma'], ['ok', 'ok', ''], 7], capas: 'malo', config: null };
p.cierto('entradas mal formadas no lanzan excepciones', (() => {
  try {
    metricas(MALFORMADO); diagnosticos(MALFORMADO); vecindades(MALFORMADO, 'ok', 2);
    rutaMasCorta(MALFORMADO, 'ok', 'fantasma'); vacios(MALFORMADO);
    return true;
  } catch { return false; }
})());

process.exit(p.cerrar() ? 1 : 0);
