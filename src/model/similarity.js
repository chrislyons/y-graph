// Mapa por parecido (1.35): tf-idf y t-SNE exactos, sin dependencias, para pocos puntos.
//
// Un índice tf-idf convierte cada nota en un vector de palabras; la distancia entre dos notas es
// 1 − coseno de sus vectores. t-SNE reparte las notas en un plano de modo que las de texto
// parecido queden cerca. Es determinista (semilla fija). Solo la vecindad significa algo; la
// distancia entre grupos y el tamaño de cada uno, no.

const PALABRAS_VACIAS = new Set('de la el en y a los las que un una por con para se del al es lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros the of and to in is that for it with as on are be this by or from at an not have has but was were their they will can you your its more one which about also into than'.split(' '));

export const tokensDe = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !PALABRAS_VACIAS.has(w));

/** Índice tf-idf de una lista de docs { ruta, texto }. Devuelve vecs, idf y norma. */
export function indiceTfidf(docs) {
  const df = new Map(), vecs = [];
  for (const d of docs) { const tf = new Map(); for (const w of tokensDe(d.texto)) tf.set(w, (tf.get(w) || 0) + 1); vecs.push({ ruta: d.ruta, tf }); for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1); }
  const N = docs.length || 1, idf = (w) => Math.log(1 + N / (df.get(w) || 1));
  const norma = (tf) => Math.sqrt([...tf].reduce((s, [w, c]) => s + (c * idf(w)) ** 2, 0)) || 1;
  for (const v of vecs) v.norma = norma(v.tf);
  return { vecs, idf, norma };
}

/** Las k notas más parecidas a un texto libre (sim > 0.05). */
export function parecidosA(ix, texto, k = 2) {
  const tf = new Map(); for (const w of tokensDe(texto)) tf.set(w, (tf.get(w) || 0) + 1);
  const nq = ix.norma(tf);
  return ix.vecs.map((v) => { let p = 0; for (const [w, c] of tf) { const o = v.tf.get(w); if (o) p += c * o * ix.idf(w) ** 2; } return { ruta: v.ruta, sim: p / (nq * v.norma) }; })
    .filter((x) => x.sim > 0.05).sort((a, b) => b.sim - a.sim).slice(0, k);
}

/**
 * t-SNE exacto para pocos puntos (≤ ~300). `dist` es la matriz n×n de distancias (Float64Array
 * o array plano); devuelve n puntos [x, y] en el plano. Determinista con la semilla por defecto.
 */
export function tsne(dist, n, { perplejidad = 20, vueltas = 350, semilla = 7 } = {}) {
  let a = semilla >>> 0;
  const azar = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (n < 3) return Array.from({ length: n }, (_, i) => [i, 0]);
  const perp = Math.min(perplejidad, (n - 1) / 3), objetivo = Math.log(perp);
  const P = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    let beta = 1, lo = 0, hi = Infinity;
    const fila = new Float64Array(n);
    for (let k = 0; k < 50; k++) {
      let suma = 0;
      for (let j = 0; j < n; j++) { fila[j] = j === i ? 0 : Math.exp(-dist[i * n + j] * beta); suma += fila[j]; }
      suma = suma || 1e-12;
      let H = 0; for (let j = 0; j < n; j++) if (fila[j] > 0) H += beta * dist[i * n + j] * fila[j] / suma;
      H += Math.log(suma);
      if (Math.abs(H - objetivo) < 1e-4) break;
      if (H > objetivo) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; } else { hi = beta; beta = (beta + lo) / 2; }
    }
    let suma = 0; for (let j = 0; j < n; j++) suma += fila[j]; suma = suma || 1e-12;
    for (let j = 0; j < n; j++) P[i * n + j] = fila[j] / suma;
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const v = Math.max((P[i * n + j] + P[j * n + i]) / (2 * n), 1e-12); P[i * n + j] = v; P[j * n + i] = v; }
  const Y = Float64Array.from({ length: n * 2 }, () => (azar() - 0.5) * 1e-2), dY = new Float64Array(n * 2), ganancia = new Float64Array(n * 2).fill(1);
  const num = new Float64Array(n * n), lr = Math.max(n / 12, 50);
  for (let it = 0; it < vueltas; it++) {
    let Z = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = Y[2 * i] - Y[2 * j], dy = Y[2 * i + 1] - Y[2 * j + 1], v = 1 / (1 + dx * dx + dy * dy);
      num[i * n + j] = v; num[j * n + i] = v; Z += 2 * v;
    }
    Z = Z || 1e-12;
    const exag = it < 100 ? 4 : 1, mom = it < 120 ? 0.5 : 0.8;
    for (let i = 0; i < n; i++) {
      let gx = 0, gy = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const m = (exag * P[i * n + j] - num[i * n + j] / Z) * num[i * n + j];
        gx += m * (Y[2 * i] - Y[2 * j]); gy += m * (Y[2 * i + 1] - Y[2 * j + 1]);
      }
      gx *= 4; gy *= 4;
      for (const [k, g] of [[2 * i, gx], [2 * i + 1, gy]]) {
        ganancia[k] = Math.sign(g) === Math.sign(dY[k]) ? Math.max(ganancia[k] * 0.8, 0.01) : ganancia[k] + 0.2;
        dY[k] = mom * dY[k] - lr * ganancia[k] * g;
      }
    }
    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { Y[2 * i] += dY[2 * i]; Y[2 * i + 1] += dY[2 * i + 1]; mx += Y[2 * i]; my += Y[2 * i + 1]; }
    mx /= n; my /= n;
    for (let i = 0; i < n; i++) { Y[2 * i] -= mx; Y[2 * i + 1] -= my; }
  }
  return Array.from({ length: n }, (_, i) => [Y[2 * i], Y[2 * i + 1]]);
}

/** Distancia entre dos notas = 1 − coseno de sus vectores TF-IDF. Matriz n×n plana. */
export function distanciasTfidf(ix, rutas) {
  const por = new Map(ix.vecs.map((v) => [v.ruta, v])), vs = rutas.map((r) => por.get(r)), n = rutas.length, d = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const [A, B] = vs[i].tf.size < vs[j].tf.size ? [vs[i], vs[j]] : [vs[j], vs[i]];
    let p = 0; for (const [w, c] of A.tf) { const o = B.tf.get(w); if (o) p += c * o * ix.idf(w) ** 2; }
    const v = 1 - p / (A.norma * B.norma); d[i * n + j] = v; d[j * n + i] = v;
  }
  return d;
}