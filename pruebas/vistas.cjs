/* Vistas guardadas: migración, límites y puente con el estado canónico. */
const { cargarPlugin, pruebas } = require('./simulado.cjs');
const { interno, avisos } = cargarPlugin(process.argv[2]);
const {
  MapaNeuronal, VistaMapa, AJUSTES_BASE, normalizarEstado, aplicarFiltros,
  normalizarVistasGuardadas, normalizarAjustes,
} = interno;
const p = pruebas('vistas');

p.igual('los ajustes base incluyen el almacén canónico', [AJUSTES_BASE.vistasGuardadas, AJUSTES_BASE.ultimaVista], [{}, null]);

const initial = { estado: { camara: { k: 4 }, fantasma: true }, creada: 10, actualizada: 20, metadata: 'se ignora' };
const migrados = normalizarAjustes({
  vistasGuardados: { Legacy: initial },
  vistasGuardadas: {
    [`  ${'N'.repeat(70)}  `]: { estado: { modo: 'radial', seleccion: 'fantasma', extra: 1 }, creada: 30, actualizada: 25, fuera: true },
    Operativa: { estado: { panel: 'ajeno' }, creada: 'malo', actualizada: 40 },
    ' vacía ': initial,
  },
  ultimaVista: 'OPERATIVA',
});
p.cierto('se ignora el typo persistido vistasGuardados', !Object.hasOwn(migrados, 'vistasGuardados'));
p.igual('ultimaVista se canonicaliza sin distinguir mayúsculas', migrados.ultimaVista, 'Operativa');
const nombres = Object.keys(migrados.vistasGuardadas);
const nombreLargoPersistido = nombres.find((nombre) => nombre.startsWith('N'));
p.igual('los nombres se limpian y quedan truncados a 60', [nombres.length, nombreLargoPersistido.length], [3, 60]);
p.igual('cada registro conserva exactamente estado, creada y actualizada', Object.keys(migrados.vistasGuardadas.Operativa).sort(), ['actualizada', 'creada', 'estado']);
p.igual('el estado malformado se reemplaza por valores normalizados', migrados.vistasGuardadas.Operativa.estado, normalizarEstado({ panel: 'ajeno' }));
p.igual('una fecha anterior a la creación no produce una vista del futuro', migrados.vistasGuardadas[nombreLargoPersistido].actualizada, 30);
p.igual('faltantes o valores no-objeto producen el contenedor vacío', Object.keys(normalizarVistasGuardadas(null)).length, 0);

const ahoraOriginal = Date.now;
const plugin = Object.create(MapaNeuronal.prototype);
let guardados = 0;
plugin.ajustes = { vistasGuardadas: normalizarVistasGuardadas(Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [`Vista ${i + 1}`, { estado: {}, creada: i + 1, actualizada: i + 1 }])
), 12) };
plugin.guardar = async () => { guardados++; };
Date.now = () => 20;
(async () => {
  const nombreLargo = await plugin.guardarVista(`  ${'X'.repeat(70)}  `, { camara: { k: 99 }, desconocido: true });
  p.igual('guardar limpia y limita el nombre', [nombreLargo.length, Object.keys(plugin.ajustes.vistasGuardadas).length], [60, 12]);
  p.cierto('la vista thirteenth evicta la actualizada más antigua', !Object.hasOwn(plugin.ajustes.vistasGuardadas, 'Vista 1'));
  p.cierto('la nueva vista queda persistida con estado normalizado', Object.hasOwn(plugin.ajustes.vistasGuardadas, 'X'.repeat(60)));
  const antesDuplicado = guardados;
  const duplicado = await plugin.guardarVista('x'.repeat(60), {});
  p.igual('el duplicado no inserta ni vuelve a guardar', [duplicado, guardados - antesDuplicado], [null, 0]);
  p.cierto('el duplicado muestra un Notice traducido', avisos.includes('A saved view with that name already exists'));

  plugin.ajustes.ultimaVista = null;
  const estadoRestaurado = { camara: { x: 4, y: 5, k: 2 }, filtro: 'nota' };
  plugin.ajustes.vistasGuardadas = normalizarVistasGuardadas({
    Operativa: { estado: estadoRestaurado, creada: 1, actualizada: 2 },
  }, 2);
  const vista = { setState: async (estado) => { recibido = estado; return estado; } };
  plugin.app = { workspace: {
    getLeavesOfType: () => [{ view: vista }],
  } };
  plugin.abrir = async () => {};
  await plugin.restaurarVista('operativa');
  p.igual('restaurar aplica el estado guardado normalizado', recibido, normalizarEstado(estadoRestaurado));
  p.igual('restaurar actualiza ultimaVista y usa guardar()', [plugin.ajustes.ultimaVista, guardados], ['Operativa', 2]);

  const datos = {
    nodos: [
      { id: 'a', capa: 0, tema: 'rojo', grado: 2 },
      { id: 'b', capa: 1, tema: 'azul', grado: 2 },
    ],
    aristas: [['a', 'b', 'motivo']],
    capas: ['Entrada', 'Salida'],
    temas: { rojo: ['Rojo', '#f00'], azul: ['Azul', '#00f'] },
  };
  const estado = normalizarEstado({
    modo: 'radial', camara: { x: -4, y: 8, k: 8 }, filtro: '  busqueda  ',
    temas: [' rojo ', 'fantasma'], capas: [1, 0, 9], rangoGrado: { min: -1, max: 3 },
    actividadDias: 90, soloExternas: true, soloLargoAlcance: true,
    colapsados: ['rojo', 'fantasma'], seleccion: 'b', ruta: ['a', 'b', 'a'],
    panel: 'salud', temaVisual: 'noche', extra: true,
  }, { datos });
  p.igual('el estado guardado se normaliza con el contrato canónico', estado, {
    modo: 'radial', camara: { x: -4, y: 8, k: 6 }, filtro: 'busqueda',
    temas: ['rojo'], capas: [0, 1], rangoGrado: { min: 0, max: 3 },
    actividadDias: 90, soloExternas: true, soloLargoAlcance: true,
    colapsados: ['rojo'], seleccion: 'b', ruta: [], panel: 'salud', temaVisual: 'noche',
  });
  p.igual('los filtros puros usan el mismo estado y no mutan el grafo', [aplicarFiltros(datos, { ...estado, filtro: '', actividadDias: 0, soloExternas: false, soloLargoAlcance: false }).visibles.size, datos.nodos.length], [1, 2]);
  p.igual('VistaMapa conserva su contrato público getState/setState', typeof VistaMapa.prototype.getState, 'function');

  Date.now = ahoraOriginal;
  process.exit(p.cerrar() ? 1 : 0);
})().catch((error) => {
  Date.now = ahoraOriginal;
  console.error(error);
  process.exit(1);
});
