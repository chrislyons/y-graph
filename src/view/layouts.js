const DOS_PI = Math.PI * 2;

const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function texto(value) {
  return value == null ? '' : String(value);
}

function nodosDe(grafo) {
  if (Array.isArray(grafo)) return grafo;
  if (grafo && Array.isArray(grafo.nodos)) return grafo.nodos;
  if (grafo && grafo.nodos && typeof grafo.nodos === 'object') {
    return Object.entries(grafo.nodos).map(([id, nodo]) => nodo && typeof nodo === 'object' && nodo.id == null ? { ...nodo, id } : nodo);
  }
  return [];
}

function aristasDe(grafo) {
  if (Array.isArray(grafo)) return grafo.aristas || [];
  return grafo && Array.isArray(grafo.aristas) ? grafo.aristas : [];
}

function idDeNodo(nodo, indice) {
  return texto(nodo && (nodo.id != null ? nodo.id : indice));
}

function idDeArista(arista) {
  if (Array.isArray(arista)) return texto(arista[0]);
  return texto(arista && (arista.a != null ? arista.a : arista.origen));
}

function destinoDeArista(arista) {
  if (Array.isArray(arista)) return texto(arista[1]);
  return texto(arista && (arista.b != null ? arista.b : arista.destino));
}

function motivoDeArista(arista) {
  if (Array.isArray(arista)) return texto(arista[2]);
  return texto(arista && (arista.motivo != null ? arista.motivo : arista.m));
}

function fraseDeArista(arista) {
  if (!Array.isArray(arista) && arista && (arista.frase || arista.literalPhrase)) return arista.frase || arista.literalPhrase;
  return Array.isArray(arista) ? arista[3] || null : null;
}

function numeroCapa(nodo, indiceCapa) {
  const valor = nodo && (nodo.capa != null ? nodo.capa : nodo.layer);
  const n = Number(valor);
  return Number.isFinite(n) ? n : indiceCapa;
}

function ordenTemas(grafo, nodos) {
  const orden = new Map();
  if (grafo && !Array.isArray(grafo) && grafo.temas && !Array.isArray(grafo.temas)) {
    Object.keys(grafo.temas).forEach((tema, i) => orden.set(tema, i));
  }
  const inferred = new Set();
  for (const nodo of nodos) {
    const tema = texto(nodo && (nodo.topic != null ? nodo.topic : nodo.tema));
    if (tema && !orden.has(tema)) inferred.add(tema);
  }
  [...inferred].sort(natural.compare).forEach((tema) => orden.set(tema, orden.size));
  return orden;
}

function tiempoActualizado(nodo) {
  const valor = nodo && (nodo.updated != null ? nodo.updated : nodo.actualizado);
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const tiempo = Date.parse(texto(valor));
  return Number.isFinite(tiempo) ? tiempo : -Infinity;
}

function tituloDe(nodo) {
  return texto(nodo && (nodo.title != null ? nodo.title : nodo.titulo != null ? nodo.titulo : nodo.id));
}

function temaDe(nodo) {
  return texto(nodo && (nodo.topic != null ? nodo.topic : nodo.tema));
}

function compararAlfabetico(a, b) {
  const first = tituloDe(a);
  const second = tituloDe(b);
  const ai = idDeNodo(a, 0);
  const bi = idDeNodo(b, 0);
  return natural.compare(first, second) || natural.compare(ai, bi) || (ai < bi ? -1 : ai > bi ? 1 : 0);
}

