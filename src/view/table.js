import { T } from '../i18n.js';
import { aplicarFiltros, normalizarEstado } from './state.js';

function texto(value) { return value == null ? '' : String(value); }
function nodosDe(datos) {
  if (!datos) return [];
  if (Array.isArray(datos.nodos)) return datos.nodos.filter(Boolean);
  return datos.nodos && typeof datos.nodos === 'object' ? Object.values(datos.nodos).filter(Boolean) : [];
}
function aristasDe(datos) { return datos && Array.isArray(datos.aristas) ? datos.aristas.filter(Boolean) : []; }
function idArista(a, b) { return JSON.stringify([texto(a), texto(b)].sort()); }
function parteArista(arista, posicion) {
  if (Array.isArray(arista)) return arista[posicion];
  if (!arista) return undefined;
  return [arista.a, arista.b, arista.motivo, arista.frase, arista.linea][posicion];
}
function idAristaCompleto(arista) { return texto(arista && arista.id) || idArista(parteArista(arista, 0), parteArista(arista, 1)); }
function valorFrase(frase) {
  if (frase == null) return '';
  if (typeof frase === 'string') return frase;
  return texto(frase.texto || frase.frase || frase.valor);
}
function valorLinea(linea) {
  if (linea == null) return '';
  if (typeof linea === 'object') return linea.linea == null ? '' : texto(linea.linea);
  return texto(linea);
}
function crear(documento, etiqueta) {
  if (documento && typeof documento.createElement === 'function') return documento.createElement(etiqueta);
  return {
    tagName: etiqueta.toUpperCase(), children: [], attributes: {}, style: {}, _text: '',
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {}, removeEventListener() {}, focus() { this.focused = true; },
    setAttribute(name, value) { this.attributes[name] = texto(value); },
    getAttribute(name) { return this.attributes[name] == null ? null : this.attributes[name]; },
    set textContent(value) { this._text = texto(value); }, get textContent() { return this._text; },
  };
}
function limpiar(contenedor) {
  if (!contenedor) return;
  if (typeof contenedor.empty === 'function') { contenedor.empty(); return; }
  if (typeof contenedor.replaceChildren === 'function') { contenedor.replaceChildren(); return; }
  if (contenedor.innerHTML != null) { contenedor.innerHTML = ''; return; }
  if (Array.isArray(contenedor.children)) contenedor.children.length = 0;
  while (contenedor.firstChild && typeof contenedor.removeChild === 'function') contenedor.removeChild(contenedor.firstChild);
}
function agregar(padre, hijo) {
  if (!padre) return hijo;
  if (typeof padre.appendChild === 'function') padre.appendChild(hijo);
  else if (Array.isArray(padre.children)) padre.children.push(hijo);
  return hijo;
}
function celda(documento, etiqueta, valor, ambito) {
  const el = crear(documento, etiqueta);
  el.textContent = texto(valor);
  if (ambito) el.setAttribute('scope', ambito);
  return el;
}
function textoNodo(nodo) {
  if (nodo.fuente === true) return T('Fuente');
  if (nodo.hub || nodo.supernode) return T('Supernodo');
  if (nodo.salud === true || nodo.rota === true || Number(nodo.sinMotivo) > 0) return T('Con problemas');
  return T('Nota');
}
function nombreCapa(datos, indice) {
  const capas = datos && datos.capas;
  const capa = Array.isArray(capas) ? capas[indice] : null;
  if (Array.isArray(capa)) return texto(capa[1] || capa[0] || indice + 1);
  if (capa && typeof capa === 'object') return texto(capa.nombre || capa.name || capa.id || indice + 1);
  return capa == null ? String(indice + 1) : texto(capa);
}
function nombreTema(datos, tema) {
  const valor = tema && datos && datos.temas && datos.temas[tema];
  if (Array.isArray(valor)) return texto(valor[0] || tema);
  if (valor && typeof valor === 'object') return texto(valor.nombre || valor.name || tema);
  return texto(valor || tema);
}
function gradoDe(nodo, adyacencia, id) {
  if (nodo && Number.isFinite(Number(nodo.grado))) return Number(nodo.grado);
  return adyacencia.get(id)?.size || 0;
}
function motivosDe(nodo, id, datos) {
  if (nodo && Number.isFinite(Number(nodo.motivos))) return Number(nodo.motivos);
  let count = 0;
  for (const arista of aristasDe(datos)) {
    const a = texto(parteArista(arista, 0)), b = texto(parteArista(arista, 1));
    if ((a === id || b === id) && texto(parteArista(arista, 2))) count++;
  }
  return count;
}
function filaSeleccionable(fila, id, tipo, seleccionado, onSelect) {
  fila.setAttribute('data-id', id);
  fila.setAttribute('data-kind', tipo);
  fila.setAttribute('aria-selected', seleccionado ? 'true' : 'false');
  if (typeof onSelect !== 'function') return;
  const activar = () => onSelect(id, tipo);
  fila.addEventListener('click', activar);
  fila.addEventListener('keydown', (event) => {
    if (event && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); activar(); }
  });
  if ('tabIndex' in fila) fila.tabIndex = 0;
}

