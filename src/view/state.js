
const MAX_SELECCION = 256;
const MAX_RUTA = 2000;
const DIAS = 24 * 60 * 60 * 1000;

function entero(value, pred, defecto) {
  if (typeof value === 'boolean' || value === null || value === undefined || (typeof value === 'string' && !value.trim())) return defecto;
  const numero = Number(value);
  return Number.isFinite(numero) && pred(numero) ? numero : defecto;
}

function texto(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function filtroTexto(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function valoresConocidos(valor, propiedad) {
  if (valor == null) return null;
  const leer = (v) => {
    if (v && typeof v === 'object' && !(v instanceof Set) && !Array.isArray(v)) {
      if (propiedad && v[propiedad] != null) return [v[propiedad]];
      return Object.keys(v);
    }
    if (v instanceof Set || Array.isArray(v)) return [...v];
    if (v && typeof v[Symbol.iterator] === 'function') return [...v];
    return [v];
  };
  return new Set(leer(valor).map((v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Set)) return v[propiedad || 'id'];
    return v;
  }).filter((v) => v !== undefined && v !== null).map((v) => typeof v === 'number' ? v : texto(v)).filter((v) => v !== ''));
}

function nodosDe(datos) {
  if (!datos || datos.nodos == null) return [];
  if (Array.isArray(datos.nodos)) return datos.nodos;
  return Object.values(datos.nodos);
}

function indicesDeCapas(datos) {
  const nodos = nodosDe(datos);
  const indices = new Set(nodos.map((n) => entero(n && n.capa, (v) => v >= 0, null)).filter((v) => v !== null));
  if (datos && Array.isArray(datos.capas)) datos.capas.forEach((_, i) => indices.add(i));
  return indices;
}

function temasDe(datos) {
  const temas = new Set();
  nodosDe(datos).forEach((n) => { const t = texto(n && n.tema); if (t) temas.add(t); });
  if (datos && datos.temas && typeof datos.temas === 'object' && !Array.isArray(datos.temas)) {
    Object.keys(datos.temas).forEach((t) => { const id = texto(t); if (id) temas.add(id); });
  }
  return temas;
}

function contextoIds(contexto, datos) {
  const nodos = nodosDe(datos);
  if (datos && datos.nodos != null) return new Set(nodos.map((n) => texto(n && n.id)).filter(Boolean));
  const supplied = contexto.ids || contexto.idNodes || contexto.nodos;
  if (supplied == null) return null;
  return valoresConocidos(supplied, 'id');
}

function contextoTemas(contexto, datos) {
  if (datos) return temasDe(datos);
  const supplied = contexto.temaIds || contexto.temasIds || contexto.idsTemas || contexto.temas;
  return supplied == null ? null : valoresConocidos(supplied, 'id');
}

function contextoCapas(contexto, datos) {
  if (datos) return indicesDeCapas(datos);
  const supplied = contexto.capaIds || contexto.capasIds || contexto.idsCapas || contexto.capas;
  if (supplied == null) return null;
  return valoresConocidos(supplied, 'capa');
}

function normalizarLista(value, known, numeric = false, limite = MAX_SELECCION) {
  if (!Array.isArray(value)) return [];
  const resultado = [];
  const vistos = new Set();
  for (const item of value) {
    const id = numeric ? entero(item, (n) => Number.isInteger(n) && n >= 0, null) : texto(item);
    if (id === null || id === '' || (known && !known.has(id)) || vistos.has(id)) continue;
    vistos.add(id);
    resultado.push(id);
  }
  if (numeric) resultado.sort((a, b) => a - b);
  return resultado.slice(0, limite);
}

function normalizarRuta(value, ids) {
  if (!Array.isArray(value) || value.length > MAX_RUTA) return [];
  const ruta = [];
  const vistos = new Set();
  for (const item of value) {
    const id = texto(item);
    if (!id || (ids && !ids.has(id)) || vistos.has(id)) return [];
    vistos.add(id);
    ruta.push(id);
  }
  return ruta;
}

function normalizarRango(value) {
  const rango = value && typeof value === 'object' ? value : {};
  const min = entero(rango.min, (n) => Number.isInteger(n) && n >= 0, 0);
  const max = rango.max === null ? null : entero(rango.max, (n) => Number.isInteger(n) && n >= min, null);
  return { min, max };
}

function normalizarCamara(value) {
  const camara = value && typeof value === 'object' ? value : {};
  const x = entero(camara.x, Number.isFinite, 0);
  const y = entero(camara.y, Number.isFinite, 0);
  const k = Math.min(6, Math.max(0.3, entero(camara.k, Number.isFinite, 1)));
  return { x, y, k };
}