function prepararNodos(grafo) {
  const porId = new Map();
  const nodos = nodosDe(grafo).map((nodo, indice) => {
    const id = idDeNodo(nodo, indice);
    return {
      original: nodo,
      fuente: !!(nodo && (nodo.fuente || nodo.source)),
      id,
      titulo: tituloDe(nodo) || id,
      tema: temaDe(nodo),
      capa: numeroCapa(nodo, 0),
      grado: Math.max(0, Number(nodo && nodo.grado != null ? nodo.grado : nodo.degree) || 0),
      actualizado: tiempoActualizado(nodo),
      fuenteVisual: !!(nodo && (nodo.fuente || nodo.source)),
      supernode: !!(nodo && (nodo.supernode || nodo.agrupados)),
      hub: !!(nodo && (nodo.hub || nodo.supernode)),
      salud: nodo && (nodo.salud || nodo.health),
      sinMotivo: Math.max(0, Number(nodo && nodo.sinMotivo) || 0),
      propio: nodo ? nodo.propio !== false : false,
      alias: Array.isArray(nodo && nodo.alias) ? nodo.alias : [],
      rota: !!(nodo && (nodo.rota || nodo.rotten || (nodo.fuente && nodo.fuente.rota))),
      grave: !!(nodo && nodo.grave),
      oculto: !!(nodo && nodo.oculto),
      fecha: nodo && nodo.fecha,
      contenido: (nodo && nodo.contenido) || null,
      radio: 0,
      x: 0,
      y: 0,
      order: 0,
    };
  }).filter((nodo) => nodo.id);
  const topics = ordenTemas(grafo, nodos);
  const adyacencia = new Map();
  for (const nodo of nodos) adyacencia.set(nodo.id, new Set());
  for (const nodo of nodos) porId.set(nodo.id, nodo);
  const aristas = [];
  for (const original of aristasDe(grafo)) {
    const a = idDeArista(original), b = destinoDeArista(original);
    if (!a || !b || a === b) continue;
    const arista = { original, a, b, motivo: motivoDeArista(original), frase: fraseDeArista(original) };
    aristas.push(arista);
    if (porId.has(a) && porId.has(b)) {
      adyacencia.get(a).add(b);
      adyacencia.get(b).add(a);
    }
  }
  for (const nodo of nodos) {
    if (!nodo.grado) nodo.grado = adyacencia.get(nodo.id).size;
    const base = nodo.fuenteVisual ? 7 : nodo.supernode ? 10 + Math.min(8, Math.sqrt(Number(nodo.original && nodo.original.agrupados) || 1) * 1.6) : 4 + Math.min(5, Math.sqrt(nodo.grado) * 0.8);
    nodo.radio = base;
    porId.set(nodo.id, nodo);
  }
  const capas = grafo && !Array.isArray(grafo) && Array.isArray(grafo.capas) ? grafo.capas : [];
  return { nodos, porId, adyacencia, aristas, topics, capas };
}

function adyacenciaOrdenada(adyacencia, porId) {
  const ordenada = new Map();
  for (const [id, vecinos] of adyacencia) {
    ordenada.set(id, [...vecinos].sort((a, b) => compararAlfabetico(porId.get(a), porId.get(b)) || natural.compare(a, b)));
  }
  return ordenada;
}

function ordenInicial(capa, topics) {
  return [...capa].sort((a, b) => (topics.get(a.tema) ?? 999999) - (topics.get(b.tema) ?? 999999)
    || b.grado - a.grado || compararAlfabetico(a, b));
}

function indexarOrden(capa, posiciones) {
  const ultimo = Math.max(capa.length - 1, 1);
  capa.forEach((nodo, i) => { posiciones.set(nodo.id, i / ultimo); });
}

function ordenarAutomaticamente(capas, adyacencia, topics, columnasPorId) {
  const posiciones = new Map();
  for (const capa of capas) indexarOrden(capa, posiciones);
  for (let pasada = 0; pasada < 6; pasada++) {
    for (let indiceCapa = 0; indiceCapa < capas.length; indiceCapa++) {
      const capa = capas[indiceCapa];
      for (const nodo of capa) {
        let suma = 0;
        let peso = 0;
        for (const vecino of adyacencia.get(nodo.id) || []) {
          const distancia = Math.abs(columnasPorId.get(vecino) - indiceCapa);
          if (!distancia) continue;
          suma += posiciones.get(vecino) / distancia;
          peso += 1 / distancia;
        }
        nodo._baricentro = peso ? suma / peso : posiciones.get(nodo.id);
      }
      capa.sort((a, b) => (topics.get(a.tema) ?? 999999) - (topics.get(b.tema) ?? 999999)
        || a._baricentro - b._baricentro || compararAlfabetico(a, b));
      indexarOrden(capa, posiciones);
    }
  }
  for (const capa of capas) for (const nodo of capa) delete nodo._baricentro;
}

