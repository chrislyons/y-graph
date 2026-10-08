/* 1.33 — lo que encontró la auditoría forense del 25.09.2026 sobre el cerebro real.
 *
 * Cada bloque reproduce un fallo que pasó en el vault del autor y que las pruebas de antes no
 * veían: la ingesta perdía párrafos, el tope diario no limitaba, la cuota diaria de Gemini se
 * reintentaba, las carpetas de fuentes anidadas se contaban dos veces, un motivo con varios
 * enlaces no se reconocía, el buscador no mostraba nada y los pulsos se cortaban.
 *
 *   node pruebas/v133.cjs [ruta/main.js]
 */
const { cargarPlugin, vaultSimulado, pruebas, el, contexto2D } = require('./simulado.cjs');
const p = pruebas('v133');
const { Plugin, interno } = cargarPlugin(process.argv[2]);
const { construir, VistaMapa, GraphRenderer, AJUSTES_BASE, CLAVE_IA, carpetasFuentesDe, nodoFuenteDe, inventarioFuentes, buscarNodos, buscarFuera, pasaFiltro } = interno;

const ajustes = (extra) => Object.assign({}, AJUSTES_BASE, { configurado: true, capas: 'A|\nB|', carpetas: 'wiki = 1', carpetaCrudo: 'raw', carpetaWiki: 'wiki', proveedorIA: 'local', modeloIA: 'modelo-x', topeDiario: 30 }, extra);
async function plugin(notas, extra) {
  const v = vaultSimulado(notas);
  const pl = new Plugin(); pl.app = v.app; pl._datos = ajustes(extra); await pl.onload(); pl.esperasReintento = [0, 0, 0];
  return Object.assign(v, { pl, registro: () => JSON.parse(v.internos[pl.rutaRegistroIngesta()] || '{}') });
}
const respuesta = (obj) => ({ status: 200, json: { choices: [{ message: { content: JSON.stringify(obj) } }] } });

