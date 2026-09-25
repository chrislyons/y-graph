import { REGLAS } from './model/graph.js';
import { metricas, vecindades } from './model/analysis.js';
import { aplicarFiltros, normalizarEstado } from './view/state.js';

const FORMATOS = new Set(['png', 'svg', 'html', 'json', 'csv']);

function texto(value) {
  return value == null ? '' : String(value);
}

function id(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function comparar(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function entero(value, defecto = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : defecto;
}

function limitarProfundidad(value) {
  return Math.max(1, Math.min(4, entero(value, 2)));
}

function fechaLocal(value = Date.now()) {
  const fecha = value instanceof Date ? value : new Date(value);
  const d = Number.isFinite(fecha.getTime()) ? fecha : new Date(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function momento(value = Date.now()) {
  const fecha = value instanceof Date ? value : new Date(value);
  return (Number.isFinite(fecha.getTime()) ? fecha : new Date(0)).toISOString();
}

function nodosDe(grafo) {
  if (!grafo || grafo.nodos == null) return [];
  if (Array.isArray(grafo.nodos)) return grafo.nodos.filter((nodo) => nodo && typeof nodo === 'object');
  if (typeof grafo.nodos === 'object') return Object.values(grafo.nodos).filter((nodo) => nodo && typeof nodo === 'object');
  return [];
}

function parteArista(arista, posicion) {
  if (Array.isArray(arista)) return arista[posicion];
  if (!arista || typeof arista !== 'object') return undefined;
  return [arista.a, arista.b, arista.motivo, arista.frase, arista.citas, arista.linea_origen][posicion];
}

function valorFrase(frase) {
  if (typeof frase === 'string') return frase;
  if (!frase || typeof frase !== 'object') return '';
  return texto(frase.texto || frase.frase || frase.valor);
}

function valorLinea(frase, alternativa) {
  if (frase && typeof frase === 'object' && frase.linea != null) return frase.linea;
  return alternativa == null ? null : alternativa;
}

function aristasDe(grafo) {
  const lista = Array.isArray(grafo && grafo.aristas) ? grafo.aristas
    : Array.isArray(grafo && grafo.enlaces) ? grafo.enlaces
      : grafo && grafo.enlaces && typeof grafo.enlaces === 'object' ? Object.values(grafo.enlaces) : [];
  return lista.filter((arista) => Array.isArray(arista) || (arista && typeof arista === 'object'));
}

function claveArista(a, b) {
  return JSON.stringify([a, b].sort(comparar));
}

function normalizarAristas(grafo, porId) {
  const canonicas = new Map();
  for (const arista of aristasDe(grafo)) {
    const a = id(parteArista(arista, 0));
    const b = id(parteArista(arista, 1));
    if (!a || !b || a === b || !porId.has(a) || !porId.has(b)) continue;
    const x = comparar(a, b) <= 0 ? a : b;
    const y = comparar(a, b) <= 0 ? b : a;
    const clave = claveArista(x, y);
    const frase = parteArista(arista, 3);
    const citas = parteArista(arista, 4);
    const actual = canonicas.get(clave) || {
      origen: x,
      destino: y,
      motivo: texto(parteArista(arista, 2)),
      frase: valorFrase(frase),
      linea: valorLinea(frase, parteArista(arista, 5)),
      frase_origen: valorFrase(frase),
      linea_origen: valorLinea(frase, citas && typeof citas === 'object' ? citas.linea : citas),
    };
    if (!actual.motivo) actual.motivo = texto(parteArista(arista, 2));
    if (!actual.frase) {
      actual.frase = valorFrase(frase);
      actual.frase_origen = actual.frase;
    }
    if (actual.linea == null) {
      actual.linea = valorLinea(frase, parteArista(arista, 5));
      actual.linea_origen = valorLinea(frase, citas && typeof citas === 'object' ? citas.linea : citas);
    }
    canonicas.set(clave, actual);
  }
  return [...canonicas.values()];
}

function esFuente(nodo, opciones) {
  const ids = opciones && opciones.idsFuente instanceof Set ? opciones.idsFuente : new Set();
  return !!(nodo && (nodo.fuente === true || ids.has(id(nodo.id)) || /^raw:/.test(id(nodo.id))));
}

function nombreTema(grafo, tema) {
  const valor = grafo && grafo.temas && grafo.temas[tema];
  if (Array.isArray(valor)) return texto(valor[0] || tema);
  if (valor && typeof valor === 'object') return texto(valor.nombre || valor.name || tema);
  return texto(valor || tema);
}

function colorTema(grafo, tema) {
  const valor = grafo && grafo.temas && grafo.temas[tema];
  if (Array.isArray(valor)) return texto(valor[1]);
  if (valor && typeof valor === 'object') return texto(valor.color);
  return '';
}

function nombreCapa(capas, indice) {
  const capa = Array.isArray(capas) ? capas[indice] : null;
  if (Array.isArray(capa)) return texto(capa[1] || capa[0] || indice + 1);
  if (capa && typeof capa === 'object') return texto(capa.nombre || capa.name || capa.id || indice + 1);
  return capa == null ? String(indice + 1) : texto(capa);
}

function normalizarCapas(grafo) {
  if (Array.isArray(grafo && grafo.capas)) return grafo.capas.map((capa, indice) => {
    if (Array.isArray(capa)) return { id: texto(capa[0] || indice), nombre: texto(capa[1] || capa[0] || indice + 1), descripcion: texto(capa[2]) };
    if (capa && typeof capa === 'object') return { id: texto(capa.id || indice), nombre: texto(capa.nombre || capa.name || capa.id || indice + 1), descripcion: texto(capa.descripcion || capa.description) };
    return { id: String(indice), nombre: texto(capa || indice + 1), descripcion: '' };
  });
  if (grafo && grafo.capas && typeof grafo.capas === 'object') return Object.entries(grafo.capas).map(([capaId, valor], indice) => {
    if (Array.isArray(valor)) return { id: capaId, nombre: texto(valor[0] || capaId), descripcion: texto(valor[1]) };
    if (valor && typeof valor === 'object') return { id: texto(valor.id || capaId), nombre: texto(valor.nombre || valor.name || capaId), descripcion: texto(valor.descripcion || valor.description) };
    return { id: capaId, nombre: texto(valor || capaId), descripcion: '' };
  });
  return [];
}

function normalizarTemas(grafo) {
  if (Array.isArray(grafo && grafo.temas)) return grafo.temas.map((tema, indice) => {
    if (Array.isArray(tema)) return { id: texto(tema[0] || indice), nombre: texto(tema[1] || tema[0] || indice + 1), color: texto(tema[2]) };
    if (tema && typeof tema === 'object') return { id: texto(tema.id || indice), nombre: texto(tema.nombre || tema.name || tema.id || indice + 1), color: texto(tema.color) };
    return { id: String(indice), nombre: texto(tema || indice + 1), color: '' };
  });
  if (grafo && grafo.temas && typeof grafo.temas === 'object') return Object.entries(grafo.temas).map(([temaId, valor]) => {
    if (Array.isArray(valor)) return { id: temaId, nombre: texto(valor[0] || temaId), color: texto(valor[1]) };
    if (valor && typeof valor === 'object') return { id: texto(valor.id || temaId), nombre: texto(valor.nombre || valor.name || temaId), color: texto(valor.color) };
    return { id: temaId, nombre: texto(valor || temaId), color: '' };
  });
  return [];
}

function resumenFiltros(estado, visibles) {
  return {
    filtro: estado.filtro,
    temas: [...estado.temas],
    capas: [...estado.capas],
    rangoGrado: { ...estado.rangoGrado },
    actividadDias: estado.actividadDias,
    soloExternas: estado.soloExternas,
    soloLargoAlcance: estado.soloLargoAlcance,
    visibles: [...visibles].sort(comparar),
  };
}


/** Normaliza un grafo y limita sus artefactos al alcance explícito solicitado. */
export function datosExportables(grafo, alcance = 'visible', opciones = {}) {
  const opcionesDirectas = opciones && typeof opciones === 'object' ? Object.assign({}, opciones) : {};
  const datos = grafo && grafo.datos ? grafo.datos : grafo && grafo.grafo ? grafo.grafo : grafo && typeof grafo === 'object' ? grafo : {};
  const objetoAlcance = alcance && typeof alcance === 'object' ? alcance : {};
  const scope = typeof alcance === 'string' ? alcance : objetoAlcance.alcance || objetoAlcance.scope || grafo?.alcance || grafo?.scope || 'visible';
  const config = Object.assign({}, opcionesDirectas, (grafo && typeof grafo === 'object' && !Array.isArray(grafo) ? grafo : {}), objetoAlcance);
  const estado = normalizarEstado(config.estado || config.state || config.vista || {}, { datos });
  const ahora = config.ahora != null ? config.ahora : Date.now();
  const titulo = opcionesDirectas.titulo ?? opcionesDirectas.title ?? config.titulo ?? config.title ?? null;
  const nodos = nodosDe(datos);
  const ids = new Set(nodos.map((nodo) => id(nodo.id)).filter(Boolean));
  const porId = new Map(nodos.map((nodo) => [id(nodo.id), nodo]).filter(([nodoId]) => nodoId));
  const aristas = normalizarAristas(datos, porId);
  let idsVisibles;
  if (scope === 'all') idsVisibles = new Set(ids);
  else if (scope === 'focused') {
    const seleccion = texto(config.seleccion || estado.seleccion);
    const profundidad = limitarProfundidad(config.profundidadRadial ?? (datos.contexto && datos.contexto.profundidadRadial) ?? estado.profundidadRadial);
    const contexto = { ...(datos.contexto || {}), profundidadRadial: profundidad };
    const vecinos = vecindades({ ...datos, contexto }, seleccion, profundidad);
    idsVisibles = new Set(vecinos.ids);
  } else idsVisibles = new Set(aplicarFiltros(datos, estado).visibles);

  const aristasVisibles = aristas.filter((arista) => idsVisibles.has(arista.origen) && idsVisibles.has(arista.destino));
  const nodosVisibles = nodos.filter((nodo) => idsVisibles.has(id(nodo.id)));
  const idsFuente = new Set(nodos.filter((nodo) => esFuente(nodo, config)).map((nodo) => id(nodo.id)));
  const nodosNota = nodosVisibles.filter((nodo) => !idsFuente.has(id(nodo.id)));
  const fuentes = nodosVisibles.filter((nodo) => idsFuente.has(id(nodo.id)));
  const UltimaCapa = Math.max(0, normalizarCapas(datos).length - 1);
  const hubs = config.hubs instanceof Map ? config.hubs
    : config.hubs && typeof config.hubs === 'object' ? new Map(Object.entries(config.hubs))
      : config.hubPorTema instanceof Map ? config.hubPorTema : new Map();
  const salidaNodos = nodosNota.map((nodo) => ({
    id: id(nodo.id),
    titulo: texto(nodo.titulo || nodo.id),
    capa: entero(nodo.capa, -1),
    capaNombre: nombreCapa(datos.capas, entero(nodo.capa, -1)),
    tema: nodo.tema == null ? null : texto(nodo.tema),
    temaNombre: nodo.tema ? nombreTema(datos, nodo.tema) : null,
    temaDeclarado: nodo.propio === true,
    grado: entero(nodo.grado, 0),
    hub: nodo.hub === true || (entero(nodo.capa, -1) === UltimaCapa && hubs.get(texto(nodo.tema)) === id(nodo.id)),
    updated: nodo.updated == null ? null : nodo.updated,
  }));
  const salidaFuentes = fuentes.map((nodo) => ({ id: id(nodo.id), ruta: texto(nodo.ruta || nodo.id), titulo: texto(nodo.titulo || nodo.id), rota: nodo.rota === true, capa: entero(nodo.capa, 0) }));
  const compatibilidadLegada = config.compatibilidadLegada === true;
  const enlaces = (compatibilidadLegada
    ? aristasVisibles.filter((arista) => !idsFuente.has(arista.origen) && !idsFuente.has(arista.destino))
    : aristasVisibles).map((arista) => ({
      origen: arista.origen,
      destino: arista.destino,
      motivo: arista.motivo,
      frase: arista.frase,
      linea: arista.linea,
      motivo_origen: arista.motivo,
      frase_origen: arista.frase_origen,
      linea_origen: arista.linea_origen,
    }));
  const resumenAristas = aristasVisibles.length;
  const resumenEnlaces = compatibilidadLegada ? enlaces.length : resumenAristas;
  const grafoAlcance = { nodos: nodosVisibles, aristas: aristasVisibles, capas: datos.capas || [], temas: datos.temas || {} };
  return {
    titulo,
    version: texto(config.version || datos.version || ''),
    fecha: fechaLocal(ahora),
    schemaVersion: 2,
    alcance: scope,
    vista: estado,
    filtros: resumenFiltros(estado, idsVisibles),
    metricas: metricas(grafoAlcance, null),
    generado: momento(ahora),
    resumen: {
      nodos: salidaNodos.length,
      enlaces: resumenEnlaces,
      fuentes: salidaFuentes.length,
      porCapa: normalizarCapas(datos).map((_, indice) => salidaNodos.filter((nodo) => nodo.capa === indice).length),
      aristas: resumenAristas,
    },
    reglas: config.reglas || datos.reglas || REGLAS,
    capas: normalizarCapas(datos),
    temas: normalizarTemas(datos),
    nodos: salidaNodos,
    enlaces,
    fuentes: salidaFuentes,
  };
}

function asegurarDatos(datos, opciones = {}) {
  if (datos && datos.schemaVersion === 2 && Array.isArray(datos.nodos) && Array.isArray(datos.enlaces)) return datos;
  const fuente = datos && (datos.datos || datos.grafo || datos.D || (typeof datos.getState === 'function' ? datos : null));
  if (fuente) return datosExportables(fuente, opciones.alcance || opciones.scope || 'visible', {
    ...opciones,
    estado: opciones.estado || opciones.state || (typeof datos.getState === 'function' ? datos.getState() : datos.estado),
  });
  return datosExportables(datos, opciones.alcance || opciones.scope || 'visible', opciones);
}

function celdaCSV(value) {
  const valor = value == null ? '' : String(value);
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Crea un CSV compatible con la primera versión y Extiende cada fila con su origen literal. */
export function crearCSV(datos, opciones = {}) {
  const salida = asegurarDatos(datos, opciones);
  const columnas = opciones.columnasLegacy === true || opciones.compatibilidadLegada === true
    ? ['origen', 'destino', 'capa_origen', 'capa_destino', 'motivo', 'frase']
    : ['origen', 'destino', 'capa_origen', 'capa_destino', 'motivo', 'frase', 'motivo_origen', 'frase_origen', 'linea_origen'];
  const capas = new Map([...salida.nodos, ...salida.fuentes].map((nodo) => [nodo.id, entero(nodo.capa, 0)]));
  const filas = salida.enlaces.map((enlace) => columnas.map((columna) => {
    if (columna === 'capa_origen') return capas.get(enlace.origen);
    if (columna === 'capa_destino') return capas.get(enlace.destino);
    return enlace[columna];
  }).map(celdaCSV).join(','));
  return [columnas.join(','), ...filas].join('\n');
}

/** Serializa el contrato de datos sin transformarlo ni perder sus referencias. */
export function crearJSON(datos, opciones = {}) {
  const salida = asegurarDatos(datos, opciones);
  return JSON.stringify(salida, null, opciones.indentacion == null ? 2 : opciones.indentacion);
}

function escaparXML(value) {
  return texto(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escaparHTML(value) {
  return escaparXML(value);
}

function JSONEnScript(value) {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function colorSeguro(value, defecto) {
  const color = texto(value).trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : defecto;
}

function numeroSeguro(value, defecto = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defecto;
}

function escenaDe(datos, opciones) {
  const escena = opciones.escena || opciones.scene || (opciones.renderizador && opciones.renderizador.scene) || (opciones.renderer && opciones.renderer.scene) || null;
  const permitidos = new Set([...datos.nodos, ...datos.fuentes].map((nodo) => nodo.id));
  const info = new Map([...datos.nodos, ...datos.fuentes].map((nodo) => [nodo.id, nodo]));
  const nodos = [];
  if (escena && Array.isArray(escena.nodes)) {
    for (const nodo of escena.nodes) if (nodo && permitidos.has(texto(nodo.id))) nodos.push({ ...nodo, id: texto(nodo.id), x: numeroSeguro(nodo.x), y: numeroSeguro(nodo.y), radio: Math.max(3, numeroSeguro(nodo.radio, 7)) });
  } else {
    const posiciones = opciones.posiciones instanceof Map ? opciones.posiciones : new Map();
    const porCapa = new Map();
    for (const nodo of [...datos.nodos, ...datos.fuentes]) {
      const capa = entero(nodo.capa, 0);
      if (!porCapa.has(capa)) porCapa.set(capa, []);
      porCapa.get(capa).push(nodo);
    }
    for (const [capa, lista] of [...porCapa.entries()].sort((a, b) => a[0] - b[0])) {
      lista.forEach((nodo, indice) => {
        const punto = posiciones.get(nodo.id) || posiciones.get(JSON.stringify([capa, nodo.id]));
        nodos.push({ ...nodo, x: punto ? numeroSeguro(punto.x, 100 + capa * 240) : 100 + capa * 240, y: punto ? numeroSeguro(punto.y, 80 + indice * 38) : 80 + indice * 38, radio: 7, original: nodo });
      });
    }
  }
  const porPosicion = new Map(nodos.map((nodo) => [nodo.id, nodo]));
  const aristas = [];
  if (escena && Array.isArray(escena.edges)) {
    for (const arista of escena.edges) {
      const a = texto(arista && arista.a);
      const b = texto(arista && arista.b);
      if (!porPosicion.has(a) || !porPosicion.has(b)) continue;
      const A = porPosicion.get(a), B = porPosicion.get(b);
      aristas.push({ ...arista, a, b, c1x: numeroSeguro(arista.c1x, (A.x + B.x) / 2), c2x: numeroSeguro(arista.c2x, (A.x + B.x) / 2), c1y: numeroSeguro(arista.c1y, A.y), c2y: numeroSeguro(arista.c2y, B.y), bounds: arista.bounds });
    }
  } else {
    const porClave = new Map(datos.enlaces.map((enlace) => [claveArista(enlace.origen, enlace.destino), enlace]));
    for (const [clave, enlace] of porClave) {
      const par = JSON.parse(clave);
      const A = porPosicion.get(par[0]), B = porPosicion.get(par[1]);
      if (!A || !B) continue;
      aristas.push({ ...enlace, a: par[0], b: par[1], c1x: (A.x + B.x) / 2, c2x: (A.x + B.x) / 2, c1y: A.y, c2y: B.y, kind: 'cross' });
    }
  }
  return {
    nodos,
    aristas,
    capas: escena && Array.isArray(escena.layers) ? escena.layers : [],
    etiquetas: escena && Array.isArray(escena.labelPlacements) ? escena.labelPlacements : [],
    info,
    escena,
  };
}

function dimensiones(_datos, opciones) {
  const frame = opciones.frame || {};
  const viewport = (opciones.renderizador && opciones.renderizador.viewport) || (opciones.renderer && opciones.renderer.viewport) || (opciones.escena && opciones.escena.viewport) || frame;
  const ancho = Math.max(1, numeroSeguro(opciones.ancho ?? opciones.width ?? frame.width ?? viewport?.width, 1200));
  const alto = Math.max(1, numeroSeguro(opciones.alto ?? opciones.height ?? frame.height ?? viewport?.height, 800));
  return { ancho, alto };
}

function posicionPantalla(nodo, camara, reserva, movil) {
  const x = nodo.x * camara.k + (movil ? camara.x : camara.x - reserva / 2);
  const y = nodo.y * camara.k + (movil ? camara.y : camara.y - reserva / 2);
  return { x, y, r: Math.max(2, nodo.radio * camara.k) };
}

function formaNodoSVG(nodo, pantalla, color) {
  const radio = pantalla.r;
  if (nodo.kind === 'source' || nodo.fuenteVisual || /^raw:/.test(nodo.id)) {
    const puntos = `${pantalla.x},${pantalla.y - radio} ${pantalla.x + radio},${pantalla.y} ${pantalla.x},${pantalla.y + radio} ${pantalla.x - radio},${pantalla.y}`;
    return `<polygon data-id="${escaparXML(nodo.id)}" points="${puntos}" fill="${color}"/>`;
  }
  return `<circle data-id="${escaparXML(nodo.id)}" cx="${pantalla.x}" cy="${pantalla.y}" r="${radio}" fill="${color}"/>`;
}

function saludNodo(nodo) {
  return nodo.original && (nodo.original.salud === true || nodo.original.rota === true || numeroSeguro(nodo.original.sinMotivo) > 0 || nodo.salud === true || nodo.rota === true);
}

function supernodo(nodo) {
  return nodo.kind === 'supernode' || nodo.supernode === true || nodo.original?.supernode === true;
}

/** Genera SVG desde las primitivas de la escena, sin convertir ni raspar el Canvas. */
export function crearSVG(datos, opciones = {}) {
  const salida = asegurarDatos(datos, opciones);
  const escena = escenaDe(salida, opciones);
  const { ancho, alto } = dimensiones(salida, opciones);
  const estado = salida.vista || {};
  const camara = { x: numeroSeguro(estado.camara?.x), y: numeroSeguro(estado.camara?.y), k: Math.max(0.3, Math.min(6, numeroSeguro(estado.camara?.k, 1))) };
  const reserva = Math.max(0, numeroSeguro(opciones.reservaPanel ?? estado.reservaPanel, 0));
  const movil = opciones.mobile === true || ancho < 640;
  const titulo = String(salida.titulo || opciones.titulo || opciones.title || `Why Graph — ${salida.alcance}`);
  const conteos = { nodos: salida.nodos.length + salida.fuentes.length, notas: salida.nodos.length, fuentes: salida.fuentes.length, enlaces: salida.enlaces.length };
  const descripcion = `Ámbito ${salida.alcance}; ${conteos.nodos} nodos, ${conteos.enlaces} enlaces; generado ${salida.generado}; zoom ${Math.round(camara.k * 100)}%.`;
  const filtro = JSON.stringify(salida.filtros);
  const metadata = {
    schemaVersion: salida.schemaVersion,
    alcance: salida.alcance,
    resumen: salida.resumen,
    metricas: salida.metricas,
    filtros: salida.filtros,
    vista: salida.vista,
    generado: salida.generado,
  };
  const piezas = [];
  const porNodoEscena = new Map(escena.nodos.map((nodo) => [nodo.id, nodo]));
  piezas.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-labelledby="why-graph-title why-graph-desc">`);
  piezas.push(`<title id="why-graph-title">${escaparXML(titulo)}</title>`);
  piezas.push(`<desc id="why-graph-desc">${escaparXML(descripcion)}</desc>`);
  piezas.push(`<metadata id="why-graph-metadata">${escaparXML(JSON.stringify(metadata))}</metadata>`);
  piezas.push(`<rect width="${ancho}" height="${alto}" fill="#f8fafc"/>`);
  piezas.push(`<g id="why-graph-layers" aria-label="Capas">`);
  for (const capa of escena.capas) {
    const x = numeroSeguro(capa.x) * camara.k + (movil ? camara.x : camara.x - reserva / 2) - 14;
    const y0 = numeroSeguro(capa.y0) * camara.k + (movil ? camara.y : camara.y - reserva / 2);
    const y1 = numeroSeguro(capa.y1) * camara.k + (movil ? camara.y : camara.y - reserva / 2);
    piezas.push(`<rect x="${x}" y="${y0}" width="28" height="${Math.max(0, y1 - y0)}" fill="none" stroke="#64748b"/>`);
    piezas.push(`<text x="${x + 14}" y="${y0 - 12}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#0f172a">${escaparXML(capa.nombre || capa.name || capa.def?.[1] || '')}</text>`);
  }
  piezas.push('</g>');
  piezas.push('<g id="why-graph-edges" fill="none" stroke="#64748b" stroke-width="1.25">');
  for (const arista of escena.aristas) {
    const A = porNodoEscena.get(arista.a);
    const B = porNodoEscena.get(arista.b);
    if (!A || !B) continue;
    const a = posicionPantalla(A, camara, reserva, movil), b = posicionPantalla(B, camara, reserva, movil);
    const d = `M ${a.x} ${a.y} C ${numeroSeguro(arista.c1x) * camara.k + (movil ? camara.x : camara.x - reserva / 2)} ${numeroSeguro(arista.c1y) * camara.k + (movil ? camara.y : camara.y - reserva / 2)}, ${numeroSeguro(arista.c2x) * camara.k + (movil ? camara.x : camara.x - reserva / 2)} ${numeroSeguro(arista.c2y) * camara.k + (movil ? camara.y : camara.y - reserva / 2)}, ${b.x} ${b.y}`;
    piezas.push(`<path data-edge="${escaparXML(claveArista(arista.a, arista.b))}" d="${d}"${arista.motivo ? '' : ' stroke-dasharray="5 4"'}/>`);
  }
  piezas.push('</g>');
  piezas.push('<g id="why-graph-nodes">');
  const trazados = new Set(escena.etiquetas.map((etiqueta) => texto(etiqueta.nodeId || etiqueta.id)));
  for (const nodo of escena.nodos) {
    const pantalla = posicionPantalla(nodo, camara, reserva, movil);
    const info = escena.info.get(nodo.id) || {};
    const color = colorSeguro(nodo.color || colorTema(datos, info.tema), nodo.kind === 'source' || /^raw:/.test(nodo.id) ? '#7c3aed' : '#2563eb');
    piezas.push(formaNodoSVG(nodo, pantalla, color));
    if (supernodo(nodo) || saludNodo(nodo)) piezas.push(`<circle cx="${pantalla.x}" cy="${pantalla.y}" r="${pantalla.r + 4}" fill="none" stroke="#0f172a" stroke-width="1.5"${saludNodo(nodo) ? ' stroke-dasharray="4 3"' : ''}/>`);
    if (estado.seleccion === nodo.id || (Array.isArray(estado.ruta) && estado.ruta.includes(nodo.id))) piezas.push(`<circle cx="${pantalla.x}" cy="${pantalla.y}" r="${pantalla.r + 7}" fill="none" stroke="#2563eb" stroke-width="2"/>`);
    piezas.push(`<title>${escaparXML(info.titulo || nodo.id)}</title>`);
    if (opciones.etiquetas === true || trazados.has(nodo.id) || estado.seleccion === nodo.id || (Array.isArray(estado.ruta) && estado.ruta.includes(nodo.id))) {
      piezas.push(`<text x="${pantalla.x + pantalla.r + 4}" y="${pantalla.y - pantalla.r - 4}" font-family="system-ui,sans-serif" font-size="12" fill="#0f172a" stroke="#f8fafc" stroke-width="3" paint-order="stroke">${escaparXML(info.titulo || nodo.titulo || nodo.id)}</text>`);
    }
  }
  piezas.push('</g>');
  piezas.push(`<g id="why-graph-summary" font-family="system-ui,sans-serif" font-size="12" fill="#0f172a"><text x="16" y="20">${escaparXML(`Why Graph · ${salida.alcance} · ${conteos.nodos} nodos · ${conteos.enlaces} enlaces · ${salida.generado} · zoom ${Math.round(camara.k * 100)}%`)}</text><text x="16" y="38">${escaparXML(`Filtros: ${filtro}`)}</text></g>`);
  piezas.push(`<g id="why-graph-legend" transform="translate(${Math.max(16, ancho - 250)} 58)" font-family="system-ui,sans-serif" font-size="12" fill="#0f172a" aria-label="Leyenda"><text y="0" font-weight="700">Leyenda</text><circle cx="8" cy="20" r="6" fill="#2563eb"/><text x="22" y="24">Nota</text><polygon points="62,14 68,20 62,26 56,20" fill="#7c3aed"/><text x="76" y="24">Fuente</text><circle cx="142" cy="20" r="6" fill="none" stroke="#0f172a" stroke-width="2"/><text x="156" y="24">Supernodo</text><circle cx="8" cy="42" r="6" fill="none" stroke="#dc2626" stroke-dasharray="3 2"/><text x="22" y="46">Con problemas</text></g>`);
  piezas.push('</svg>');
  return piezas.join('\n');
}

function dataURLSVG(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function blobComoDataURL(blob) {
  if (typeof FileReader === 'undefined') {
    if (typeof Blob === 'function' && typeof blob.arrayBuffer === 'function' && typeof btoa === 'function') {
      return blob.arrayBuffer().then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binario = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `data:${texto(blob.type) || 'image/png'};base64,${btoa(binario)}`;
      });
    }
    return Promise.resolve('');
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(texto(reader.result));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

/** Crea un PNG desde frameForExport y limita su dimensión física a 8192 px. */
export async function crearPNG(vista, opciones = {}) {
  const opcionesFrame = {
    ...opciones,
    width: numeroSeguro(opciones.ancho ?? opciones.width, 0) || undefined,
    height: numeroSeguro(opciones.alto ?? opciones.height, 0) || undefined,
  };
  let frame = vista && typeof vista === 'object' && vista.canvas ? vista : (opciones.frame || null);
  if (vista && typeof vista.frameForExport === 'function') {
    const width = Math.max(1, numeroSeguro(opcionesFrame.width, numeroSeguro(vista.viewport?.width, 1200)));
    const height = Math.max(1, numeroSeguro(opcionesFrame.height, numeroSeguro(vista.viewport?.height, 800)));
    const escala = Math.min(2, 8192 / Math.max(width, height));
    frame = vista.frameForExport({ width, height, dpr: escala, modoPresentacion: true });
  }
  if (!frame || !frame.canvas) throw new Error('PNG');
  const canvas = frame.canvas;
  const ancho = Math.max(1, Math.round(numeroSeguro(canvas.width, numeroSeguro(frame.width, 1))));
  const alto = Math.max(1, Math.round(numeroSeguro(canvas.height, numeroSeguro(frame.height, 1))));
  let blob = null;
  if (typeof canvas.toBlob === 'function') {
    try { blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')); } catch { blob = null; }
  }
  let dataUrl = '';
  if (opciones.incluirDataURL === true || !blob) {
    if (typeof canvas.toDataURL === 'function') {
      try { dataUrl = texto(canvas.toDataURL('image/png')); } catch { dataUrl = ''; }
    }
  }
  if (!blob && !dataUrl) throw new Error('PNG');
  if (blob && opciones.incluirDataURL === true && !dataUrl) dataUrl = await blobComoDataURL(blob);
  const escala = Math.min(2, 8192 / Math.max(numeroSeguro(opciones.width ?? opciones.ancho, numeroSeguro(frame.width, ancho)), numeroSeguro(opciones.height ?? opciones.alto, numeroSeguro(frame.height, alto))));
  return { blob, dataUrl, mimeType: 'image/png', ancho, alto, width: ancho, height: alto, escala, frame };
}

function tablaHTML(datos) {
  const filasNodos = [...datos.nodos.map((nodo) => ({ ...nodo, tipo: 'Nota' })), ...datos.fuentes.map((fuente) => ({ ...fuente, tipo: 'Fuente', capa: 0, capaNombre: '', temaNombre: null, grado: 0 }))]
    .map((nodo) => `<tr><th scope="row">${escaparHTML(nodo.id)}</th><td>${escaparHTML(nodo.tipo)}</td><td>${escaparHTML(nodo.titulo || nodo.id)}</td><td>${escaparHTML(nodo.capaNombre || nodo.capa || 0)}</td><td>${escaparHTML(nodo.temaNombre || nodo.tema || '')}</td><td>${escaparHTML(nodo.grado ?? 0)}</td></tr>`).join('');
  const filasEnlaces = datos.enlaces.map((enlace) => `<tr><th scope="row">${escaparHTML(claveArista(enlace.origen, enlace.destino))}</th><td>${escaparHTML(enlace.origen)}</td><td>${escaparHTML(enlace.destino)}</td><td>${escaparHTML(enlace.motivo)}</td><td>${escaparHTML(enlace.frase)}</td><td>${escaparHTML(enlace.linea ?? '')}</td></tr>`).join('');
  return `<section aria-label="Tabla de datos"><h2>Tabla de datos</h2><table><caption>Nodos (${datos.nodos.length + datos.fuentes.length})</caption><thead><tr><th>Nodo</th><th>Tipo</th><th>Título</th><th>Capa</th><th>Tema</th><th>Grado</th></tr></thead><tbody>${filasNodos || '<tr><td colspan="6">Sin nodos</td></tr>'}</tbody></table><table><caption>Enlaces (${datos.enlaces.length})</caption><thead><tr><th>Enlace</th><th>Origen</th><th>Destino</th><th>Motivo</th><th>Frase literal</th><th>Línea</th></tr></thead><tbody>${filasEnlaces || '<tr><td colspan="6">Sin enlaces</td></tr>'}</tbody></table></section>`;
}

/** Crea un documento autónomo: SVG, tabla, metadata JSON y descargas basadas en data URLs. */
export async function crearHTML(datos, opciones = {}) {
  const salida = asegurarDatos(datos, opciones);
  const svg = opciones.svg || crearSVG(salida, opciones);
  let png = opciones.png || null;
  if (png && typeof png === 'object' && !png.dataUrl && png.blob) png = { ...png, dataUrl: await blobComoDataURL(png.blob) };
  if (opciones.pngDataUrl) png = { dataUrl: opciones.pngDataUrl };
  if (!png && !opciones.pngDataUrl) {
    const supplied = opciones.renderizador || opciones.renderer || opciones.frame || opciones.vista;
    if (supplied) png = await crearPNG(supplied, { ...opciones, incluirDataURL: true });
  }
  const pngDataUrl = texto(typeof png === 'string' ? png : (png && (png.dataUrl || png.url)));
  if (!pngDataUrl) throw new Error('PNG');
  const svgURL = dataURLSVG(svg);
  const titulo = String(salida.titulo || opciones.titulo || opciones.title || `Why Graph — ${salida.alcance}`);
  const sufijo = salida.alcance === 'visible' ? '' : `-${salida.alcance}`;
  const base = texto(opciones.nombreBase || `mapa-neuronal-${salida.fecha}${sufijo}`);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaparHTML(titulo)}</title>
<style>body{margin:0;background:#f8fafc;color:#0f172a;font:14px/1.45 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:20px}figure{margin:0 0 20px;background:#fff;border:1px solid #cbd5e1}figure svg{display:block;width:100%;height:auto}.descargas{display:flex;gap:12px;margin:12px 0}.descargas a{padding:8px 12px;background:#1d4ed8;color:#fff;border-radius:4px}table{width:100%;border-collapse:collapse;margin:12px 0 24px;background:#fff}caption{text-align:left;font-weight:700;padding:8px 0}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}thead th{background:#e2e8f0}h2{margin-top:24px}</style></head>
<body><main><h1>${escaparHTML(titulo)}</h1><nav class="descargas" aria-label="Descargas"><a download="${escaparHTML(base)}.png" href="${escaparHTML(pngDataUrl)}">Descargar PNG</a><a download="${escaparHTML(base)}.svg" href="${escaparHTML(svgURL)}">Descargar SVG</a></nav><figure>${svg}</figure>${tablaHTML(salida)}<script type="application/json" id="why-graph-metadata">${JSONEnScript(salida)}</script></main></body></html>`;
}

function normalizarFormatos(valor) {
  const entrada = Array.isArray(valor) ? valor : valor == null ? ['json', 'csv'] : [valor];
  const salida = [];
  for (let item of entrada) {
    item = texto(item).toLowerCase().replace(/^\./, '');
    if (item === 'datos' || item === 'data') salida.push('json', 'csv');
    else if (FORMATOS.has(item) && !salida.includes(item)) salida.push(item);
  }
  return salida;
}

function normalizarCarpeta(valor) {
  const carpeta = texto(valor).replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '').trim();
  if (carpeta.split('/').some((parte) => parte === '..')) throw new Error('CARPETA_EXPORTACION');
  return carpeta;
}

function adaptadorDe(vista, opciones) {
  const adapter = opciones.adapter || opciones.archivos || opciones.fileAdapter || vista?.adapter || vista?.archivos || vista?.fileAdapter || null;
  if (adapter) return adapter;
  const vault = opciones.vault || vista?.app?.vault || vista?.vault || null;
  if (!vault) return null;
  return {
    async existe(ruta) { return typeof vault.getFileByPath === 'function' ? !!vault.getFileByPath(ruta) : false; },
    async carpetaExiste(ruta) { return typeof vault.getFolderByPath === 'function' ? !!vault.getFolderByPath(ruta) : false; },
    async crearCarpeta(ruta) { if (typeof vault.createFolder === 'function') return vault.createFolder(ruta); },
    async escribirTexto(ruta, contenido) { if (typeof vault.create === 'function') return vault.create(ruta, contenido); throw new Error('ARCHIVO_EXPORTACION'); },
    async escribirBinario(ruta, contenido) { if (typeof vault.createBinary === 'function') return vault.createBinary(ruta, contenido); throw new Error('ARCHIVO_EXPORTACION'); },
  };
}

async function existeArchivo(adapter, ruta) {
  if (typeof adapter.existe === 'function') return !!await adapter.existe(ruta);
  if (typeof adapter.getFileByPath === 'function') return !!adapter.getFileByPath(ruta);
  return false;
}

async function existeCarpeta(adapter, ruta) {
  if (typeof adapter.carpetaExiste === 'function') return !!await adapter.carpetaExiste(ruta);
  if (typeof adapter.getFolderByPath === 'function') return !!adapter.getFolderByPath(ruta);
  return true;
}

async function escribirTexto(adapter, ruta, contenido) {
  if (typeof adapter.escribirTexto === 'function') return adapter.escribirTexto(ruta, contenido);
  if (typeof adapter.writeText === 'function') return adapter.writeText(ruta, contenido);
  if (typeof adapter.create === 'function') return adapter.create(ruta, contenido);
  if (typeof adapter.escribir === 'function') return adapter.escribir(ruta, contenido);
  throw new Error('ARCHIVO_EXPORTACION');
}

async function escribirBinario(adapter, ruta, contenido) {
  if (typeof adapter.escribirBinario === 'function') return adapter.escribirBinario(ruta, contenido);
  if (typeof adapter.writeBinary === 'function') return adapter.writeBinary(ruta, contenido);
  if (typeof adapter.createBinary === 'function') return adapter.createBinary(ruta, contenido);
  if (typeof adapter.escribir === 'function') return adapter.escribir(ruta, contenido);
  throw new Error('ARCHIVO_EXPORTACION');
}

function bytesDataURL(dataUrl) {
  const valor = texto(dataUrl);
  const coma = valor.indexOf(',');
  if (coma < 0) throw new Error('ARCHIVO_EXPORTACION');
  const cabecera = valor.slice(0, coma);
  const cuerpo = valor.slice(coma + 1);
  if (/;base64$/i.test(cabecera) && typeof atob !== 'function' && typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(cuerpo, 'base64');
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  let binario = '';
  if (/;base64$/i.test(cabecera)) {
    if (typeof atob !== 'function') throw new Error('ARCHIVO_EXPORTACION');
    binario = atob(cuerpo);
  } else binario = decodeURIComponent(cuerpo);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i) & 255;
  return bytes.buffer;
}

function mensajeFallo(crearMensaje, ruta, exitos) {
  if (typeof crearMensaje === 'function') return crearMensaje(ruta, exitos);
  return `No se pudo guardar «${ruta}». Archivos guardados antes del error: ${exitos.length ? exitos.join(' · ') : 'Ningún archivo'}.`;
}

function rutaDisponible(base, extension, reservadas) {
  let indice = 1;
  let ruta = `${base}.${extension}`;
  while (reservadas.has(ruta)) ruta = `${base}-${++indice}.${extension}`;
  return ruta;
}
/** Escribe los formatos pedidos en serie, deteniéndose en el primer fallo sin sobrescribir. */
export async function exportarVista(vista, opciones = {}) {
  const datos = opciones.datos || vista?.datos || vista?.grafo || vista?.D || vista || {};
  const alcance = texto(opciones.alcance || opciones.scope || 'visible');
  const config = {
    estado: opciones.estado || vista?.getState?.() || vista?.estado || {},
    seleccion: opciones.seleccion,
    profundidadRadial: opciones.profundidadRadial ?? vista?.plugin?.ajustes?.profundidadRadial,
    plugin: opciones.plugin || vista?.plugin?.manifest?.name,
    version: opciones.version || vista?.plugin?.manifest?.version,
    reglas: opciones.reglas,
    compatibilidadLegada: opciones.compatibilidadLegada === true,
    hubs: opciones.hubs ?? vista?.hubs,
    idsFuente: opciones.idsFuente,
    ahora: opciones.ahora,
    datos,
  };
  const salida = datosExportables(datos, alcance, config);
  const formatos = normalizarFormatos(opciones.formatos ?? opciones.formatos);
  if (!formatos.length) return { ok: true, alcance: salida.alcance, paths: [], files: [], datos: salida };
  const adapter = adaptadorDe(vista, opciones);
  if (!adapter) throw Object.assign(new Error('ARCHIVO_EXPORTACION'), { code: 'ARCHIVO_EXPORTACION', succeededPaths: [] });
  const carpeta = normalizarCarpeta(opciones.carpeta ?? opciones.carpetaExport ?? vista?.plugin?.ajustes?.carpetaExport ?? '');
  const baseCarpeta = carpeta ? `${carpeta}/` : '';
  const sufijo = salida.alcance === 'visible' || opciones.omitirSufijoAlcance === true ? '' : `-${salida.alcance}`;
  const base = `${baseCarpeta}mapa-neuronal-${salida.fecha}${sufijo}`;
  const renderizador = opciones.renderizador || opciones.renderer || vista?.renderizador || vista?.renderer;
  const frame = opciones.frame || vista?.frame || (vista?.lienzo ? { canvas: vista.lienzo, width: numeroSeguro(vista.anchoLogico || vista.W || vista.lienzo.width, 1200), height: numeroSeguro(vista.altoLogico || vista.H || vista.lienzo.height, 800) } : null);
  const escena = opciones.escena || opciones.scene || renderizador?.scene || (vista?.N ? { nodes: vista.N || [], edges: vista.E || [], layers: vista.capas || [] } : null);
  const comunes = { ...opciones, alcance: salida.alcance, estado: salida.vista, datos: salida, escena, renderizador, frame, compatibilidadLegada: opciones.compatibilidadLegada === true, columnasLegacy: opciones.columnasLegacy === true || opciones.compatibilidadLegada === true };
  const cache = new Map();
  const creatores = {
    async json() { return { contenido: crearJSON(salida, comunes), binario: false }; },
    async csv() { return { contenido: crearCSV(salida, comunes), binario: false }; },
    async svg() { return { contenido: crearSVG(salida, comunes), binario: false }; },
    async png() { return { contenido: await crearPNG(renderizador || frame || vista, comunes), binario: true }; },
    async html() {
      let png = cache.get('png');
      if (png) png = png.contenido;
      if (!png) {
        png = await crearPNG(renderizador || frame || vista, { ...comunes, incluirDataURL: true });
        cache.set('png', { contenido: png, binario: true });
      }
      const svg = cache.get('svg');
      return { contenido: await crearHTML(salida, { ...comunes, png, svg: svg && svg.contenido }), binario: false };
    },
  };
  const exitos = [];
  const archivos = [];
  const reservadas = new Set();
  let rutaEnCurso = carpeta || base;
  let carpetaCreada = false;
  try {
    for (const formato of formatos) {
      if (carpeta && !carpetaCreada) {
        rutaEnCurso = carpeta;
        if (!await existeCarpeta(adapter, carpeta)) {
          if (typeof adapter.crearCarpeta !== 'function') throw new Error('CARPETA_EXPORTACION');
          await adapter.crearCarpeta(carpeta);
        }
        carpetaCreada = true;
      }
      let artefacto = cache.get(formato);
      if (!artefacto) {
        artefacto = await creatores[formato]();
        cache.set(formato, artefacto);
      }
      let indice = 1;
      rutaEnCurso = rutaDisponible(base, formato, reservadas);
      while (await existeArchivo(adapter, rutaEnCurso)) rutaEnCurso = `${base}-${++indice}.${formato}`;
      while (reservadas.has(rutaEnCurso)) rutaEnCurso = `${base}-${++indice}.${formato}`;
      reservadas.add(rutaEnCurso);
      if (artefacto.binario) {
        const contenido = artefacto.contenido && artefacto.contenido.blob ? await artefacto.contenido.blob.arrayBuffer() : bytesDataURL(artefacto.contenido.dataUrl);
        await escribirBinario(adapter, rutaEnCurso, contenido);
      } else await escribirTexto(adapter, rutaEnCurso, artefacto.contenido);
      exitos.push(rutaEnCurso);
      archivos.push({ formato, ruta: rutaEnCurso, contenido: artefacto.contenido });
    }
    return { ok: true, alcance: salida.alcance, paths: exitos, files: archivos, datos: salida };
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(texto(cause));
    error.code = error.code || (String(cause?.message || cause).includes('CARPETA') ? 'CARPETA_EXPORTACION' : 'ARCHIVO_EXPORTACION');
    error.failedPath = error.failedPath || rutaEnCurso;
    error.succeededPaths = [...exitos];
    error.message = mensajeFallo(opciones.crearMensajeFallo || opciones.crearMensaje, error.failedPath, exitos);
    if (typeof opciones.onNotice === 'function') opciones.onNotice(error.message);
    else if (typeof opciones.notice === 'function') opciones.notice(error.message);
    throw error;
  }
}