function anchoYAlto(viewport) {
  return {
    width: Math.max(1, Number(viewport && viewport.width) || 1),
    height: Math.max(1, Number(viewport && viewport.height) || 1),
  };
}

function columnasDeCapas(preparado, orden) {
  const indices = new Set(preparado.nodos.map((nodo) => nodo.capa));
  if (preparado.capas.length) preparado.capas.forEach((_, indice) => indices.add(indice));
  if (preparado.nodos.some((nodo) => nodo.capa === 0)) indices.add(0);
  const ordenadas = [...indices].sort((a, b) => a - b);
  const columnas = new Map();
  for (const indice of ordenadas) {
    const capa = preparado.nodos.filter((nodo) => nodo.capa === indice);
    if (orden === 'alfabetico') capa.sort(compararAlfabetico);
    else if (orden === 'reciente') capa.sort((a, b) => b.actualizado - a.actualizado || compararAlfabetico(a, b));
    else ordenInicial(capa, preparado.topics);
    columnas.set(indice, capa);
  }
  return columnas;
}

function nombreCapa(capa, indice) {
  if (Array.isArray(capa)) return { id: texto(capa[0] || indice), nombre: texto(capa[1] || capa[0] || indice + 1), descripcion: texto(capa[2]) };
  if (capa && typeof capa === 'object') return { id: texto(capa.id != null ? capa.id : indice), nombre: texto(capa.nombre || capa.name || capa.id || indice + 1), descripcion: texto(capa.descripcion || capa.description) };
  return { id: String(indice), nombre: String(indice + 1), descripcion: '' };
}

function limitesNodo(nodo) {
  return { minX: nodo.x - nodo.radio, minY: nodo.y - nodo.radio, maxX: nodo.x + nodo.radio, maxY: nodo.y + nodo.radio };
}

function unirLimites(destino, limites) {
  destino.minX = Math.min(destino.minX, limites.minX);
  destino.minY = Math.min(destino.minY, limites.minY);
  destino.maxX = Math.max(destino.maxX, limites.maxX);
  destino.maxY = Math.max(destino.maxY, limites.maxY);
}

export function puntosCurva(a, b, tipo, centro) {
  if (tipo === 'radial' && centro) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    return { c1x: mx + (centro.x - mx) * 0.25, c1y: my + (centro.y - my) * 0.25, c2x: mx + (centro.x - mx) * 0.25, c2y: my + (centro.y - my) * 0.25 };
  }
  if (tipo === 'same') {
    const izquierda = a.x <= b.x ? a : b;
    const derecha = izquierda === a ? b : a;
    const dx = 26 + Math.abs(derecha.y - izquierda.y) * 0.12;
    return { c1x: izquierda.x + dx, c1y: izquierda.y, c2x: derecha.x + dx, c2y: derecha.y };
  }
  const mx = (a.x + b.x) / 2;
  return { c1x: mx, c1y: a.y, c2x: mx, c2y: b.y };
}

function limitesBezier(a, b, puntos) {
  const limites = { minX: Math.min(a.x, b.x) - 1, minY: Math.min(a.y, b.y) - 1, maxX: Math.max(a.x, b.x) + 1, maxY: Math.max(a.y, b.y) + 1 };
  unirLimites(limites, { minX: Math.min(puntos.c1x, puntos.c2x) - 1, minY: Math.min(puntos.c1y, puntos.c2y) - 1, maxX: Math.max(puntos.c1x, puntos.c2x) + 1, maxY: Math.max(puntos.c1y, puntos.c2y) + 1 });
  unirLimites(limites, { minX: a.x - a.radio, minY: a.y - a.radio, maxX: a.x + a.radio, maxY: a.y + a.radio });
  unirLimites(limites, { minX: b.x - b.radio, minY: b.y - b.radio, maxX: b.x + b.radio, maxY: b.y + b.radio });
  return limites;
}

function idArista(a, b) {
  return JSON.stringify([a, b].sort());
}

