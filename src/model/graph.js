import { T } from '../i18n.js';

// Fuentes: rutas explícitas a archivos de las carpetas configuradas. Se aceptan tildes y espacios
// cuando la ruta va entre acentos graves, en un [[wikilink]] o en un enlace (…); suelta en el texto,
// solo hasta el primer espacio. Texto que se parece a una ruta pero no resuelve a un archivo o
// carpeta del vault es una referencia rota, no una cita.
export function carpetasFuentesDe(s) {
  return String(s.carpetasFuentes || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const grupo = l.endsWith('/*'); const ruta = (grupo ? l.slice(0, -2) : l).replace(/^\/+|\/+$/g, '');
    return ruta ? { ruta, grupo } : null;
  }).filter(Boolean);
}
export function citasDe(texto, carpetas) {
  if (!carpetas.length) return [];
  const esc = carpetas.map((c) => c.ruta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const out = [], vistas = new Set();
  // Un comodín, un marcador («<fecha>») o llaves no son una ruta: son texto que habla de rutas.
  const agregar = (ruta, linea) => { ruta = ruta.replace(/[.,;:!?)]+$/, '').replace(/\/+$/, ''); if (/[*<>{}]/.test(ruta)) return; if (!vistas.has(ruta)) { vistas.add(ruta); out.push({ ruta, linea }); } };
  const lineas = texto.split('\n');
  const envuelta = new RegExp('(?:`([^`]+)`|\\[\\[([^\\]|#]+)(?:[|#][^\\]]*)?\\]\\]|\\]\\(([^)\\s]+)\\))', 'g');
  const suelta = new RegExp('(?:^|[^\\w/])((?:' + esc + ')/[^\\s`"\'<>|\\[\\]()]+)', 'g');
  const dentro = new RegExp('^(?:' + esc + ')/');
  lineas.forEach((l, i) => {
    for (const m of l.matchAll(envuelta)) { const r = (m[1] || m[2] || m[3] || '').trim(); if (dentro.test(r)) agregar(r, i + 1); }
    // Lo envuelto ya se leyó entero: se borra antes de buscar rutas sueltas, o «`a b.md`» daría también «a».
    for (const m of l.replace(envuelta, ' ').matchAll(suelta)) agregar(m[1], i + 1);
  });
  return out;
}
// Con «carpeta/*», una cita a cualquier cosa dentro de una subcarpeta se agrupa en esa subcarpeta.
export function nodoFuenteDe(ruta, carpetas) {
  for (const c of carpetas) {
    if (ruta !== c.ruta && !ruta.startsWith(c.ruta + '/')) continue;
    if (!c.grupo) return { ruta, titulo: ruta.slice(c.ruta.length + 1) || ruta, carpeta: c };
    const sub = ruta.slice(c.ruta.length + 1).split('/')[0];
    return sub ? { ruta: c.ruta + '/' + sub, titulo: sub, carpeta: c, grupo: true } : null;
  }
  return null;
}
// Inventario: qué archivos (o subcarpetas, con «/*») hay en cada carpeta de fuentes.
export function inventarioFuentes(app, carpetas) {
  const todos = (app.vault.getFiles ? app.vault.getFiles() : app.vault.getMarkdownFiles()).map((f) => f.path);
  const items = [];
  for (const c of carpetas) {
    const dentro = todos.filter((r) => r.startsWith(c.ruta + '/'));
    if (c.grupo) { const subs = new Set(dentro.map((r) => r.slice(c.ruta.length + 1).split('/')[0]).filter((s) => dentro.some((r) => r.startsWith(c.ruta + '/' + s + '/')))); for (const s of subs) items.push({ ruta: c.ruta + '/' + s, titulo: s, carpeta: c, grupo: true }); }
    else for (const r of dentro) items.push({ ruta: r, titulo: r.slice(c.ruta.length + 1), carpeta: c });
  }
  return items;
}
const MOTIVO = /^- \[\[([^\]|#]+)\]\]\s+—\s+(.+)$/gm;
// Fecha LOCAL, no UTC: en Chile, después de las 21:00 toISOString() ya es el día siguiente (lección del 01.09).

// Enlaces externos declarados en el frontmatter. Acepta «Título | https://…», «https://…» y
// «usuario/repo» (se asume GitHub). Solo http y https: una URL «javascript:» escrita en una nota
// no debe poder ejecutarse por tocarla en el panel.
export function enlacesDe(fm, s) {
  const props = String(s.propiedadEnlaces || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const prop of props) {
    for (const bruto of [].concat(fm[prop] || [])) {
      const partes = String(bruto).split('|').map((x) => x.trim()).filter(Boolean);
      if (!partes.length) continue;
      let url = partes.length > 1 ? partes[1] : partes[0];
      const titulo = partes.length > 1 ? partes[0] : '';
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && /^[\w.-]+\/[\w.-]+$/.test(url)) url = 'https://github.com/' + url;
      if (!/^https?:\/\//i.test(url)) continue;
      out.push({ titulo: titulo || url.replace(/^https?:\/\//i, '').slice(0, 60), url });
    }
  }
  return out.slice(0, 20);
}

export function leerAjustes(s) {
  const capas = s.capas.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map((x, i) => [`L${i}`, x[0], x[1] || '']);
  const carpetas = s.carpetas.split('\n').map((l) => l.split('=').map((x) => x.trim())).filter((x) => x[0] && x[1] !== undefined)
    .map(([c, n]) => [c === '/' ? '/' : c.replace(/\/+$/, ''), Math.max(0, Math.min(capas.length - 1, parseInt(n, 10) || 0))])
    .sort((a, b) => b[0].length - a[0].length);
  const temas = {};
  s.temas.split('\n').map((l) => l.split('=').map((x) => x.trim())).filter((x) => x[0]).forEach(([id, nombre, color], i) => {
    temas[id] = [nombre || id, color || PALETA[i % PALETA.length]];
  });
  const excluir = new Set(s.excluir.split(/[\n,]/).map((x) => x.trim()).filter(Boolean));
  return { capas, carpetas, temas, excluir };
}

function limpiarFrase(l) {
  const t = l.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a).replace(/^\s*(?:[-*>|]\s*)+/, '').replace(/[*_`]/g, '').replace(/\|/g, ' · ').replace(/\s+/g, ' ').trim();
  return t.length > 220 ? t.slice(0, 219) + '…' : t;
}

function resumir(texto) {
  const cuerpo = texto.replace(/^---[\s\S]*?\n---\n?/, '');
  const i = cuerpo.search(/^## En una frase\s*$/m);
  const desde = i >= 0 ? cuerpo.slice(i).split('\n').slice(1).join('\n') : cuerpo.replace(/^#\s.*$/m, '');
  const parrafo = desde.split(/\n\s*\n/).map((x) => x.trim()).find((x) => x && !x.startsWith('#') && !x.startsWith('>') && !x.startsWith('|'));
  if (!parrafo) return '';
  const limpio = parrafo.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a).replace(/[*_`]/g, '').replace(/\s+/g, ' ');
  return limpio.length > 260 ? limpio.slice(0, 259) + '…' : limpio;
}


// Un registro contiene todo lo que se deriva del cuerpo y del frontmatter de un archivo. Se
// mantiene deliberadamente sin referencias al vault: GraphStore puede compartirlo entre lecturas
// sin que un consumidor de un grafo anterior pueda cambiar el siguiente.
export function crearRegistro(app, archivo, texto, mtime = null, s = {}) {
  const fm = app.metadataCache.getFileCache(archivo)?.frontmatter || {};
  let tema = fm[s.propiedadTema]; if (Array.isArray(tema)) tema = tema[0];
  tema = tema ? String(tema) : null;
  const cuerpo = String(texto || '');
  const curados = {};
  for (const m of cuerpo.matchAll(MOTIVO)) curados[m[1].trim()] = m[2].trim();
  const lineas = cuerpo.split('\n');
  const finCuerpo = (() => { const i = lineas.findIndex((l) => l.startsWith('## ' + (s.seccionMotivos || 'Conexiones'))); return i < 0 ? lineas.length : i; })();
  const enlaces = enlacesDe(fm, s).map((e) => Object.freeze({ titulo: e.titulo, url: e.url }));
  const carpetasF = carpetasFuentesDe(s);
  return Object.freeze({
    path: archivo.path, basename: archivo.basename, mtime,
    titulo: String(fm.title || archivo.basename).slice(0, 90), tema,
    updated: fm.updated ? String(fm.updated) : null, resumenAprobado: fm.resumen ? String(fm.resumen) : null,
    resumen: fm.resumen ? String(fm.resumen) : resumir(cuerpo), enlaces: Object.freeze(enlaces),
    hub: fm.hub === true || String(fm.hub).toLowerCase() === 'true',
    curados: Object.freeze(curados), lineas: Object.freeze(lineas), finCuerpo,
    citas: Object.freeze(carpetasF.length ? citasDe(cuerpo, carpetasF).map((c) => Object.freeze({ ruta: c.ruta, linea: c.linea })) : []),
  });
}

function mapaRegistros(registros) {
  return registros instanceof Map ? registros : new Map(registros || []);
}

// Construcción pura de los datos derivados. Solo recibe los registros ya leídos; la fuente de
// autoridad para los enlaces es el resolvedLinks que el llamador captura en esta reconstrucción.
export function construirDesdeRegistros(app, s, registros, resueltos = app.metadataCache.resolvedLinks) {
  const cfg = leerAjustes(s);
  const records = mapaRegistros(registros);
  const nodos = {}, porRuta = {}, aristas = new Map();
  const poner = (a, b, m) => { const k = a < b ? a + '|' + b : b + '|' + a; if (!aristas.has(k) || (m && !aristas.get(k))) aristas.set(k, m || ''); };
  const capaDe = (ruta) => {
    if (!cfg.carpetas.length) return /^\d{4}-\d{2}-\d{2}/.test(ruta.split('/').pop()) ? 0 : Math.min(1, cfg.capas.length - 1);
    for (const [c, n] of cfg.carpetas) if ((c === '' || c === '/') ? !ruta.includes('/') : (ruta === c || ruta.startsWith(c + '/'))) return n;
    return -1;
  };
  const todas = app.vault.getMarkdownFiles();
  for (const f of todas) {
    const capa = capaDe(f.path), registro = records.get(f.path);
    if (capa < 0 || cfg.excluir.has(f.basename) || !registro) continue;
    if (registro.tema && !cfg.temas[registro.tema]) cfg.temas[registro.tema] = [registro.tema, PALETA[Object.keys(cfg.temas).length % PALETA.length]];
    nodos[f.path] = { id: f.path, capa, ruta: f.path, titulo: registro.titulo, tema: registro.tema,
      propio: !!registro.tema, updated: registro.updated, resumenAprobado: registro.resumenAprobado,
      resumen: registro.resumen, enlaces: registro.enlaces.map((e) => ({ ...e })), hub: registro.hub };
    porRuta[f.path] = f.path;
  }
  // Validación de la config: carpetas que no tienen ninguna nota y notas que no caen en capa alguna.
  // Antes desaparecían en silencio y el usuario inventaba una explicación.
  const carpetasVacias = cfg.carpetas.map(([c]) => c).filter((c) => c !== '/' && c !== '' && !todas.some((f) => f.path === c || f.path.startsWith(c + '/')));
  const links = resueltos || {}, sinMotivoPorNota = {}, frases = {}, citas = {};
  const carpetasF = carpetasFuentesDe(s), conFuentes = s.fuentes !== 'no' && s.fuentes !== false && carpetasF.length > 0;
  const enFuentes = (r) => carpetasF.some((c) => r.startsWith(c.ruta + '/'));
  // «Fuera de toda capa» solo cuenta dentro de los árboles que el usuario sí mapeó: si sus
  // capas son wiki/diario, wiki/temas…, una nota en wiki/suelta.md es un hueco que le
  // interesa; prompts/, docs/ o el index.md de la raíz están fuera a propósito. En el
  // cerebro real eran 31 avisos falsos en cada carga.
  // Si todas las capas son carpetas de primer nivel, el árbol mapeado es el vault entero.
  const raices = new Set(cfg.carpetas.map(([c]) => (c === '/' || c === '' ? '/' : c.split('/')[0])));
  const plano = cfg.carpetas.every(([c]) => !c.includes('/'));
  const enArbolMapeado = (r) => plano || raices.has('/') || (r.includes('/') && raices.has(r.split('/')[0]));
  const sinCapa = cfg.carpetas.length ? todas.filter((f) => capaDe(f.path) < 0 && enArbolMapeado(f.path) && !cfg.excluir.has(f.basename) && !enFuentes(f.path)).map((f) => f.path) : [];
  for (const id of Object.keys(nodos)) {
    const registro = records.get(id);
    for (const destino of Object.keys(links[id] || {})) {
      if (!porRuta[destino] || destino === id) continue;
      const base = destino.split('/').pop().replace(/\.md$/, '');
      const motivo = registro.curados[base] || '';
      poner(id, destino, motivo);
      if (!motivo) {
        const k = id < destino ? id + '|' + destino : destino + '|' + id;
        if (!frases[k]) for (let i = 0; i < registro.finCuerpo; i++) {
          const l = registro.lineas[i];
          if (l.includes('[[' + base + ']]') || l.includes('[[' + base + '|')) { frases[k] = { origen: id, destino, linea: i + 1, texto: limpiarFrase(l) }; break; }
        }
      }
    }
    if (conFuentes) for (const c of registro.citas) {
      const nf = nodoFuenteDe(c.ruta, carpetasF); if (!nf) continue;
      const rid = 'raw:' + nf.ruta;
      if (!nodos[rid]) {
        const existe = !!(app.vault.getFileByPath(nf.ruta) || app.vault.getFolderByPath?.(nf.ruta));
        // Sin extensión y sin carpeta detrás («imperio-venta-x08») es una mención, no una cita rota.
        if (!existe && !nf.grupo && !/\.[A-Za-z0-9]{1,6}$/.test(nf.ruta)) continue;
        nodos[rid] = { id: rid, capa: 0, ruta: nf.ruta, titulo: nf.titulo.slice(0, 80), tema: null, propio: false, fuente: true, grupo: !!nf.grupo, rota: !existe };
      }
      poner(rid, id, T('fuente citada en la página'));
      const k = rid < id ? rid + '|' + id : id + '|' + rid;
      if (!citas[k]) citas[k] = { origen: id, linea: c.linea };
    }
  }
  // Inventario y «sin vínculo»: qué hay en las carpetas de fuentes y qué no cita ninguna nota del
  // mapa. Las notas fuera del mapa (excluidas o en carpetas sin capa) se leen solo para poder decir
  // «citada por una nota fuera del mapa», que no es lo mismo que sin cita en todo el vault.
  const fuera = {};
  if (conFuentes) {
    for (const f of todas) {
      if (nodos[f.path] || enFuentes(f.path)) continue; // las fuentes no se leen como notas
      const registro = records.get(f.path); if (!registro) continue;
      for (const c of registro.citas) { const nf = nodoFuenteDe(c.ruta, carpetasF); if (nf && !nodos['raw:' + nf.ruta]) { const l = fuera[nf.ruta] = fuera[nf.ruta] || []; if (!l.includes(f.path)) l.push(f.path); } }
    }
  }
  const inventario = conFuentes ? inventarioFuentes(app, carpetasF) : [];
  const sinVinculo = inventario.filter((i) => !nodos['raw:' + i.ruta]).map((i) => ({ ...i, fuera: fuera[i.ruta] || [] }));
  const citadas = inventario.length - sinVinculo.length;
  const vecinos = {};
  Object.keys(nodos).forEach((k) => (vecinos[k] = new Set()));
  for (const [k, m] of aristas) {
    const [a, b] = k.split('|'); vecinos[a].add(b); vecinos[b].add(a);
    if (!m) { sinMotivoPorNota[a] = (sinMotivoPorNota[a] || 0) + 1; sinMotivoPorNota[b] = (sinMotivoPorNota[b] || 0) + 1; }
  }
  for (const n of Object.values(nodos)) {
    if (!n.tema) {
      const c = {}; vecinos[n.id].forEach((v) => { const t = nodos[v].tema; if (t) c[t] = (c[t] || 0) + 1; });
      n.tema = Object.keys(c).sort((x, y) => c[y] - c[x])[0] || null;
    }
    n.grado = vecinos[n.id].size;
    n.sinMotivo = sinMotivoPorNota[n.id] || 0;
  }
  const ordenTema = Object.fromEntries(Object.keys(cfg.temas).map((t, i) => [t, i]));
  const cols = cfg.capas.map((_, i) => Object.values(nodos).filter((n) => n.capa === i));
  cols.forEach((c) => c.sort((p, q) => (ordenTema[p.tema] ?? 99) - (ordenTema[q.tema] ?? 99) || q.grado - p.grado));
  const pos = {};
  const indexar = () => cols.forEach((c) => c.forEach((n, i) => (pos[n.id] = i / Math.max(c.length - 1, 1))));
  indexar();
  // Baricentro ponderado: las capas vecinas mandan (peso 1) y las lejanas empujan con 1/distancia.
  // Antes solo contaban las contiguas y un enlace L0→L4 no influía en nada: en vaults densos
  // esas curvas largas cruzaban todo el mapa sin que el orden vertical las acomodara.
  for (let it = 0; it < 6; it++) cols.forEach((c, capa) => {
    c.forEach((n) => {
      let suma = 0, peso = 0;
      for (const v of vecinos[n.id]) { const d = Math.abs(nodos[v].capa - capa); if (!d) continue; suma += pos[v] / d; peso += 1 / d; }
      n._b = peso ? suma / peso : pos[n.id];
    });
    c.sort((p, q) => (ordenTema[p.tema] ?? 99) - (ordenTema[q.tema] ?? 99) || p._b - q._b);
    indexar();
  });
  return { nodos: cols.flat(), aristas: [...aristas].map(([k, m]) => [...k.split('|'), m, frases[k] || null, citas[k] || null]), capas: cfg.capas, temas: cfg.temas,
    fuentes: { carpetas: carpetasF, inventario: inventario.length, citadas, sinVinculo },
    config: { carpetasVacias, sinCapa } };
}

export async function construir(app, s) {
  const registros = new Map();
  for (const f of app.vault.getMarkdownFiles()) {
    const archivo = app.vault.getFileByPath(f.path);
    registros.set(f.path, crearRegistro(app, f, archivo ? await app.vault.cachedRead(archivo) : '', f.stat?.mtime ?? f.mtime ?? null, s));
  }
  return construirDesdeRegistros(app, s, registros, app.metadataCache.resolvedLinks);
}

// Las reglas de conteo, escritas una sola vez: van en el JSON exportado y en el README. Quien
// reimplemente el motor (ya pasó: un usuario lo hizo en Python) tiene aquí el contrato.
export const REGLAS = {
  nodo: 'Cada archivo .md dentro de una carpeta asignada a una capa, menos los excluidos. Gana la carpeta más específica. Las fuentes citadas (raw:) no cuentan como notas.',
  enlace: 'Un par no dirigido de notas del mapa unidas por al menos un [[wikilink]] resuelto. A→B y B→A son un solo enlace. Los auto-enlaces y los enlaces a notas fuera del mapa se ignoran.',
  motivo: 'Texto de «- [[nota]] — motivo» en la sección de conexiones; si no hay, la primera línea del cuerpo donde aparece el enlace.',
  tema: 'La propiedad de tema del frontmatter; si falta, el tema más frecuente entre sus vecinos.',
  hub: 'Por tema, la nota de la última capa con hub: true; si ninguna lo tiene, la primera de esa capa con el tema declarado.',
  grado: 'Número de vecinos distintos.',
};

const PALETA = ['#F7931A', '#34D17A', '#1FC8B4', '#5B95FF', '#F5CF45', '#B79CFF', '#FF7EB6', '#8BE9FD', '#FFB86C', '#A3E635'];

export const edgeId = (a, b) => JSON.stringify([a, b].sort());
