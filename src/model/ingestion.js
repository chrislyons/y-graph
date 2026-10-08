// Motor puro de la ingesta (1.32–1.33): de lo crudo al wiki. Solo funciones sin vault, sin red
// y sin ajustes globales — el Plugin (main.js) aporta el vault, la IA y los ajustes, y llama
// estas. Mantenerlas acá hace que la regla de deduplicación y el troceo se puedan leer (y
// probar) sin simular Obsidian.

// Huellas de párrafo guardadas en ingesta.json; las más viejas se olvidan.
export const PARRAFOS_RECORDADOS = 30000;

// Huella corta de un texto (cyrb53, 53 bits): dice «esto ya se envió» sin guardar el texto.
export const huella = (t) => {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

// «*.mini.md» → expresión regular. Sin «/» se compara con el nombre; con «/», con la ruta.
export function comoPatron(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$', 'i');
}

// Nombres para comparar alias: sin acentos, sin guiones y sin la forma legal de la empresa
// («Ferretería Andes SpA» = «ferreteria-andes-spa» = «Ferretería Andes»).
export function claveAlias(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_.,]/g, ' ').replace(/\s+/g, ' ').trim().replace(/ (spa|ltda|limitada|sa|eirl|inc|llc|ltd|gmbh)$/, '');
}

export function nombreNota(ruta) {
  return String(ruta || '').split('/').pop().replace(/\.md$/, '');
}