function crearAristas(preparado, tipo, centro) {
  const escena = [];
  for (const arista of preparado.aristas) {
    const a = preparado.porId.get(arista.a);
    const b = preparado.porId.get(arista.b);
    if (!a || !b) continue;
    const clase = tipo === 'radial' ? 'radial' : a.capa === b.capa ? 'same' : 'cross';
    const puntos = puntosCurva(a, b, clase, centro);
    const bounds = limitesBezier(a, b, puntos);
    escena.push({
      id: idArista(arista.a, arista.b), a: arista.a, b: arista.b,
      motivo: arista.motivo, frase: arista.frase, original: arista.original,
      kind: clase, tipo: clase, curved: true, c1x: puntos.c1x, c1y: puntos.c1y,
      c2x: puntos.c2x, c2y: puntos.c2y, bounds, path: null, straightPath: null,
    });
  }
  return escena;
}

function limitesEscena(nodes, edges) {
  const limites = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  if (nodes.length) for (const nodo of nodes) unirLimites(limites, limitesNodo(nodo));
  else { limites.minX = 0; limites.minY = 0; limites.maxX = 0; limites.maxY = 0; }
  for (const arista of edges) unirLimites(limites, arista.bounds);
  return limites;
}

function etiquetaNodo(nodo) {
  return {
    id: nodo.id, nodeId: nodo.id, title: nodo.titulo, label: nodo.titulo,
    layer: nodo.capa, topic: nodo.tema, x: nodo.x, y: nodo.y, degree: nodo.grado,
    hub: nodo.hub, supernode: nodo.supernode, source: nodo.fuenteVisual,
    priority: nodo.hub ? 4 : nodo.grado >= 4 ? 5 : 6, recent: nodo.actualizado,
  };
}

function capasEscena(grafo, columnas, positions) {
  return [...columnas.entries()].map(([indice, nodos], ordenCapa) => {
    const definicion = nombreCapa(Array.isArray(grafo) ? null : grafo && grafo.capas && grafo.capas[indice], indice);
    const primero = positions.get(nodos[0]);
    const ultimo = positions.get(nodos[nodos.length - 1]);
    return {
      id: definicion.id, indice, index: ordenCapa, layer: indice, nombre: definicion.nombre,
      name: definicion.nombre, descripcion: definicion.descripcion, count: nodos.length,
      x: primero ? primero.x : 0, y0: primero ? primero.y - primero.radio - 24 : 0,
      y1: ultimo ? ultimo.y + ultimo.radio + 24 : 0,
    };
  });
}

/** Calcula columnas deterministas en coordenadas de mundo. La reserva se conserva como metadato, no altera el orden. */
export function layoutCapas(grafo, viewport, opciones = {}) {
  const preparado = prepararNodos(grafo);
  const { width, height } = anchoYAlto(viewport);
  const orden = ['auto', 'alfabetico', 'reciente'].includes(opciones.orden) ? opciones.orden : 'auto';
  const columnas = columnasDeCapas(preparado, orden);
  if (orden === 'auto') {
    const columnasPorId = new Map();
    for (const [indice, columna] of columnas) for (const nodo of columna) columnasPorId.set(nodo.id, indice);
    ordenarAutomaticamente([...columnas.values()], preparado.adyacencia, preparado.topics, columnasPorId);
  }
  const indices = [...columnas.keys()].sort((a, b) => a - b);
  const n = Math.max(indices.length, 2);
  const margen = Math.max(120, width * 0.1);
  const paso = (width - margen * 2) / (n - 1);
  const arriba = Math.max(100, height * 0.16);
  const abajo = Math.max(70, height * 0.12);
  const alto = Math.max(1, height - arriba - abajo);
  const nodes = [];
  const positions = new Map();
  indices.forEach((indice, numeroColumna) => {
    const capa = columnas.get(indice);
    const gap = Math.min(alto / Math.max(capa.length, 1), 28);
    const y0 = arriba + (alto - gap * Math.max(capa.length - 1, 0)) / 2;
    capa.forEach((nodo, order) => {
      nodo.x = margen + numeroColumna * paso;
      nodo.y = y0 + order * gap;
      nodo.order = order;
      nodo.layer = indice;
      nodo.topic = nodo.tema;
      positions.set(nodo.id, nodo);
      nodes.push(nodo);
    });
  });
  const edges = crearAristas(preparado, 'capas');
  const layers = capasEscena(grafo, columnas, positions);
  for (const layer of layers) {
    if (layer.count) continue;
    layer.x = margen + layer.index * paso;
    layer.y0 = arriba;
    layer.y1 = arriba + alto;
  }
  const orderedIds = [...indices].flatMap((indice) => columnas.get(indice).map((nodo) => nodo.id));
  const bounds = limitesEscena(nodes, edges);
  const labels = nodes.map(etiquetaNodo);
  return {
    mode: 'capas', tipo: 'capas', nodes, nodos: nodes, edges, aristas: edges, layers, capas: layers,
    anillos: [], rings: [], reservaPanel: Math.max(0, Number(opciones.reservaPanel) || 0),
    bounds, visibleBounds: { ...bounds }, orderedIds, idsOrdenados: orderedIds,
    labelCandidates: labels, etiquetas: labels,
  };
}