/** Render a deterministic, filter-aware semantic HTML companion for a graph. */
export function renderTablaGrafo(container, datos, estado = {}, opciones = {}) {
  if (!container) return null;
  limpiar(container);
  const documento = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const grafo = datos && typeof datos === 'object' ? datos : { nodos: [], aristas: [] };
  const normal = normalizarEstado(estado, { datos: grafo });
  const filtrado = aplicarFiltros(grafo, normal);
  const porId = new Map(nodosDe(grafo).map((nodo) => [texto(nodo.id), nodo]).filter(([id]) => id));
  const adyacencia = new Map([...porId.keys()].map((id) => [id, new Set()]));
  for (const arista of aristasDe(grafo)) {
    const a = texto(parteArista(arista, 0)), b = texto(parteArista(arista, 1));
    if (a !== b && adyacencia.has(a) && adyacencia.has(b)) { adyacencia.get(a).add(b); adyacencia.get(b).add(a); }
  }
  const visible = filtrado.visibles instanceof Set ? filtrado.visibles : new Set(filtrado.visibles || []);
  const nodos = [...porId.entries()].filter(([id]) => visible.has(id)).sort(([a], [b]) => {
    const na = porId.get(a), nb = porId.get(b);
    return (Number(na.capa) || 0) - (Number(nb.capa) || 0) || nombreTema(grafo, na.tema).localeCompare(nombreTema(grafo, nb.tema), undefined, { numeric: true, sensitivity: 'base' }) || gradoDe(nb, adyacencia, b) - gradoDe(na, adyacencia, a) || a.localeCompare(b);
  });
  const aristas = aristasDe(grafo).filter((arista) => visible.has(texto(parteArista(arista, 0))) && visible.has(texto(parteArista(arista, 1)))).sort((a, b) => idAristaCompleto(a).localeCompare(idAristaCompleto(b)));
  const root = agregar(container, crear(documento, 'section'));
  root.setAttribute('aria-label', T('Tabla de datos del grafo'));
  const tablaNodos = crear(documento, 'table'); tablaNodos.id = 'why-graph-table-nodes';
  const captionNodos = crear(documento, 'caption'); captionNodos.textContent = T('Nodos visibles ({0})', nodos.length); agregar(tablaNodos, captionNodos);
  const headNodos = agregar(tablaNodos, crear(documento, 'thead')); const headRowNodos = agregar(headNodos, crear(documento, 'tr'));
  for (const [key, label] of [['id', T('Nodo')], ['capa', T('Capa')], ['tema', T('Tema')], ['grado', T('Grado')], ['estado', T('Estado')], ['motivos', T('Motivos')]]) { const th = celda(documento, 'th', label, 'col'); th.setAttribute('data-column', key); agregar(headRowNodos, th); }
  const bodyNodos = agregar(tablaNodos, crear(documento, 'tbody'));
  if (!nodos.length) { const tr = agregar(bodyNodos, crear(documento, 'tr')); const td = celda(documento, 'td', T('No hay nodos visibles')); td.setAttribute('colspan', '6'); agregar(tr, td); }
  for (const [id, nodo] of nodos) {
    const tr = agregar(bodyNodos, crear(documento, 'tr'));
    agregar(tr, celda(documento, 'th', id, 'row')); agregar(tr, celda(documento, 'td', nombreCapa(grafo, nodo.capa))); agregar(tr, celda(documento, 'td', nombreTema(grafo, nodo.tema) || T('sin tema'))); agregar(tr, celda(documento, 'td', gradoDe(nodo, adyacencia, id))); agregar(tr, celda(documento, 'td', textoNodo(nodo))); agregar(tr, celda(documento, 'td', motivosDe(nodo, id, grafo)));
    filaSeleccionable(tr, id, 'nodo', estado.seleccion === id, opciones.onSelect);
  }
  agregar(root, tablaNodos);
  const tablaAristas = crear(documento, 'table'); tablaAristas.id = 'why-graph-table-edges';
  const captionAristas = crear(documento, 'caption'); captionAristas.textContent = T('Enlaces visibles ({0})', aristas.length); agregar(tablaAristas, captionAristas);
  const headAristas = agregar(tablaAristas, crear(documento, 'thead')); const headRowAristas = agregar(headAristas, crear(documento, 'tr'));
  for (const [key, label] of [['id', T('Enlace')], ['extremos', T('Extremos')], ['capas', T('Par de capas')], ['motivo', T('Motivo')], ['frase', T('Frase literal')], ['linea', T('Línea de origen')]]) { const th = celda(documento, 'th', label, 'col'); th.setAttribute('data-column', key); agregar(headRowAristas, th); }
  const bodyAristas = agregar(tablaAristas, crear(documento, 'tbody'));
  if (!aristas.length) { const tr = agregar(bodyAristas, crear(documento, 'tr')); const td = celda(documento, 'td', T('No hay enlaces visibles')); td.setAttribute('colspan', '6'); agregar(tr, td); }
  for (const arista of aristas) {
    const a = texto(parteArista(arista, 0)), b = texto(parteArista(arista, 1)), id = idAristaCompleto(arista);
    const tr = agregar(bodyAristas, crear(documento, 'tr'));
    agregar(tr, celda(documento, 'th', id, 'row')); agregar(tr, celda(documento, 'td', `${a} — ${b}`)); agregar(tr, celda(documento, 'td', `${nombreCapa(grafo, porId.get(a)?.capa)} — ${nombreCapa(grafo, porId.get(b)?.capa)}`)); agregar(tr, celda(documento, 'td', parteArista(arista, 2) || '')); agregar(tr, celda(documento, 'td', valorFrase(parteArista(arista, 3)))); agregar(tr, celda(documento, 'td', valorLinea(parteArista(arista, 4) || parteArista(arista, 3))));
    filaSeleccionable(tr, id, 'arista', estado.seleccion === id, opciones.onSelect);
  }
  agregar(root, tablaAristas);
  return { root, nodos, aristas, tablaNodos, tablaAristas, visibles: visible };
}
