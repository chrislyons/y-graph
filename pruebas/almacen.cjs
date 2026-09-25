const { pruebas, vaultSimulado, cargarPlugin } = require('./simulado.cjs');
const { GraphStore, AJUSTES_BASE, construir } = cargarPlugin().interno;
const p = pruebas('almacen');

(async () => {
  const notas = {
    'a.md': '---\ntema: uno\n---\n[[b]]',
    'b.md': '---\ntema: uno\n---\n[[a]]',
  };
  const { app } = vaultSimulado(notas);
  let lecturas = 0;
  const leerOriginal = app.vault.cachedRead;
  app.vault.cachedRead = async (file) => { lecturas++; return leerOriginal(file); };
  const ajustes = Object.assign({}, AJUSTES_BASE, {
    capas: 'A | a\nB | b', carpetas: '/ = 0', propiedadTema: 'tema', fuentes: 'no',
  });
  // Root mapping includes both files in layer zero; the test focuses on cache and edge recomputation.
  const store = new GraphStore();
  const first = await store.rebuild(app, ajustes);
  const firstReads = lecturas;
  p.igual('primera construcción lee cada nota', firstReads, 2);
  p.igual('el grafo inicial tiene el enlace', first.aristas.length, 1);
  const second = await store.rebuild(app, ajustes);
  p.igual('una reconstrucción sin cambios no relee', lecturas, firstReads);
  p.igual('y conserva el enlace', second.aristas.length, 1);

  lecturas = 0;
  app.metadataCache.resolvedLinks['a.md'] = { 'b.md': 1 };
  app.metadataCache.resolvedLinks['b.md'] = {};
  const changed = await store.rebuild(app, ajustes, ['a.md']);
  p.igual('changedPaths fuerza una lectura', lecturas, 1);
  p.igual('la arista actualiza desde resolvedLinks', changed.aristas.length, 1);
  app.metadataCache.resolvedLinks['a.md'] = {};
  const staleRemoved = await store.rebuild(app, ajustes);
  p.igual('una arista renombrada no sobrevive al rebuild', staleRemoved.aristas.length, 0);

  lecturas = 0;
  store.invalidate('a.md');
  await store.rebuild(app, ajustes);
  p.igual('invalidate fuerza lectura aunque mtime no cambie', lecturas, 1);

  delete notas['b.md'];
  delete app.metadataCache.resolvedLinks['b.md'];
  const { app: appDeleted } = vaultSimulado({ 'a.md': notas['a.md'] });
  appDeleted.metadataCache.resolvedLinks = { 'a.md': {} };
  const removed = await store.rebuild(appDeleted, ajustes);
  p.igual('el archivo eliminado sale del grafo', removed.nodos.some((n) => n.id === 'b.md'), false);

  const baseline = await construir(appDeleted, ajustes);
  p.igual('construir sigue siendo el entry compatible', baseline.nodos.length, 1);
  process.exit(p.cerrar() ? 1 : 0);
})().catch((e) => { console.error(e.stack); process.exit(1); });