function bfs(preparado, foco, profundidad) {
  const distancia = new Map([[foco, 0]]);
  const padre = new Map();
  const orden = adyacenciaOrdenada(preparado.adyacencia, preparado.porId);
  const cola = [foco];
  for (let cabeza = 0; cabeza < cola.length; cabeza++) {
    const id = cola[cabeza];
    const nivel = distancia.get(id);
    if (nivel >= profundidad) continue;
    for (const vecino of orden.get(id) || []) {
      if (distancia.has(vecino)) continue;
      distancia.set(vecino, nivel + 1);
      padre.set(vecino, id);
      cola.push(vecino);
    }
  }
  return { distancia, padre, cola };
}

function budgetRadial(width, height, opciones) {
  if (Number.isFinite(Number(opciones.presupuestoAnillos))) return Math.max(1, Number(opciones.presupuestoAnillos));
  const mobile = !!opciones.mobile || width < 640;
  return mobile ? Math.max(12, Math.min(40, Math.floor(width * height / 13000))) : Math.max(24, Math.min(96, Math.floor(width * height / 9000)));
}

function nodoImportante(nodo, estado) {
  const seleccion = estado && texto(estado.seleccion);
  const ruta = estado && Array.isArray(estado.ruta) ? estado.ruta : [];
  return nodo.id === seleccion || nodo.id === texto(estado && estado.foco) || ruta.includes(nodo.id);
}

function elegirFoco(preparado, foco) {
  const id = texto(foco);
  if (preparado.porId.has(id)) return id;
  const candidatos = [...preparado.nodos].sort((a, b) => b.grado - a.grado || compararAlfabetico(a, b));
  return candidatos.length ? candidatos[0].id : '';
}

