import { crearRegistro, construirDesdeRegistros } from './graph.js';

function mtimeDe(archivo) {
  return archivo?.stat?.mtime ?? archivo?.mtime ?? null;
}

function normalizarRuta(valor) {
  return typeof valor === 'string' ? valor : valor?.path;
}

function rutasDe(argumentos) {
  const out = [];
  const agregar = (valor) => {
    const path = normalizarRuta(valor);
    if (path != null) out.push(path);
  };
  for (const valor of argumentos) {
    if (valor == null) continue;
    if (typeof valor === 'string' || typeof valor?.path === 'string') agregar(valor);
    else if (valor instanceof Map) for (const clave of valor.keys()) agregar(clave);
    else if (valor instanceof Set || typeof valor[Symbol.iterator] === 'function') {
      for (const clave of valor) agregar(clave);
    }
  }
  return out;
}

function claveDeParseo(ajustes = {}) {
  return JSON.stringify([ajustes.propiedadTema || '', ajustes.propiedadEnlaces || '', ajustes.seccionMotivos || 'Conexiones', ajustes.carpetasFuentes || '']);
}

// GraphStore mantiene únicamente registros inmutables de lectura. Las aristas, inventario,
// grados, temas y hubs se reconstruyen en cada rebuild desde metadataCache.resolvedLinks y desde
// los archivos que existen ahora; nada de ese resultado se conserva como caché incremental.
export class GraphStore {
  constructor() {
    this._records = new Map();
    this._cacheVersion = 0;
    this._parseKey = null;
    this._app = null;
    this._generation = 0;
    this._tail = Promise.resolve();
    this._latest = null;
  }

  // `changedPaths` acepta null, una ruta, un Set o cualquier iterable de rutas. Las rutas listadas
  // fuerzan cachedRead aunque su mtime no haya cambiado; una ruta que ya no está en el vault se
  rebuild(app, ajustes, changedPaths = null) {
    const parseKey = claveDeParseo(ajustes);
    if (this._app !== app) {
      this._records.clear();
      this._app = app;
      this._parseKey = parseKey;
      this._cacheVersion++;
    } else if (parseKey !== this._parseKey) {
      this._records.clear();
      this._parseKey = parseKey;
      this._cacheVersion++;
    }
    const generation = ++this._generation;
    const cacheVersion = this._cacheVersion;
    const forzar = new Set(rutasDe(changedPaths == null ? [] : [changedPaths]));
    const run = async () => {
      const files = app.vault.getMarkdownFiles();
      const next = new Map();
      for (const file of files) {
        const path = file.path;
        const cached = this._records.get(path);
        const reread = forzar.has(path) || !cached || cached.mtime !== mtimeDe(file);
        if (!reread) {
          next.set(path, cached);
          continue;
        }
        const text = await app.vault.cachedRead(file);
        next.set(path, crearRegistro(app, file, text, mtimeDe(file), ajustes));
      }
      const links = app.metadataCache.resolvedLinks || {};
      const data = construirDesdeRegistros(app, ajustes, next, links);
      // Una invalidación concurrente invalida también el resultado de esta lectura. La caché de
      // registros puede reutilizarse aunque esta generación ya no sea la última: la siguiente
      // reconstrucción vuelve a validar mtime y changedPaths antes de publicar sus datos.
      if (cacheVersion === this._cacheVersion) this._records = next;
      return data;
    };

    const task = this._tail.then(run, run);
    this._tail = task.then(() => undefined, () => undefined);
    this._latest = task;
    // Si otra reconstrucción llegó mientras se leía, el resultado viejo (o su error) se entrega
    // al último solicitante para que una vista nunca pueda conservar un resultado obsoleto.
    return task.then(
      (data) => generation === this._generation ? data : this._latest,
      (error) => generation === this._generation ? Promise.reject(error) : this._latest,
    );
  }

  // Integración de eventos sugerida: metadata changed → invalidate(file.path); delete →
  // invalidate(file.path). Para rename se invalidan ambos extremos: invalidate(oldPath, newPath).
  invalidate(...paths) {
    for (const path of rutasDe(paths)) this._records.delete(path);
    this._cacheVersion++;
    return this;
  }

  clear() {
    this._records.clear();
    this._cacheVersion++;
    return this;
  }
}

export default GraphStore;