// Comparar textos sin que importen mayúsculas, acentos de formato ni espacios: la IA copia una
// cita con otro salto de línea o sin las negritas, y eso no la vuelve inventada.
export function normalizarCita(t) {
  return String(t || '').toLowerCase().replace(/[*_`>#[\]]/g, '').replace(/\s+/g, ' ').trim();
}

export function citaEnTexto(cita, texto) {
  const c = normalizarCita(cita);
  return c.length >= 12 && normalizarCita(texto).includes(c);
}

// Inserta una línea al final de la sección cuyo título coincide (sin los #). null si no existe.
export function insertarEnSeccion(texto, seccion, linea) {
  if (!seccion) return null;
  const L = texto.split('\n');
  const titulo = (l) => l.replace(/^#+\s*/, '').trim().toLowerCase();
  const i = L.findIndex((l) => /^#{1,6}\s/.test(l) && titulo(l) === seccion.trim().toLowerCase());
  if (i < 0) return null;
  const nivel = L[i].match(/^#+/)[0].length;
  let j = i + 1;
  while (j < L.length && !(/^#{1,6}\s/.test(L[j]) && L[j].match(/^#+/)[0].length <= nivel)) j++;
  while (j > i + 1 && !L[j - 1].trim()) j--;
  L.splice(j, 0, linea);
  return L.join('\n');
}

// Número fijo en [0, 1) para un par de enteros: el mismo enlace en el mismo viaje sortea
// siempre lo mismo, así un pulso que salió no desaparece al cuadro siguiente.
export const sorteo = (i, j) => {
  let h = Math.imul(i ^ Math.imul(j + 0x9E3779B9, 0x85EBCA6B), 0xC2B2AE35);
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

// Un error que no se arregla reintentando (llave, cuota diaria, modelo inexistente, tope): la
// ingesta deja de mandar tandas en vez de gastar el resto de la cuota en el mismo error.
export function fatal(mensaje) {
  return Object.assign(new Error(mensaje), { fatal: true });
}

// Cuánto va en cada llamada y cuántas a la vez. Una IA local (Ollama trae 2–4 mil tokens de
// contexto por defecto) corta en silencio lo que no le cabe: tandas chicas y de a una.
export function limitesIngestaPor(proveedorIA) {
  return proveedorIA === 'local' ? { trozo: 6000, tanda: 8000, paralelo: 1 } : { trozo: 20000, tanda: 45000, paralelo: 3 };
}

// Varios archivos chicos en una sola llamada: 32 archivos de 4 KB son 3 llamadas, no 32.
export function armarTandas(piezas, tanda) {
  const tandas = [];
  let actual = [], largo = 0;
  for (const x of piezas) {
    if (actual.length && largo + x.texto.length > tanda) { tandas.push(actual); actual = []; largo = 0; }
    actual.push(x); largo += x.texto.length;
  }
  if (actual.length) tandas.push(actual);
  return tandas;
}

// Qué sale de UN archivo ya leído. Tres filtros, del más barato al más fino:
//  1. un archivo idéntico al que ya se envió → nada (abrirlo y guardarlo cambia la fecha, no el texto);
//  2. un archivo que creció (el registro del día) → solo lo agregado;
//  3. un párrafo ya enviado desde otro archivo, o repetido en este lote → fuera.
// Lo que queda se parte en trozos de a lo más `trozo` caracteres: un archivo largo ya no se omite.
// Cada huella va en la pieza (o piezas) que lleva su párrafo: si una pieza sale bien y otra
// falla, los párrafos de la fallida no quedan como enviados.
export function prepararPiezas(ruta, texto, mtime, registro, trozo, vistos) {
  const antes = registro.archivos[ruta];
  const sello = { largo: texto.length, huella: huella(texto) };
  let nuevo = texto;
  if (antes && antes.huella === sello.huella) nuevo = '';
  else if (antes && texto.length > antes.largo && huella(texto.slice(0, antes.largo)) === antes.huella) nuevo = texto.slice(antes.largo);
  const quedan = [];
  for (const par of nuevo.split(/\n\s*\n/)) {
    if (!par.trim()) continue;
    const n = par.replace(/\s+/g, ' ').trim().toLowerCase();
    // Los párrafos cortos («## Notas», «- ok») se repiten sin ser la misma información.
    let h = null;
    if (n.length >= 40) {
      h = 'p' + huella(n);
      if (registro.parrafos[h] || vistos.has(h)) continue;
      vistos.add(h);
    }
    quedan.push([par, h]);
  }
  if (!quedan.length) return { piezas: [], sello, repetido: true };
  const trozos = [];
  let actual = null;
  for (const [par, h] of quedan) {
    for (let i = 0; i < par.length; i += trozo) {
      const pedazo = par.slice(i, i + trozo);
      if (actual && actual.texto.length + pedazo.length + 2 > trozo) { trozos.push(actual); actual = null; }
      actual = actual ? { texto: `${actual.texto}\n\n${pedazo}`, hs: actual.hs } : { texto: pedazo, hs: [] };
      if (h && !actual.hs.includes(h)) actual.hs.push(h);
    }
  }
  if (actual) trozos.push(actual);
  const piezas = trozos.map((t, i) => ({ ruta, texto: t.texto, parte: i + 1, partes: trozos.length, hs: t.hs, mtime }));
  return { piezas, sello, repetido: false };
}

// Cuánto pide esperar el servicio: Retry-After (segundos o fecha) o, en Gemini, retryDelay
// («13s») dentro del error. Tope de 60 s: más que eso, mejor avisar que dejar la ventana colgada.
export function esperaPedida(r) {
  const h = r.headers || {}, ra = h['retry-after'] ?? h['Retry-After'];
  let ms = NaN;
  if (ra !== undefined && ra !== null) ms = /^\d+(\.\d+)?$/.test(String(ra).trim()) ? Number(ra) * 1000 : Date.parse(ra) - Date.now();
  if (isNaN(ms)) {
    let j = {};
    try { j = r.json || {}; } catch { /* cuerpo que no es JSON */ }
    const d = (j.error?.details || []).find((x) => x && x.retryDelay);
    if (d) ms = parseFloat(d.retryDelay) * 1000;
  }
  return isNaN(ms) ? null : Math.min(Math.max(ms, 0), 60000);
}

// Un 429 de cuota DIARIA (la capa gratis de Gemini: 20 llamadas por modelo al día; OpenRouter:
// «free-models-per-day» con el tope en las cabeceras) no mejora reintentando: solo gasta.
// Devuelve el tope y el modelo si lo dice, null si es un límite de uso normal.
export function cuotaDiaria(r) {
  let j = {};
  try { j = r.json || {}; } catch { /* cuerpo que no es JSON */ }
  const v = (j.error?.details || []).flatMap((d) => d?.violations || []).find((x) => /PerDay/i.test(String(x.quotaId || '')));
  if (v) return { tope: v.quotaValue || '?', modelo: v.quotaDimensions?.model || '' };
  if (/per-day|per day/i.test(String(j.error?.message || ''))) return { tope: r.headers?.['x-ratelimit-limit'] || j.error?.metadata?.headers?.['X-RateLimit-Limit'] || '?', modelo: '' };
  return null;
}