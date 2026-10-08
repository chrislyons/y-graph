// Buscar: «Segundo cerebro», «segundo-cerebro» y «cerebro segundo» son la misma búsqueda.
// [1.33] Por palabras, en cualquier orden, sin tildes, guiones ni mayúsculas, y también por alias.
// La comparte el buscador del workbench (las opciones del input) y el resaltado del renderizador:
// una sola regla para que el filtro del mapa y la lista de resultados digan lo mismo.
import { nombreNota } from './ingestion.js';

function sinAcentos(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function textoBusqueda(t) {
  return sinAcentos(t).replace(/[-_./\\|·,;:()[\]]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function palabrasBusqueda(q) {
  return textoBusqueda(q).split(' ').filter(Boolean);
}

export function coincide(palabras, ...campos) {
  const t = textoBusqueda(campos.join(' '));
  return palabras.every((p) => t.includes(p));
}

// El filtro del mapa corre miles de veces por cuadro: el texto de cada nota se normaliza una vez
// y se guarda en el propio nodo mientras el filtro no cambie.
export function pasaFiltro(nodo, filtro) {
  if (!filtro) return true;
  if (nodo._buscaFiltro !== filtro) {
    nodo._buscaFiltro = filtro;
    nodo._busca = textoBusqueda([nodo.titulo, nodo.id, ...(nodo.alias || [])].join(' '));
  }
  return palabrasBusqueda(filtro).every((x) => nodo._busca.includes(x));
}

/** Índice completo del mapa: notas ocultas por el límite por capa, fuentes y miembros de temas colapsados. */
export function buscarNodos(datos, q, tope = 8) {
  const palabras = palabrasBusqueda(q);
  if (!palabras.length) return [];
  const nodos = datos && Array.isArray(datos.nodos) ? datos.nodos : [];
  const qq = palabras.join(' ');
  const puntaje = (n) => { const t = textoBusqueda(n.titulo); return (t.startsWith(qq) ? 0 : t.includes(qq) ? 1 : 2) + (n.fuente ? 0.5 : 0); };
  return nodos
    .filter((n) => coincide(palabras, n.titulo, n.ruta || n.id, ...(n.alias || [])))
    .sort((a, b) => puntaje(a) - puntaje(b) || (b.grado || 0) - (a.grado || 0))
    .slice(0, tope);
}

/**
 * Lo que no está en el mapa también se encuentra: material crudo sin citar, notas fuera de
 * toda capa, adjuntos. Se abren en Obsidian; el mapa no tiene dónde ponerlos.
 * `enMapa` es el conjunto de ids del grafo (incluidos los `raw:` de las fuentes).
 */
export function buscarFuera(app, enMapa, q, tope = 6) {
  const palabras = palabrasBusqueda(q);
  if (!palabras.length || !app?.vault) return [];
  const conf = app.vault.configDir;
  const archivos = app.vault.getFiles ? app.vault.getFiles() : app.vault.getMarkdownFiles();
  const out = [];
  for (const f of archivos) {
    if (enMapa.has(f.path) || enMapa.has('raw:' + f.path) || (conf && f.path.startsWith(conf + '/'))) continue;
    if (coincide(palabras, f.basename, f.path)) out.push({ id: f.path, ruta: f.path, titulo: f.basename || nombreNota(f.path), externo: true });
    if (out.length >= 200) break;
  }
  const qq = palabras.join(' ');
  // Primero las notas, después los adjuntos (una captura no tapa el texto que la explica).
  const orden = (n) => (n.ruta.endsWith('.md') ? 0 : 2) + (textoBusqueda(n.titulo).startsWith(qq) ? 0 : 1);
  return out.sort((a, b) => orden(a) - orden(b) || b.ruta.localeCompare(a.ruta)).slice(0, tope);
}