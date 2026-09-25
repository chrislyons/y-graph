const ORDENADOS_TIPOS = new Set([
  'referencia-rota',
  'huerfana',
  'tema-inferido',
  'sin-motivo',
  'fuera-capa',
  'carpeta-vacia',
]);
const ORDENADOS_SEVERIDADES = new Set(['grave', 'advertencia', 'info']);

function idDe(value) {
  if (typeof value === 'string') return value.length ? value : null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function textoDe(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function compararIds(a, b) {
  const x = String(a), y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function nodosDe(datos) {
  if (!datos || datos.nodos == null) return [];
  if (Array.isArray(datos.nodos)) return datos.nodos;
  if (typeof datos.nodos === 'object') return Object.values(datos.nodos);
  return [];
}

function indiceNodos(datos) {
  const porId = new Map();
  for (const nodo of nodosDe(datos)) {
    if (!nodo || typeof nodo !== 'object') continue;
    const id = idDe(nodo.id);
    if (id != null && !porId.has(id)) porId.set(id, nodo);
  }
  return porId;
}

function motivoDe(value) {
  const motivo = textoDe(value);
  return motivo || null;
}

function fraseDe(value) {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object') return null;
  return textoDe(value.texto) ? value : null;
}

// El grafo es no dirigido. Si una entrada mal formada repite el mismo par al revés, conserva el
// primer motivo o la primera frase disponible y cuenta el par una sola vez, como el modelo.
function aristasCanonicas(datos, porId) {
  const porClave = new Map();
  const brutas = datos && Array.isArray(datos.aristas) ? datos.aristas : [];
  for (const arista of brutas) {
    if (!Array.isArray(arista)) continue;
    const a = idDe(arista[0]), b = idDe(arista[1]);
    if (a == null || b == null || a === b || !porId.has(a) || !porId.has(b)) continue;
    const x = compararIds(a, b) <= 0 ? a : b;
    const y = compararIds(a, b) <= 0 ? b : a;
    const clave = JSON.stringify([x, y]);
    const motivo = motivoDe(arista[2]), frase = fraseDe(arista[3]);
    const actual = porClave.get(clave);
    if (!actual) {
      porClave.set(clave, { a: x, b: y, motivo, frase });
    } else {
      if (!actual.motivo && motivo) actual.motivo = motivo;
      if (!actual.frase && frase) actual.frase = frase;
    }
  }
  return [...porClave.values()].sort((a, b) => compararIds(a.a, b.a) || compararIds(a.b, b.b));
}

function adyacencia(porId, aristas) {
  const ady = new Map();
  for (const id of porId.keys()) ady.set(id, []);
  for (const arista of aristas) {
    ady.get(arista.a).push(arista.b);
    ady.get(arista.b).push(arista.a);
  }
  for (const vecinos of ady.values()) vecinos.sort(compararIds);
  return ady;
}

function cumpleFiltro(nodo, filtro) {
  if (filtro == null) return true;
  if (typeof filtro.has === 'function') return filtro.has(nodo.id) || filtro.has(String(nodo.id));
  if (typeof filtro === 'function') return Boolean(filtro(nodo, nodo.id));
  return true;
}

function numeroCapa(nodo) {
  return Number.isInteger(nodo && nodo.capa) && nodo.capa >= 0 ? nodo.capa : -1;
}

function ultimaCapa(datos) {
  return Array.isArray(datos && datos.capas) ? datos.capas.length - 1 : -1;
}

function totalCapas(datos, porId) {
  if (Array.isArray(datos && datos.capas) && datos.capas.length) return datos.capas.length;
  const vistas = new Set();
  for (const nodo of porId.values()) {
    const capa = numeroCapa(nodo);
    if (capa >= 0) vistas.add(capa);
  }
  let maxima = -1;
  for (const capa of vistas) if (capa > maxima) maxima = capa;
  return maxima + 1;
}

export function metricas(datos, filtro) {
  const porId = indiceNodos(datos);
  const visibles = new Map();
  for (const [id, nodo] of porId) if (cumpleFiltro(nodo, filtro)) visibles.set(id, nodo);
  const todasAristas = aristasCanonicas(datos, porId);
  const aristas = todasAristas.filter((a) => visibles.has(a.a) && visibles.has(a.b));
  let notas = 0, fuentes = 0, enlaces = 0, explicadas = 0, conFrase = 0;
  let referenciasRotas = 0, temasInferidos = 0;
  const grado = new Map();
  const porCapa = Array.from({ length: totalCapas(datos, porId) }, () => 0);
  const porTema = new Map();
  for (const [id, nodo] of visibles) {
    if (nodo.fuente) {
      fuentes++;
      if (nodo.rota) referenciasRotas++;
      continue;
    }
    grado.set(id, 0);
    notas++;
    const capa = numeroCapa(nodo);
    if (capa >= 0 && capa < porCapa.length) porCapa[capa]++;
    const tema = textoDe(nodo.tema);
    if (tema) porTema.set(tema, (porTema.get(tema) || 0) + 1);
    if (!nodo.propio && tema) temasInferidos++;
  }
  for (const arista of aristas) {
    if (grado.has(arista.a)) grado.set(arista.a, grado.get(arista.a) + 1);
    if (grado.has(arista.b)) grado.set(arista.b, grado.get(arista.b) + 1);
    if (visibles.get(arista.a).fuente || visibles.get(arista.b).fuente) continue;
    enlaces++;
    if (arista.motivo) explicadas++;
    else if (arista.frase) conFrase++;
  }
  const huerfanas = [...grado.values()].reduce((total, valor) => total + (valor === 0 ? 1 : 0), 0);
  return {
    mapa: { notas, enlaces, fuentes },
    explicadas,
    conFrase,
    sinExplicacion: enlaces - explicadas,
    porcentajeExplicadas: enlaces ? explicadas / enlaces : 0,
    huerfanas,
    referenciasRotas,
    temasInferidos,
    porCapa,
    porTema: Object.fromEntries([...porTema].sort((a, b) => compararIds(a[0], b[0]))),
  };
}

function idsOrdenados(ids) {
  return [...new Set(ids.filter((id) => id != null).map(idDe).filter((id) => id != null))].sort(compararIds);
}

function idsDeConfig(datos, propiedad) {
  const valores = datos && datos.config && Array.isArray(datos.config[propiedad]) ? datos.config[propiedad] : [];
  return idsOrdenados(valores);
}

function hubsTerminales(datos, porId, nodos) {
  const ultima = ultimaCapa(datos), hermanas = new Map(), hubs = new Map();
  for (const nodo of nodos) {
    const id = idDe(nodo && nodo.id), tema = textoDe(nodo && nodo.tema);
    if (id == null || !tema || nodo.capa !== ultima || !nodo.propio) continue;
    hermanas.set(tema, (hermanas.get(tema) || 0) + 1);
    if (nodo.hub) hubs.set(tema, id);
  }
  for (const nodo of nodos) {
    const id = idDe(nodo && nodo.id), tema = textoDe(nodo && nodo.tema);
    if (id == null || !tema || nodo.capa !== ultima || !nodo.propio || hubs.has(tema)) continue;
    hubs.set(tema, id);
  }
  const conflictos = nodos.filter((nodo) => {
    const id = idDe(nodo && nodo.id), tema = textoDe(nodo && nodo.tema);
    return id != null && tema && nodo.capa === ultima && (hermanas.get(tema) || 0) > 1 && hubs.get(tema) !== id && porId.has(id);
  }).map((nodo) => idDe(nodo.id));
  return idsOrdenados(conflictos);
}

function diagnostico(id, tipo, severidad, nodos, mensaje) {
  if (!ORDENADOS_TIPOS.has(tipo) || !ORDENADOS_SEVERIDADES.has(severidad)) throw new Error('Diagnóstico inválido');
  return { id, tipo, severidad, nodos: idsOrdenados(nodos), mensaje };
}

export function diagnosticos(datos) {
  const porId = indiceNodos(datos), nodos = [...porId.values()];
  const aristas = aristasCanonicas(datos, porId), ady = adyacencia(porId, aristas);
  const referencias = idsOrdenados(nodos.filter((n) => n.fuente && n.rota).map((n) => n.id));
  const notasReales = nodos.filter((n) => !n.virtual);
  const huerfanas = idsOrdenados(notasReales.filter((n) => !n.fuente && (ady.get(idDe(n.id)) || []).length === 0).map((n) => n.id));
  const inferidos = idsOrdenados(notasReales.filter((n) => !n.fuente && !n.propio && n.capa !== 0 && textoDe(n.tema)).map((n) => n.id));
  const sinMotivo = new Map();
  for (const arista of aristas) if (!arista.motivo) {
    sinMotivo.set(arista.a, (sinMotivo.get(arista.a) || 0) + 1);
    sinMotivo.set(arista.b, (sinMotivo.get(arista.b) || 0) + 1);
  }
  const conteos = new Map();
  for (const nodo of notasReales) {
    const id = idDe(nodo.id);
    if (nodo.fuente) continue;
    const declarado = nodo.sinMotivo == null || nodo.sinMotivo === '' ? 0 : Number(nodo.sinMotivo);
    const valor = Math.max(Number.isFinite(declarado) && declarado >= 0 ? declarado : 0, sinMotivo.get(id) || 0);
    if (valor > 0) conteos.set(id, valor);
  }
  const sortedSinMotivo = [...conteos.values()].sort((a, b) => b - a);
  const maximo = sortedSinMotivo.length ? sortedSinMotivo[Math.floor(sortedSinMotivo.length * 0.1)] || sortedSinMotivo[0] : 0;
  const umbral = sortedSinMotivo.length ? Math.max(3, maximo) : Infinity;
  const graves = idsOrdenados([...conteos].filter(([, valor]) => valor >= umbral).map(([id]) => id));
  const advertencias = idsOrdenados([...conteos].filter(([, valor]) => valor < umbral).map(([id]) => id));
  const fuera = idsDeConfig(datos, 'sinCapa');
  const carpetas = idsDeConfig(datos, 'carpetasVacias');
  const conflictosHub = hubsTerminales(datos, porId, notasReales);
  const resultado = [];
  if (referencias.length) resultado.push(diagnostico('diagnostico:referencia-rota', 'referencia-rota', 'grave', referencias, `Hay ${referencias.length} referencia(s) rota(s) a archivos de fuente.`));
  if (huerfanas.length) resultado.push(diagnostico('diagnostico:huerfana', 'huerfana', 'grave', huerfanas, `${huerfanas.length} nota(s) no tienen ninguna conexión.`));
  if (inferidos.length) {
    const propiedad = textoDe(datos && datos.config && datos.config.propiedadTema);
    const mensaje = propiedad
      ? `${inferidos.length} nota(s) no declaran «${propiedad}»; su tema fue inferido de sus vecinos.`
      : `${inferidos.length} nota(s) reciben su tema por inferencia de sus vecinos.`;
    resultado.push(diagnostico('diagnostico:tema-inferido', 'tema-inferido', 'grave', inferidos, mensaje));
  }
  const frasesDe = (ids) => {
    const grupo = new Set(ids);
    return aristas.filter((a) => !a.motivo && a.frase && (grupo.has(a.a) || grupo.has(a.b))).length;
  };
  if (graves.length) {
    const frases = frasesDe(graves);
    resultado.push(diagnostico('diagnostico:sin-motivo:grave', 'sin-motivo', 'grave', graves,
      `${graves.length} nota(s) alcanzan el umbral de enlaces sin motivo curado.${frases ? ` Hay ${frases} arista(s) con una frase literal, que no cuenta como motivo.` : ''}`));
  }
  if (advertencias.length) {
    const frases = frasesDe(advertencias);
    resultado.push(diagnostico('diagnostico:sin-motivo:advertencia', 'sin-motivo', 'advertencia', advertencias,
      `${advertencias.length} nota(s) tienen enlaces sin motivo curado por debajo del umbral.${frases ? ` ${frases} arista(s) conservan una frase literal, que no cuenta como motivo.` : ''}`));
  }
  if (fuera.length) resultado.push(diagnostico('diagnostico:fuera-capa:rutas', 'fuera-capa', 'advertencia', fuera, `${fuera.length} nota(s) están fuera de toda capa configurada.`));
  if (conflictosHub.length) resultado.push(diagnostico('diagnostico:fuera-capa:hub-terminal', 'fuera-capa', 'grave', conflictosHub,
    `${conflictosHub.length} nota(s) de la última capa compiten con la hub de su tema; solo la hub conservadora lleva el nombre del tema.`));
  if (carpetas.length) resultado.push(diagnostico('diagnostico:carpeta-vacia', 'carpeta-vacia', 'advertencia', carpetas, `${carpetas.length} carpeta(s) configurada(s) no contienen notas.`));
  return resultado;
}

function bfs(datos, id, profundidad) {
  const porId = indiceNodos(datos), root = idDe(id), ady = adyacencia(porId, aristasCanonicas(datos, porId));
  if (root == null || !porId.has(root)) return { distancias: new Map(), ids: [] };
  const contexto = datos && datos.contexto && typeof datos.contexto === 'object' ? datos.contexto : {};
  const configured = Number(contexto.profundidadRadial);
  const maxDepth = Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : 2;
  const solicitado = Number(profundidad);
  const depth = Math.max(0, Math.min(maxDepth, Number.isFinite(solicitado) ? Math.floor(solicitado) : maxDepth));
  const distancias = new Map([[root, 0]]);
  const cola = [root];
  for (let i = 0; i < cola.length; i++) {
    const actual = cola[i], next = distancias.get(actual) + 1;
    if (next > depth) continue;
    for (const vecino of ady.get(actual) || []) if (!distancias.has(vecino)) {
      distancias.set(vecino, next);
      cola.push(vecino);
    }
  }
  return { distancias, ids: [...distancias.keys()].sort(compararIds) };
}

export function vecindades(datos, id, profundidad) {
  return bfs(datos, id, profundidad);
}

function buscarRuta(datos, desde, hasta, evitarCapaEntrada) {
  const porId = indiceNodos(datos), a = idDe(desde), b = idDe(hasta);
  if (a == null || b == null || !porId.has(a) || !porId.has(b)) return null;
  const ady = adyacencia(porId, aristasCanonicas(datos, porId));
  const previos = new Map([[a, null]]), cola = [a];
  for (let i = 0; i < cola.length; i++) {
    const actual = cola[i];
    if (actual === b) break;
    for (const vecino of ady.get(actual) || []) {
      if (previos.has(vecino)) continue;
      if (evitarCapaEntrada && vecino !== b && porId.get(vecino).capa === 0) continue;
      previos.set(vecino, actual);
      cola.push(vecino);
    }
  }
  if (!previos.has(b)) return null;
  const ruta = [];
  for (let actual = b; actual != null; actual = previos.get(actual)) ruta.push(actual);
  return ruta.reverse();
}

export function rutaMasCorta(datos, desde, hasta, opciones = {}) {
  const evitarCapaEntrada = !opciones || opciones.evitarCapaEntrada !== false;
  if (!evitarCapaEntrada) return buscarRuta(datos, desde, hasta, false);
  return buscarRuta(datos, desde, hasta, true) || buscarRuta(datos, desde, hasta, false);
}

export function vacios(datos) {
  const porId = indiceNodos(datos), nodos = [...porId.values()], aristas = aristasCanonicas(datos, porId);
  const ady = adyacencia(porId, aristas), ultima = ultimaCapa(datos);
  const temaDe = (nodo) => textoDe(nodo && nodo.tema);
  const util = (nodo) => !!nodo && !!nodo.propio && !nodo.fuente && nodo.capa !== ultima && !!temaDe(nodo);
  const suma = new Map(), notas = new Map(), entre = new Map();
  let m = 0;
  for (const arista of aristas) {
    const A = porId.get(arista.a), B = porId.get(arista.b);
    if (!util(A) || !util(B)) continue;
    m++;
    suma.set(temaDe(A), (suma.get(temaDe(A)) || 0) + 1);
    suma.set(temaDe(B), (suma.get(temaDe(B)) || 0) + 1);
    if (temaDe(A) !== temaDe(B)) {
      const clave = JSON.stringify([temaDe(A), temaDe(B)].sort(compararIds));
      entre.set(clave, (entre.get(clave) || 0) + 1);
    }
  }
  for (const nodo of nodos) if (util(nodo)) {
    const tema = temaDe(nodo), lista = notas.get(tema) || [];
    lista.push(nodo);
    notas.set(tema, lista);
  }
  for (const lista of notas.values()) lista.sort((a, b) => compararIds(idDe(a.id), idDe(b.id)));
  const temas = [...notas].filter(([, lista]) => lista.length >= 3).map(([tema]) => tema).sort(compararIds);
  const resultado = [];
  for (let i = 0; i < temas.length; i++) for (let j = i + 1; j < temas.length; j++) {
    const ti = temas[i], tj = temas[j], clave = JSON.stringify([ti, tj]);
    const real = entre.get(clave) || 0, esperado = m ? (suma.get(ti) * suma.get(tj)) / (2 * m) : 0;
    if (esperado < 2 || real >= esperado * 0.5) continue;
    const candidatos = [];
    for (const b of notas.get(tj)) {
      const vecinosB = new Set(ady.get(idDe(b.id)) || []);
      for (const a of notas.get(ti)) {
        const vecinosA = ady.get(idDe(a.id)) || [];
        if (vecinosA.includes(idDe(b.id))) continue;
        let comunes = 0;
        for (const vecino of vecinosA) if (vecinosB.has(vecino) && util(porId.get(vecino))) comunes++;
        if (comunes) candidatos.push({ a: idDe(a.id), b: idDe(b.id), comunes });
      }
    }
    candidatos.sort((x, y) => y.comunes - x.comunes || compararIds(x.a, y.a) || compararIds(x.b, y.b));
    resultado.push({ ti, tj, real, esperado, faltan: esperado - real, candidatos: candidatos.slice(0, 3) });
  }
  return resultado.sort((a, b) => b.faltan - a.faltan || compararIds(a.ti, b.ti) || compararIds(a.tj, b.tj)).slice(0, 6);
}