(async () => {
  // ── 1. Un archivo largo en varias piezas: lo que falló no queda como enviado ─────────────────
  {
    const texto = Array.from({ length: 60 }, (_, k) => `Párrafo ${k}: ` + 'dato importante sobre el cliente '.repeat(8)).join('\n\n');
    const { pl } = await plugin({ 'raw/largo.md': texto, 'wiki/a.md': 'x' });
    const m = await pl.prepararMaterial(pl.reunirCrudo());
    p.cierto('un archivo largo se parte en varias piezas', m.piezas.length >= 3);
    p.cierto('cada pieza lleva las huellas de sus propios párrafos', m.piezas.every((x) => x.hs.length > 0));
    m.piezas[0].ok = true;                                   // la 1 se leyó; las demás fallaron
    await pl.confirmarIngesta(m);
    const m2 = await pl.prepararMaterial(pl.reunirCrudo());
    const faltaban = m.piezas.slice(1).map((x) => x.texto.match(/Párrafo \d+:/g)).flat();
    const vuelven = m2.piezas.map((x) => x.texto).join('\n');
    p.igual('los párrafos de las piezas fallidas se vuelven a enviar', faltaban.filter((x) => !vuelven.includes(x)).length, 0);
    p.cierto('y los de la pieza que salió bien no se repiten', !vuelven.includes(m.piezas[0].texto.match(/Párrafo \d+:/)[0]));
  }

  // ── 2. Con fallos, el sello avanza hasta justo antes del archivo fallido más viejo ───────────
  {
    const ahora = Date.now();
    const v = await plugin({ 'raw/viejo.md': 'Material viejo que falló al leerse en la ingesta anterior.', 'raw/nuevo.md': 'Material nuevo que sí se leyó bien en la ingesta anterior.', 'wiki/a.md': 'x' });
    v.mtimes['raw/viejo.md'] = ahora - 6 * 864e5; v.mtimes['raw/nuevo.md'] = ahora - 864e5;
    const m = await v.pl.prepararMaterial(v.pl.reunirCrudo());
    m.piezas.forEach((x) => (x.ok = x.ruta === 'raw/nuevo.md'));
    await v.pl.confirmarIngesta(m);
    const sello = Date.parse(v.pl.ajustes.ultimaIngesta);
    p.cierto('con un fallo el sello igual avanza', sello > 0);
    p.cierto('pero no salta el archivo que falló', sello < v.mtimes['raw/viejo.md']);
    const real = Date.now; Date.now = () => real() + 10 * 864e5;   // pasan 10 días: la ventana de 7 ya no lo cubriría
    try { p.cierto('y lo fallido sigue pendiente aunque pasen 7 días', v.pl.reunirCrudo().some((f) => f.path === 'raw/viejo.md')); } finally { Date.now = real; }
  }

  // ── 3. El tope diario cuenta cada llamada real: los dos pasos y los reintentos ───────────────
  {
    const notas = { 'wiki/a.md': 'x', 'wiki/b.md': 'y' };
    for (let i = 0; i < 4; i++) notas[`raw/r${i}.md`] = `Material nuevo número ${i} con decisiones del proyecto. ` + 'x'.repeat(7000);
    const v = await plugin(notas, { autoIngesta: true, topeDiario: 3 });
    let llamadas = 0;
    global.__req = async (o) => {
      llamadas++;
      const u = JSON.parse(o.body).messages[1].content;
      if (!u.includes('<material')) return respuesta({ resultados: [] });
      const f = [...u.matchAll(/fuente="([^"]+)"/g)].map((x) => x[1]);
      return respuesta({ contradicciones: [], novedades: f.flatMap((r) => ['wiki/a.md', 'wiki/b.md'].map((d) => ({ texto: 'n ' + d, cita: 'Material nuevo número', fuente: r, destino: d, crear: false }))) });
    };
    // [1.33.1] Con más tandas que el tope, lee hasta el tope (antes no leía nada, ningún día).
    const r = await v.pl.alAbrirObsidian();
    p.igual('con 4 tandas y tope 3, igual arranca', r, 'hecho');
    p.cierto('y no pasa de 3 llamadas reales (los dos pasos y los reintentos cuentan)', llamadas > 0 && llamadas <= 3);
    p.igual('el uso anotado es lo que de verdad se llamó', v.registro().uso?.llamadas, llamadas);
    await v.pl.cerrarRevision();
    const otra = llamadas; p.igual('con el tope ya usado hoy, no arranca', [await v.pl.alAbrirObsidian(), llamadas], ['tope', otra]);
    global.__req = null;
  }

  // ── 4. La cuota diaria de Gemini: no se reintenta, se detiene y se dice por qué ──────────────
  {
    const notas = { 'wiki/a.md': 'x' };
    for (let i = 0; i < 5; i++) notas[`raw/r${i}.md`] = `Material ${i}. ` + 'y'.repeat(30000);
    const v = await plugin(notas, { proveedorIA: 'gemini', modeloIA: 'gemini-3.8-flash' });
    v.app._ls[CLAVE_IA('gemini')] = 'llave';
    let llamadas = 0;
    global.__req = async () => { llamadas++; return { status: 429, headers: {}, json: { error: { code: 429, message: 'You exceeded your current quota', details: [
      { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20', quotaDimensions: { model: 'gemini-3.8-flash' } }] },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '9s' }] } } }; };
    const m = await v.pl.prepararMaterial(v.pl.reunirCrudo());
    const st = await v.pl.buscarNovedades(m);
    const tandas = v.pl.armarTandas(m.piezas).length;
    p.cierto('hay varias tandas para mandar', tandas >= 3);
    p.cierto('la cuota diaria no se reintenta ni se insiste con las demás tandas', llamadas <= 3 && llamadas < tandas * 4);
    p.cierto('el aviso dice que es la cuota diaria y cuál es', /cuota diaria|daily quota/i.test(st.prop.fallos[0]?.error || '') && /20/.test(st.prop.fallos[0].error));
    p.cierto('el último error queda guardado en ingesta.json', /cuota diaria|daily quota/i.test(v.registro().ultimoError?.mensaje || ''));
    global.__req = null;
  }

  // ── 5. Gemini corta o bloquea: se dice eso, no «prueba con otro modelo» ──────────────────────
  {
    const v = await plugin({ 'wiki/a.md': 'x' }, { proveedorIA: 'gemini', modeloIA: 'g' });
    v.app._ls[CLAVE_IA('gemini')] = 'llave';
    global.__req = async () => ({ status: 200, json: { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"novedades": [' }] } }] } });
    let error = ''; try { await v.pl.llamarIA('s', 'u', { type: 'object', properties: {} }); } catch (e) { error = e.message; }
    p.cierto('una respuesta cortada se dice como cortada', /cortada|cut short/i.test(error));
    global.__req = async () => ({ status: 200, json: { promptFeedback: { blockReason: 'SAFETY' } } });
    error = ''; try { await v.pl.llamarIA('s', 'u', { type: 'object', properties: {} }); } catch (e) { error = e.message; }
    p.cierto('un material bloqueado se dice como bloqueado', /SAFETY/.test(error));
    global.__req = null;
  }

  // ── 5b. OpenRouter: mismo protocolo que OpenAI, con sus particularidades ─────────────────────
  {
    const v = await plugin({ 'wiki/a.md': 'x' }, { proveedorIA: 'openrouter', modeloIA: 'google/gemini-3.1-flash-lite' });
    v.app._ls[CLAVE_IA('openrouter')] = 'llave-or';
    let visto = null;
    global.__req = async (o) => { visto = o; return respuesta({ ok: true }); };
    const r = await v.pl.llamarIA('s', 'u', { type: 'object', properties: { ok: { type: 'boolean' } } });
    const cuerpo = JSON.parse(visto.body);
    p.cierto('openrouter: va a su dirección con la llave como Bearer', visto.url.startsWith('https://openrouter.ai/api/v1/') && visto.headers.authorization === 'Bearer llave-or');
    p.cierto('openrouter: pide JSON con esquema y solo servidores que lo respeten', cuerpo.response_format?.type === 'json_schema' && cuerpo.provider?.require_parameters === true);
    p.igual('openrouter: devuelve el JSON', r, { ok: true });
    global.__req = async () => ({ status: 200, json: { error: { code: 502, message: 'upstream caído' } } });
    let error = ''; try { await v.pl.llamarIA('s', 'u', { type: 'object', properties: {} }); } catch (e) { error = e.message; }
    p.cierto('openrouter: un error dentro de un 200 se dice como error', /upstream caído/.test(error));
    let n = 0; global.__req = async () => { n++; return { status: 429, headers: { 'x-ratelimit-limit': '50' }, json: { error: { code: 429, message: 'Rate limit exceeded: free-models-per-day' } } }; };
    error = ''; try { await v.pl.pedirReintentando({ url: 'x' }, 'OpenRouter'); } catch (e) { error = e.message; }
    p.cierto('openrouter: el límite diario de los modelos gratis no se reintenta', n === 1 && /cuota diaria|daily quota/i.test(error) && /50/.test(error));
    global.__req = null;
  }

  // ── 6. Carpetas de fuentes anidadas: gana la más específica y nada se cuenta dos veces ───────
  {
    const C = carpetasFuentesDe({ carpetasFuentes: 'raw\nraw/articles\nraw/daily/*' });
    p.igual('una cita a un archivo del día se agrupa en su día', nodoFuenteDe('raw/daily/2026-09-20/claude.md', C)?.ruta, 'raw/daily/2026-09-20');
    p.igual('una cita a un artículo cae en su carpeta, con su nombre', nodoFuenteDe('raw/articles/a.md', C)?.titulo, 'a.md');
    const { app } = vaultSimulado({ 'raw/x.md': '', 'raw/articles/a.md': '', 'raw/daily/2026-09-20/c.md': '', 'raw/daily/2026-09-21/d.md': '' });
    p.igual('el inventario cuenta cada archivo una sola vez', inventarioFuentes(app, C).map((i) => i.ruta).sort(), ['raw/articles/a.md', 'raw/daily/2026-09-20', 'raw/daily/2026-09-21', 'raw/x.md']);
  }

  // ── 7. Motivos: varios enlaces en una línea, enlaces con ruta, ancla o mayúsculas ────────────
  {
    const notas = {
      'wiki/dia.md': 'Hoy.\n\n## Conexiones\n\n- [[alfa]] · [[beta]] · [[gama]] — lo ingerido del lote de cobertura\n- [[wiki/delta|Delta]] — el cliente que pidió el cambio\n',
      'wiki/alfa.md': 'a', 'wiki/beta.md': 'b', 'wiki/gama.md': 'c', 'wiki/delta.md': 'd',
      'wiki/epsilon.md': 'Trabajamos con [[Zeta#Historia|la gente de Zeta]] en el piloto.', 'wiki/zeta.md': 'z',
    };
    const { app } = vaultSimulado(notas);
    app.metadataCache.resolvedLinks['wiki/dia.md'] = { 'wiki/alfa.md': 1, 'wiki/beta.md': 1, 'wiki/gama.md': 1, 'wiki/delta.md': 1 };
    app.metadataCache.resolvedLinks['wiki/epsilon.md'] = { 'wiki/zeta.md': 1 };
    const D = await construir(app, ajustes({ capas: 'A|', carpetas: 'wiki = 0' }));
    const motivo = (a, b) => D.aristas.find((x) => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a));
    p.cierto('un motivo para varias notas vale para cada una', ['alfa', 'beta', 'gama'].every((n) => motivo('wiki/dia.md', `wiki/${n}.md`)?.[2] === 'lo ingerido del lote de cobertura'));
    p.igual('un motivo escrito con ruta y alias se reconoce', motivo('wiki/dia.md', 'wiki/delta.md')?.[2], 'el cliente que pidió el cambio');
    p.cierto('la frase aparece aunque el enlace tenga mayúscula y ancla', /piloto/.test(motivo('wiki/epsilon.md', 'wiki/zeta.md')?.[3]?.texto || ''));
  }

  // ── 8. El buscador: palabras en cualquier orden, sin tildes, por alias y fuera del mapa ──────
  // [adaptado al fork] El buscador del workbench vive en model/search.js (input del toolbar +
  // resaltado del lienzo comparten la misma regla); no hay «buscarTodo» sobre VistaMapa.
  {
    const notas = {
      'wiki/segundo-cerebro.md': '---\ntitle: Segundo Cerebro\naliases:\n  - Mi wiki\n---\nx [[diseño]]',
      'wiki/diseño.md': '---\ntitle: Diseño de marca\n---\ny',
      'raw/articles/2026-09-20-crawl4ai-open-source.md': 'nadie lo cita',
      'index.md': 'raíz',
    };
    const { app } = vaultSimulado(notas);
    const D = await construir(app, ajustes({ capas: 'A|', carpetas: 'wiki = 0', carpetasFuentes: 'raw/articles', fuentes: 'demanda' }));
    const enMapa = new Set(D.nodos.map((n) => n.id));
    p.igual('palabras en otro orden', buscarNodos(D, 'cerebro segundo')[0]?.id, 'wiki/segundo-cerebro.md');
    p.igual('con guion o sin tilde', buscarNodos(D, 'diseno-de')[0]?.id, 'wiki/diseño.md');
    p.igual('por alias del frontmatter', buscarNodos(D, 'mi wiki')[0]?.id, 'wiki/segundo-cerebro.md');
    p.igual('encuentra un archivo que no está en el mapa', buscarFuera(app, enMapa, 'crawl4ai')[0]?.ruta, 'raw/articles/2026-09-20-crawl4ai-open-source.md');
    p.cierto('y una nota fuera de toda capa', buscarFuera(app, enMapa, 'index').some((n) => n.ruta === 'index.md' && n.externo));
    p.igual('lo que está en el mapa no se repite como externo', buscarFuera(app, enMapa, 'segundo').length, 0);
    const porId = Object.fromEntries(D.nodos.map((n) => [n.id, n]));
    p.cierto('el filtro del mapa usa la misma regla',
      pasaFiltro(porId['wiki/segundo-cerebro.md'], 'CEREBRO segundo') && !pasaFiltro(porId['wiki/diseño.md'], 'CEREBRO segundo'));
  }

  // ── 9. Los pulsos: ninguno se corta a mitad de curva y nunca se quedan en cero ───────────────
  // [adaptado al fork] Los pulsos viven en GraphRenderer (dibujarPulsos + puntoEn sobre la curva
  // real de la escena); se muestrea el renderizador directamente en vez de la vista monolítica.
  {
    // 45 notas en L0 y 40 en L1, bien conectadas: k resulta múltiplo de 7, el caso que antes apagaba turnos enteros.
    const notas = {};
    for (let i = 0; i < 45; i++) notas[`d/n${i}.md`] = Array.from({ length: 7 }, (_, j) => `[[m${(i * 3 + j) % 40}]]`).join(' ');
    for (let j = 0; j < 40; j++) notas[`e/m${j}.md`] = 'x';
    const { app } = vaultSimulado(notas);
    const D = await construir(app, ajustes({ capas: 'A|\nB|', carpetas: 'd = 0\ne = 1', animacion: true }));
    const lienzo = { style: {}, getContext: () => contexto2D(), getBoundingClientRect: () => ({ width: 1400, height: 900, top: 0, left: 0 }) };
    const r = new GraphRenderer(lienzo, { medirTexto: (t) => String(t).length * 6.5, preferencias: { animacion: true } });
    r.setViewport({ width: 1400, height: 900, dpr: 1 });
    const base = { modo: 'capas', camara: { x: 0, y: 0, k: 1 }, filtro: '' };
    r.setGraph(D, base);
    const ctx = { set globalCompositeOperation(x) {}, set fillStyle(x) {}, beginPath() {}, fill() {}, arc() {} };
    const medir = () => {
      let prev = null, cortes = 0, minimo = Infinity; const orig = r.puntoEn.bind(r);
      for (let t = 5000; t < 35000; t += 33) {
        const vivos = new Map(); r.tiempo = t;
        r.puntoEn = (A, B, u, rad) => { vivos.set(A.id + '>' + B.id, u); return orig(A, B, u, rad); };
        r.dibujarPulsos(ctx, 1, (x) => r.colorTema(x)); r.puntoEn = orig;
        if (prev) { for (const [k, u] of prev) if (!vivos.has(k) && u > 0.08 && u < 0.92) cortes++; for (const [k, u] of vivos) if (!prev.has(k) && u > 0.08 && u < 0.92) cortes++; }
        minimo = Math.min(minimo, vivos.size); prev = vivos;
      }
      return { cortes, minimo };
    };
    const a = medir();
    p.igual('mapa: ningún pulso nace o muere a mitad de su curva', a.cortes, 0);
    p.cierto('mapa: siempre hay pulsos en pantalla', a.minimo > 0);
    r.setGraph(D, { ...base, modo: 'radial', foco: 'e/m0.md', seleccion: 'e/m0.md' });
    const b = medir();
    p.igual('radial: ningún pulso se corta', b.cortes, 0);
    p.cierto('radial: siempre hay una onda en movimiento', b.minimo > 0);
  }

  // ── 10. UI/UX (auditoría del 25.09): disposición con el panel, el teléfono y el radial ────────
  // [adaptado al fork] Sin «medir/encuadrar» de la vista monolítica: el tope por capa vive en
  // VistaMapa.aplicarTopePorCapa (adoptarEstado), la zona segura en areaSegura/enfocar, la
  // reserva del panel en encuadrar + renderer.camera(), los anillos en layoutRadial y los
  // rótulos en el renderizador. Las posiciones salen de la escena del renderizador.
  {
    // Un vault con 4 capas y una columna larga, como el real.
    const notas = {};
    for (let i = 0; i < 60; i++) notas[`c/k${i}.md`] = `[[e${i % 20}]] [[t${i % 4}]]`;
    for (let j = 0; j < 20; j++) notas[`e/e${j}.md`] = `[[t${j % 4}]]`;
    for (let j = 0; j < 30; j++) notas[`d/d${j}.md`] = `[[k${j}]] [[e${j % 20}]]`;
    for (let j = 0; j < 4; j++) notas[`t/t${j}.md`] = 'tema';
    const { app } = vaultSimulado(notas);
    const vista = (ancho, alto, extra, movil, ap = app) => {
      const v = new VistaMapa({}, { ajustes: ajustes(Object.assign({ capas: 'A|\nB|\nC|\nD|', carpetas: 'd = 0\ne = 1\nc = 2\nt = 3' }, extra)), tieneIA: () => false, app: ap, recortesSueltos: () => [], ingestaLista: () => false });
      const caja = (o) => Object.assign(el(), { getBoundingClientRect: () => Object.assign({ top: 0, left: 0, right: ancho, bottom: alto, width: ancho, height: alto }, o) });
      v.app = ap; v.contentEl = caja({});
      const lienzo = { style: {}, setAttribute() {}, getContext: () => contexto2D(), getBoundingClientRect: () => ({ width: ancho, height: alto, top: 0, left: 0 }) };
      v.renderer = new GraphRenderer(lienzo, { medirTexto: (t) => String(t).length * 6.5, preferencias: { mobile: !!movil } });
      v.renderer.setViewport({ width: ancho, height: alto, dpr: 1 });
      return { v, caja };
    };
    // Teléfono: el tope por capa ya vale en la primera carga, sin esperar un cambio de tamaño.
    const tel = vista(390, 844, {}, true).v; await tel.recargar();
    const cabe = Math.max(12, Math.floor((844 - 230) / 13));
    const capa2 = tel.datos.nodos.filter((n) => n.capa === 2 && tel.visibles.has(n.id));
    p.cierto('teléfono: desde la primera carga cada capa muestra solo lo que cabe', capa2.length <= cabe && (tel.ocultas[2] || 0) > 0);
    // Tocar una nota de la mitad de abajo: la hoja del panel no la tapa.
    const t2 = vista(390, 844, {}, true); await t2.v.recargar(); t2.v.encuadrar();
    const abajoDelTodo = t2.v.renderer.scene.nodes.filter((n) => n.capa === 1 && t2.v.visibles.has(n.id)).sort((a, b) => b.y - a.y)[0];
    t2.v.enfocar(abajoDelTodo.id, true);
    const cam2 = t2.v.renderer.camera();
    const sy = abajoDelTodo.y * cam2.k + cam2.y;
    const hoja = 844 - Math.min(0.58 * 844, 560) - 8;
    p.cierto('teléfono: la nota tocada queda entre la barra y la hoja del panel', sy > 8 && sy < hoja);
    // Ventana de 820 px con el panel abierto: la capa de temas queda a la izquierda del panel.
    const t3 = vista(820, 1000, {}, false);
    t3.v.inspectorWorkbench = { width: 382, mobile: false, setGraph() {}, setState() {}, setSourceMode() {}, update() {} };
    await t3.v.recargar(); t3.v.encuadrar();
    const cam3 = t3.v.renderer.camera();
    const ultima = Math.max(...t3.v.renderer.scene.nodes.filter((n) => n.capa === 3).map((n) => n.x * cam3.k + cam3.x));
    p.cierto('820 px con panel: la última capa no queda debajo del panel', ultima < 426);
    // Radial con anillos llenos (70 y 80 notas, como el cerebro): caben entre el borde de arriba y el pie.
    const grande = { 'e/centro.md': Array.from({ length: 70 }, (_, i) => `[[a${i}]]`).join(' ') };
    for (let i = 0; i < 70; i++) grande[`c/a${i}.md`] = `[[b${i}]] [[b${(i + 35) % 80}]]`;
    for (let i = 0; i < 80; i++) grande[`d/b${i}.md`] = 'x';
    const g = vaultSimulado(grande);
    const t4 = vista(1440, 860, { capas: 'A|\nB|\nC|', carpetas: 'd = 0\ne = 1\nc = 2' }, false, g.app);
    await t4.v.recargar();
    t4.v.estado.modo = 'radial';
    t4.v.estado.seleccion = 'e/centro.md';
    t4.v.adoptarEstado(t4.v.estado);
    t4.v.encuadrar();
    const cam4 = t4.v.renderer.camera();
    const ys = t4.v.renderer.scene.nodes.filter((n) => n.dist != null).map((n) => n.y * cam4.k + cam4.y);
    p.cierto('radial: ningún nodo pasa bajo la barra ni se sale por abajo', Math.min(...ys) >= 8 && Math.max(...ys) <= 860 - 50);
    // Textos del lienzo que antes estaban fijos en español.
    const dichos = []; const ctx = contexto2D(); ctx.fillText = (s) => dichos.push(String(s));
    t4.v.renderer.ctx = ctx;
    t4.v.renderer.render(1000);
    p.cierto('radial en inglés: el rótulo del anillo dice «hop», no «salto»', dichos.some((s) => /hop/.test(s)) && !dichos.some((s) => /salto/.test(s)));
  }

  // ── 11. «61 por leer» que nunca bajaba (25.09): leído ≠ revisado ────────────────────────────
  {
    const notas = { 'wiki/a.md': '# A\n' };
    for (let i = 0; i < 30; i++) notas[`raw/daily/2026-09-2${i % 6}/n${i}.md`] = Array.from({ length: 6 + (i % 30) }, (_, k) => `Párrafo ${k} del archivo ${i}: se acordó con el cliente ${i} un precio de ${1000 + k} pesos.`.repeat(4)).join('\n\n');
    const bóveda = vaultSimulado(notas);
    const abrir = async () => { const pl = new Plugin(); pl.app = bóveda.app; pl._datos = ajustes({ proveedorIA: 'openai', modeloIA: 'x' }); await pl.onload(); bóveda.app._ls[CLAVE_IA('openai')] = 'k'; pl.esperasReintento = [0, 0, 0]; return pl; };
    const porLeer = async (pl) => new Set((await pl.prepararMaterial(pl.reunirCrudo())).piezas.map((x) => x.ruta)).size;
    let cuota = 0;
    global.__req = async (o) => { const u = JSON.parse(o.body).messages[1].content;
      if (!u.includes('<material')) return respuesta({ resultados: [] });
      if (cuota-- <= 0) return { status: 429, headers: {}, json: { error: { message: 'quota', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }] }] } } };
      const f = [...u.matchAll(/fuente="([^"]+)"/g)].map((m) => m[1]); return respuesta({ contradicciones: [], novedades: f.slice(0, 1).map((r) => ({ texto: 'precio acordado ' + r, cita: 'se acordó con el cliente', fuente: r, destino: 'wiki/a.md', crear: false })) }); };
    let pl = await abrir(); const antes = await porLeer(pl);
    cuota = 4; const st = await pl.buscarNovedades(await pl.prepararMaterial(pl.reunirCrudo()));
    const despues = await porLeer(pl);
    p.cierto('lo que la IA leyó baja de «por leer» sin pulsar Terminar, aunque la cuota se acabe a la mitad', st.prop.exitosas === 4 && despues < antes && despues > 0);
    st.prop.novedades[0].decision = 'rechazada'; await pl.guardarRevision();
    pl = await abrir();                                   // Obsidian se reinicia
    const r = await pl.recuperarRevision();
    p.cierto('tras reiniciar, la revisión (y lo ya decidido) sigue ahí', r?.prop.novedades.length === st.prop.novedades.length && r.prop.novedades[0].decision === 'rechazada');
    p.igual('con una revisión pendiente, abrir Obsidian no vuelve a pagar', await (async () => { pl.ajustes.autoIngesta = true; return pl.alAbrirObsidian(); })(), 'revision-pendiente');
    await pl.cerrarRevision(); cuota = 99;
    await pl.buscarNovedades(await pl.prepararMaterial(pl.reunirCrudo()));
    p.igual('al día siguiente se lee solo lo que faltaba, y llega a cero', await porLeer(pl), 0);
    global.__req = null;
  }

  process.exit(p.cerrar() ? 1 : 0);
})().catch((e) => { console.error("   ✕ se cortó: " + e.message); p.cerrar(); process.exit(1); });