/** Coloca un foco y sus anillos BFS exactos; los anillos se ordenan por tema, ángulo del padre e ID. */
export function layoutRadial(grafo, foco, viewport, opciones = {}) {
  const preparado = prepararNodos(grafo);
  const { width, height } = anchoYAlto(viewport);
  const profundidad = Math.max(1, Math.min(4, Number(opciones.profundidad) || 2));
  const focus = elegirFoco(preparado, foco);
  const bfsResult = focus ? bfs(preparado, focus, profundidad) : { distancia: new Map(), padre: new Map(), cola: [] };
  // [1.33] Los anillos caben entre el borde de arriba y la franja de leyenda/zoom de abajo: antes
  // el centro quedaba a media altura y el anillo exterior se cortaba contra el pie de la escena.
  const movil = !!opciones.mobile || width < 640;
  const arriba = 24, abajo = height - (movil ? 70 : 44);
  const cx = width / 2;
  const cy = (arriba + abajo) / 2;
  const maxR = Math.max(60, Math.min((abajo - arriba) / 2, width / 2 - 20));
  const angle = new Map();
  const nodes = [];
  const rings = [];
  const anillos = [];
  const omitted = new Set();
  const budget = budgetRadial(width, height, opciones);
  if (focus) {
    const centro = preparado.porId.get(focus);
    centro.x = cx;
    centro.y = cy;
    centro.order = 0;
    centro.layer = 0;
    centro.dist = 0;
    centro.topic = centro.tema;
    angle.set(focus, 0);
    nodes.push(centro);
    rings.push({ depth: 0, d: 0, radio: 0, count: 1, ids: [focus], visibleIds: [focus], visibleCount: 1, omitted: 0 });
    anillos.push(rings[0]);
    // Fase 1: armar cada anillo (con su tope de presupuesto) antes de calcular radios.
    const armados = [];
    for (let depth = 1; depth <= profundidad; depth++) {
      const ring = preparado.nodos.filter((nodo) => bfsResult.distancia.get(nodo.id) === depth);
      ring.sort((a, b) => (preparado.topics.get(a.tema) ?? 999999) - (preparado.topics.get(b.tema) ?? 999999)
        || (angle.get(bfsResult.padre.get(a.id)) ?? 0) - (angle.get(bfsResult.padre.get(b.id)) ?? 0)
        || compararAlfabetico(a, b));
      const total = ring.length;
      if (!total) break;
      let visibleRing = ring;
      if (total > budget) {
        const keep = new Set(ring.filter((nodo) => nodoImportante(nodo, opciones.estado)).map((nodo) => nodo.id));
        const remaining = ring.filter((nodo) => !keep.has(nodo.id)).sort((a, b) => b.grado - a.grado || compararAlfabetico(a, b));
        for (const nodo of remaining) {
          if (keep.size >= budget) break;
          keep.add(nodo.id);
        }
        ring.forEach((nodo) => { if (!keep.has(nodo.id)) omitted.add(nodo.id); });
        visibleRing = ring.filter((nodo) => keep.has(nodo.id));
      }
      armados.push({ depth, ring, visibleRing, total });
    }
    // Fase 2: radios proporcionales al ancho/alto, escalados para que el exterior no se salga.
    const paso = Math.min(width, height) * (movil ? 0.15 : 0.16);
    const crudos = armados.map(({ depth, total }) => paso * depth * (1 + Math.min(0.6, total / 90)));
    const escalaR = Math.min(1, maxR / Math.max(...crudos, 1));
    // Fase 3: posicionar. Cada nodo guarda su distancia al foco (la usan los pulsos y el panel).
    armados.forEach(({ depth, ring, visibleRing, total }, i) => {
      const radio = crudos[i] * escalaR;
      ring.forEach((nodo, order) => {
        const a = (order / total) * DOS_PI - Math.PI / 2;
        angle.set(nodo.id, a);
        nodo.x = cx + Math.cos(a) * radio;
        nodo.y = cy + Math.sin(a) * radio;
        nodo.order = order;
        nodo.layer = depth;
        nodo.dist = depth;
        nodo.topic = nodo.tema;
        nodes.push(nodo);
      });
      const omittedCount = total - visibleRing.length;
      const metadata = {
        depth, d: depth, radio, count: total, n: total, ids: ring.map((nodo) => nodo.id),
        visibleIds: visibleRing.map((nodo) => nodo.id), visibleCount: visibleRing.length,
        omitted: omittedCount, baseOmitted: omittedCount,
      };
      rings.push(metadata);
      anillos.push(metadata);
    });
  }
  const edges = crearAristas(preparado, 'radial', focus ? preparado.porId.get(focus) : null);
  const orderedIds = [focus, ...rings.slice(1).flatMap((ring) => ring.ids)].filter(Boolean);
  const bounds = limitesEscena(nodes, edges);
  const labels = nodes.map(etiquetaNodo);
  return {
    mode: 'radial', tipo: 'radial', focus, foco: focus, depth: profundidad, nodes, nodos: nodes, edges, aristas: edges,
    layers: [], capas: [], rings, anillos, omitted, omittedIds: [...omitted].sort(natural.compare),
    reservaPanel: Math.max(0, Number(opciones.reservaPanel) || 0), bounds, visibleBounds: { ...bounds },
    orderedIds, idsOrdenados: orderedIds, labelCandidates: labels, etiquetas: labels,
  };
}