/** Normaliza un estado guardado o restaurado sin confiar en tipos, enumeraciones ni identificadores obsoletos. */
export function normalizarEstado(value, contexto = {}) {
  const estado = value && typeof value === 'object' ? value : {};
  const ids = contextoIds(contexto || {}, contexto && contexto.datos);
  const temas = contextoTemas(contexto || {}, contexto && contexto.datos);
  const capas = contextoCapas(contexto || {}, contexto && contexto.datos);
  const modo = estado.modo === 'radial' ? 'radial' : 'capas';
  const panel = ['nota', 'salud', 'vacios', 'tabla'].includes(estado.panel) ? estado.panel : null;
  const seleccion = texto(estado.seleccion);
  const sobre = texto(estado.sobre);
  return {
    modo,
    camara: normalizarCamara(estado.camara),
    filtro: filtroTexto(estado.filtro),
    temas: normalizarLista(estado.temas, temas, false, MAX_SELECCION),
    capas: normalizarLista(estado.capas, capas, true, MAX_SELECCION),
    rangoGrado: normalizarRango(estado.rangoGrado),
    actividadDias: [0, 7, 30, 90].includes(Number(estado.actividadDias)) ? Number(estado.actividadDias) : 0,
    soloExternas: estado.soloExternas === true,
    soloLargoAlcance: estado.soloLargoAlcance === true,
    colapsados: normalizarLista(estado.colapsados, temas),
    seleccion: seleccion && (!ids || ids.has(seleccion)) ? seleccion : null,
    sobre: sobre && (!ids || ids.has(sobre)) ? sobre : null,
    ruta: normalizarRuta(estado.ruta, ids),
    panel,
    temaVisual: estado.temaVisual === 'noche' ? 'noche' : 'tema',
  };
}

function aristasDatos(datos) {
  return datos && Array.isArray(datos.aristas) ? datos.aristas : [];
}


function actividadValida(nodo, dias, ahora) {
  if (!dias) return true;
  const valor = nodo && nodo.updated;
  const tiempo = typeof valor === 'number' ? valor : Date.parse(valor);
  if (!Number.isFinite(tiempo)) return false;
  return ahora - tiempo <= dias * DIAS;
}

function idArista(a, b) {
  return JSON.stringify([a, b].sort());
}

function gradoDe(nodo, adyacencia) {
  const declarado = entero(nodo && nodo.grado, (n) => n >= 0, null);
  return declarado === null ? adyacencia.get(texto(nodo && nodo.id))?.size || 0 : declarado;
}

function resumenConteos(datos, visibles, porId) {
  const nodos = nodosDe(datos);
  const aristas = aristasDatos(datos).filter((e) => visibles.has(texto(e && e[0])) && visibles.has(texto(e && e[1])));
  const ids = [...visibles].sort();
  const idsAristas = aristas.map((e) => idArista(texto(e[0]), texto(e[1]))).sort();
  const porCapa = new Map();
  const porTema = new Map();
  for (const id of ids) {
    const n = porId.get(id);
    const capa = entero(n && n.capa, (v) => v >= 0, null);
    if (capa !== null) porCapa.set(capa, (porCapa.get(capa) || 0) + 1);
    const tema = texto(n && n.tema);
    if (tema) porTema.set(tema, (porTema.get(tema) || 0) + 1);
  }
  return {
    conteos: {
      notas: nodos.filter((n) => !n.fuente).length,
      enlaces: aristasDatos(datos).length,
      fuentes: nodos.filter((n) => n.fuente).length,
      visibles: visibles.size,
      fuera: Math.max(0, nodos.length - visibles.size),
      notasVisibles: nodos.filter((n) => !n.fuente && visibles.has(texto(n && n.id))).length,
      enlacesVisibles: aristas.length,
      explicadas: aristas.filter((e) => texto(e && e[2])).length,
      porCapa: Object.fromEntries([...porCapa].sort(([a], [b]) => a - b)),
      porTema: Object.fromEntries([...porTema].sort(([a], [b]) => a.localeCompare(b))),
    },
    alcance: { tipo: 'visible', ids, aristas: idsAristas },
  };
}

/** Aplica el estado per-view al grafo sin modificar ni sus nodos ni sus aristas. */
export function aplicarFiltros(datos, estado) {
  const grafo = datos && typeof datos === 'object' ? datos : { nodos: [], aristas: [] };
  const normal = normalizarEstado(estado, { datos: grafo });
  const porId = new Map(nodosDe(grafo).map((n) => [texto(n && n.id), n]).filter(([id]) => id));
  const adyacencia = new Map([...porId.keys()].map((id) => [id, new Set()]));
  const largos = new Set();
  for (const arista of aristasDatos(grafo)) {
    const a = texto(arista && arista[0]);
    const b = texto(arista && arista[1]);
    if (!a || !b || a === b || !porId.has(a) || !porId.has(b)) continue;
    adyacencia.get(a).add(b);
    adyacencia.get(b).add(a);
    const capaA = entero(porId.get(a).capa, (v) => v >= 0, null);
    const capaB = entero(porId.get(b).capa, (v) => v >= 0, null);
    if (capaA !== null && capaB !== null && Math.abs(capaA - capaB) >= 2) {
      largos.add(a);
      largos.add(b);
    }
  }

  const ahora = Date.now();
  const visibles = new Set();
  for (const [id, nodo] of porId) {
    const capa = entero(nodo.capa, (v) => v >= 0, null);
    const tema = texto(nodo.tema);
    const grado = gradoDe(nodo, adyacencia);
    if (normal.capas.length && !normal.capas.includes(capa)) continue;
    if (normal.temas.length && (!tema || !normal.temas.includes(tema))) continue;
    if (grado < normal.rangoGrado.min || (normal.rangoGrado.max !== null && grado > normal.rangoGrado.max)) continue;
    if (!actividadValida(nodo, normal.actividadDias, ahora)) continue;
    if (normal.soloExternas && !(Array.isArray(nodo.enlaces) && nodo.enlaces.length)) continue;
    if (normal.soloLargoAlcance && !largos.has(id)) continue;
    visibles.add(id);
  }

  const resumen = resumenConteos(grafo, visibles, porId);
  return { visibles, ...resumen };
}
