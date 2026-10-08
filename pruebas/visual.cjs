/*
 * Comprobación conductual del mapa real en Chrome headless.
 *
 * `--dump-dom` no permite usar un controlador DevTools, así que esta
 * prueba prepara una copia temporal del mirador, engancha sus eventos antes
 * de que cargue el bundle y ejecuta las interacciones dentro de la página.
 * No modifica el mirador ni el código de producción.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIRADOR = path.join(__dirname, 'mirador');
const BUILD = path.join(__dirname, '.build');
const SCREENSHOTS = path.join(BUILD, 'visual');
const PROBE = path.join(MIRADOR, '.visual-probe.html');
const STYLES_COPY = path.join(MIRADOR, 'styles.css');
const VAULT_COPY = path.join(MIRADOR, 'vault.js');

function existeChrome(candidate) {
  if (!candidate) return false;
  try { fs.accessSync(candidate, fs.constants.X_OK); return fs.statSync(candidate).isFile(); } catch { return false; }
}

function chromeDisponible() {
  const candidatos = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe') : null,
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe') : null,
  ].filter(Boolean);
  return candidatos.find(existeChrome) || null;
}

const CHROME = chromeDisponible();
if (!CHROME) {
  console.log('visual: saltada (no hay Chrome/Chromium en este equipo)');
  process.exit(0);
}
if (!fs.existsSync(path.join(BUILD, 'main-test.js'))) {
  console.error('visual: ✕ falta pruebas/.build/main-test.js — ejecuta `npm run build:test` antes de esta prueba');
  process.exit(1);
}
if (!fs.existsSync(path.join(MIRADOR, 'mirador.html')) || !fs.existsSync(path.join(MIRADOR, 'vault.json'))) {
  console.error('visual: ✕ falta el mirador de pruebas o su vault');
  process.exit(1);
}

fs.mkdirSync(SCREENSHOTS, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'styles.css'), STYLES_COPY);
fs.writeFileSync(VAULT_COPY, `window.__VAULT = ${fs.readFileSync(path.join(MIRADOR, 'vault.json'), 'utf8')};\n`, 'utf8');

const ERROR_HOOK = `<script>
window.__visualErrors = [];
window.__visualBoot = 'pending';
(function installWhyGraphErrorCapture() {
  const record = (kind, value) => {
    try {
      const message = value && value.message ? value.message : String(value || kind);
      const stack = value && value.stack ? ' ' + value.stack : '';
      window.__visualErrors.push(kind + ': ' + message + stack);
    } catch (_) { window.__visualErrors.push(kind); }
  };
  window.addEventListener('error', (event) => record('pageerror', event.error || event.message), true);
  window.addEventListener('unhandledrejection', (event) => record('unhandledrejection', event.reason));
  const appendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (child) {
    if (!(child instanceof Node)) {
      const failure = { parent: this && this.nodeName, child: Object.prototype.toString.call(child), value: String(child), stack: new Error('appendChild').stack };
      window.__visualErrors.push('appendChild: ' + JSON.stringify(failure));
    }
    return appendChild.call(this, child);
  };
  const titleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
  Object.defineProperty(document, 'title', { configurable: true, get() { return titleDescriptor.get.call(document); }, set(value) { window.__visualTitleErrors = (window.__visualTitleErrors || []).concat(String(value)); titleDescriptor.set.call(document, value); } });
  const original = console.error.bind(console);
  console.error = function () {
    const args = Array.from(arguments);
    window.__visualErrors.push('consoleerror: ' + args.map((value) => {
      try { return value && value.stack ? value.stack : (value && value.message ? value.message : String(value)); } catch (_) { return '[unprintable]'; }
    }).join(' '));
    original.apply(null, args);
  };
})();
</script>`;

const BEHAVIOR = String.raw`<script>
(async function runWhyGraphBrowserSmoke() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const q = new URLSearchParams(location.search);
  const mode = q.get('visual') || 'full';
  const scene = q.get('scene') || '';
  const diagnostics = { mode, scene, ok: false, gates: {}, failures: [], exercised: [], unexercised: [], errors: [] };
  const pre = document.createElement('pre');
  pre.id = 'visual-diag';
  pre.hidden = true;
  const finish = (failed) => {
    diagnostics.titleHistory = Array.from(window.__visualTitleErrors || []);
    diagnostics.errors = Array.from(window.__visualErrors || []);
    diagnostics.ok = !failed && diagnostics.failures.length === 0 && diagnostics.errors.length === 0;
    pre.textContent = JSON.stringify(diagnostics);
    document.body.appendChild(pre);
    if (!diagnostics.ok) document.title = 'ERROR: visual smoke: ' + diagnostics.failures.concat(diagnostics.errors).join(' | ');
  };
  const gate = (id, passed, detail) => {
    diagnostics.gates[id] = { passed: !!passed, detail: String(detail == null ? '' : detail) };
    if (!passed) diagnostics.failures.push(id + ': ' + String(detail == null ? '' : detail));
  };
  const mark = (id) => { if (!diagnostics.exercised.includes(id)) diagnostics.exercised.push(id); };
  const findButton = (label) => Array.from(document.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === label);
  const dispatchKey = (target, key, options) => target.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, options || {})));
  const pointerAt = (x, y) => {
    const canvas = v.lienzo;
    const rect = canvas.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: rect.left + x, clientY: rect.top + y };
    canvas.dispatchEvent(new PointerEvent('pointerdown', init));
    canvas.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, init, { buttons: 0 })));
  };
  const cubic = (a, b, c, d, t) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  const edgeParts = (edge) => Array.isArray(edge) ? edge : [edge && edge.a, edge && edge.b, edge && edge.motivo, edge && edge.frase, edge && edge.linea];

  let tries = 0;
  while (!window.__v && tries++ < 200) {
    if (/^ERROR:/.test(document.title)) {
      diagnostics.failures.push('bootstrap: ' + document.title);
      finish(true);
      return;
    }
    await sleep(25);
  }
  if (!window.__v) {
    diagnostics.failures.push('bootstrap: window.__v no apareció');
    finish(true);
    return;
  }
  const v = window.__v;
  await sleep(200);
  for (let ready = 0; ready < 200 && document.title !== 'listo' && !/^ERROR:/.test(document.title); ready++) await sleep(25);
  await sleep(50);
  const api = window.__whyGraphTest;
  const canvas = v.lienzo;
  const describedby = String(canvas.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  const buttonWithoutName = Array.from(document.querySelectorAll('button')).filter((button) => !(button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '').trim());
  const hasGroup = !!document.querySelector('[role="group"][aria-label]');
  gate('toolbar', !!document.querySelector('.mn-workbench-toolbar') && !!document.querySelector('.mn-workbench-primary input[type="search"]'), 'workbench y búsqueda presentes');
  gate('canvas-aria', canvas.getAttribute('role') === 'img' && canvas.tabIndex === 0 && !!canvas.getAttribute('aria-label') && describedby.length > 0, 'role=img, tabIndex=0, aria-label y aria-describedby');
  gate('group-aria', hasGroup, 'grupo del canvas nombrado');
  gate('live-region', !!document.querySelector('[aria-live="polite"]'), 'región live presente');
  gate('node-listbox', !!document.querySelector('ul[role="listbox"][aria-label]'), 'listbox de nodos presente');
  gate('button-names', buttonWithoutName.length === 0, buttonWithoutName.length + ' botones sin nombre accesible');
  mark('base DOM');

  const tableButton = findButton('Tabla de datos') || document.querySelector('.mn-workbench-actions button:nth-last-child(3)');
  if (tableButton) tableButton.click();
  await sleep(50);
  const nodeTable = document.getElementById('why-graph-table-nodes');
  const edgeTable = document.getElementById('why-graph-table-edges');
  const tableHeaders = Array.from(document.querySelectorAll('.mn-inspector-table thead th'));
  const rowHeaders = Array.from(document.querySelectorAll('.mn-inspector-table tbody th'));
  gate('table-companion', !!nodeTable && !!edgeTable && describedby.every((id) => !!document.getElementById(id)), 'tablas enlazadas por aria-describedby');
  gate('table-headers', document.querySelectorAll('.mn-inspector-table table').length === 2 && document.querySelectorAll('.mn-inspector-table caption').length === 2 && tableHeaders.length > 0 && tableHeaders.every((th) => th.getAttribute('scope') === 'col') && rowHeaders.length > 0 && rowHeaders.every((th) => th.getAttribute('scope') === 'row'), tableHeaders.length + ' encabezados y ' + rowHeaders.length + ' encabezados de fila');
  mark('data-table');

  if (mode === 'shot') {
    if (tableButton && v.getState().panel === 'tabla') tableButton.click();
    if (scene === 'dark' || scene === 'light') {
      document.documentElement.classList.remove('theme-light', 'theme-dark');
      document.documentElement.classList.add(scene === 'dark' ? 'theme-dark' : 'theme-light');
      v.plugin.ajustes.temaVisual = 'tema';
      v.contentEl.setAttribute('data-mn-theme', 'tema');
    } else if (scene === 'night') {
      v.plugin.ajustes.temaVisual = 'noche';
      v.aplicarAjustesVisual();
    } else if (scene === 'table') {
      if (v.getState().panel !== 'tabla') tableButton.click();
    } else if (scene === 'health') {
      v.accionSalud();
    } else if (scene === 'gaps') {
      v.accionVacios();
    } else if (scene === 'radial') {
      const node = v.datos.nodos.find((item) => !item.fuente) || v.datos.nodos[0];
      v.seleccionar(node.id, 'nodo');
      v.cambiarModo('radial');
    } else if (scene === 'mobile') {
      await sleep(250);
      v.inspectorWorkbench.setMobile(true);
    }
    v.renderNow();
    await sleep(100);
    finish(false);
    return;
  }

  const dataEdges = (v.datos.aristas || []).map(edgeParts).filter(Boolean);
  const reasonEdges = dataEdges.filter((edge) => String(edge[2] || '').trim() || (edge[3] && String(edge[3].texto || edge[3]).trim()));
  const reasonNodeIds = new Set(reasonEdges.flatMap((edge) => [String(edge[0]), String(edge[1])]));
  const targetId = (v.datos.nodos.find((node) => reasonNodeIds.has(String(node.id))) || v.datos.nodos.find((node) => !node.fuente) || v.datos.nodos[0] || {}).id;
  const targetNode = v.datos.nodos.find((node) => String(node.id) === String(targetId));

  v.seleccionar(targetId, 'nodo');
  v.encuadrar(); v.renderNow();
  let nodePoint = null;
  const targetSceneNode = v.renderer.scene.nodes.find((node) => String(node.id) === String(targetId));
  if (targetSceneNode) {
    const camera = v.renderer._camera();
    const x = targetSceneNode.x * camera.k + camera.x;
    const y = targetSceneNode.y * camera.k + camera.y;
    const hit = v.renderer.hitTest(x, y);
    if (hit && hit.tipo === 'nodo' && hit.id === targetSceneNode.id && x >= 0 && y >= 0 && x <= v.viewportSize().width && y <= v.viewportSize().height) nodePoint = { x, y };
  }
  if (!nodePoint) {
    const candidate = v.renderer.scene.nodes.find((node) => v.renderer._visibleIds.has(node.id));
    if (candidate) {
      const camera = v.renderer._camera();
      const x = candidate.x * camera.k + camera.x;
      const y = candidate.y * camera.k + camera.y;
      const hit = v.renderer.hitTest(x, y);
      if (hit && hit.tipo === 'nodo' && x >= 0 && y >= 0 && x <= v.viewportSize().width && y <= v.viewportSize().height) nodePoint = { x, y };
    }
  }
  let hoverPoint = null, hoverId = null;
  {
    const camera = v.renderer._camera();
    const maxX = v.viewportSize().width, maxY = v.viewportSize().height;
    for (const node of v.renderer.scene.nodes) {
      if (!v.renderer._visibleIds.has(node.id)) continue;
      const x = node.x * camera.k + camera.x;
      const y = node.y * camera.k + camera.y;
      if (!(x >= 0 && y >= 0 && x <= maxX && y <= maxY)) continue;
      const hit = v.renderer.hitTest(x, y);
      if (hit && hit.tipo === 'nodo') { hoverPoint = { x, y }; hoverId = hit.id; break; }
    }
  }
  if (hoverPoint) {
    const canvas = v.lienzo;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 2, pointerType: 'mouse', isPrimary: true, button: -1, buttons: 0, clientX: rect.left + hoverPoint.x, clientY: rect.top + hoverPoint.y }));
    gate('node-hover', String(v.getState().sobre) === String(hoverId) && canvas.classList.contains('mn-sobre-nodo'),
      'sobre=' + v.getState().sobre + ', clase=' + canvas.classList.contains('mn-sobre-nodo') + ', hit=' + hoverId);
    mark('hover → resaltado');
    canvas.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, pointerId: 2, pointerType: 'mouse' }));
    gate('node-hover-clear', v.getState().sobre == null, 'sobre tras salir=' + v.getState().sobre);
  } else {
    gate('node-hover', false, 'ningún nodo visible es alcanzable por el puntero');
    gate('node-hover-clear', false, 'sin punto de hover no hay salida que limpiar');
  }
  if (nodePoint) pointerAt(nodePoint.x, nodePoint.y);
  const reasonText = v.inspectorWorkbench.content.textContent || '';
  gate('node-pointer-reason', String(v.getState().seleccion) === String(targetId) && /Motivos y frases/.test(reasonText) && !!v.inspectorWorkbench.content.querySelector('li'), 'selección=' + v.getState().seleccion + ', título=' + (targetNode && targetNode.titulo) + ', point=' + JSON.stringify(nodePoint) + ', active=' + v.interaccion._active + ', inspector=' + reasonText.slice(0, 80));
  mark('node click → reason');

  let edgePoint = null;
  let edgeId = null;
  for (const edge of v.renderer.scene.edges) {
    const a = v.renderer.scene.nodes.find((node) => node.id === edge.a);
    const b = v.renderer.scene.nodes.find((node) => node.id === edge.b);
    if (!a || !b) continue;
    const camera = v.renderer._camera();
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const wx = cubic(a.x, edge.c1x, edge.c2x, b.x, t);
      const wy = cubic(a.y, edge.c1y, edge.c2y, b.y, t);
      const x = wx * camera.k + camera.x;
      const y = wy * camera.k + camera.y;
      const hit = v.renderer.hitTest(x, y);
      if (hit && hit.tipo === 'arista' && hit.id === edge.id && x >= 0 && y >= 0 && x <= v.viewportSize().width && y <= v.viewportSize().height) {
        edgePoint = { x, y };
        edgeId = edge.id;
        break;
      }
    }
    if (edgePoint) break;
  }
  if (edgePoint) pointerAt(edgePoint.x, edgePoint.y);
  await sleep(0);
  const edgeInspector = [v.inspectorWorkbench.title.textContent || '', v.inspectorWorkbench.content.textContent || ''].join(' ');
  gate('edge-pointer-reason', !!edgeId && v.seleccionArista === edgeId && /Enlace seleccionado/.test(edgeInspector) && /Línea de origen|en el texto|motivo/i.test(edgeInspector), 'edge=' + (v.seleccionArista || 'none') + ', expected=' + (edgeId || 'none') + ', point=' + JSON.stringify(edgePoint) + ', inspector=' + edgeInspector.slice(0, 100));
  mark('edge click → reason');

  const search = v.workbenchToolbar.searchInput;
  search.value = String((targetNode && targetNode.titulo) || targetId);
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(0);
  dispatchKey(search, 'ArrowDown');
  dispatchKey(search, 'Enter');
  await sleep(0);
  const searchSelected = String(v.getState().seleccion) === String(targetId);
  const activeSearch = search.getAttribute('aria-activedescendant');
  gate('search-focus', searchSelected && !!activeSearch && !!document.getElementById(activeSearch), 'selección=' + v.getState().seleccion + ', active=' + (activeSearch || 'none') + ', options=' + JSON.stringify(v.interaccion.searchOptions));
  mark('search → focus');
  search.value = '';
  search.dispatchEvent(new Event('input', { bubbles: true }));

  canvas.focus();
  const focused = document.activeElement === canvas;
  const beforeCamera = Object.assign({}, v.interaccion.getState().camara);
  dispatchKey(canvas, 'j');
  const keyboardSelection = v.getState().seleccion;
  dispatchKey(canvas, 'ArrowRight');
  const afterPan = Object.assign({}, v.interaccion.getState().camara);
  dispatchKey(canvas, '+');
  const afterZoom = Object.assign({}, v.interaccion.getState().camara);
  dispatchKey(canvas, 'f');
  dispatchKey(canvas, '/');
  gate('keyboard', focused && !!keyboardSelection && afterPan.x === beforeCamera.x + 80 && afterZoom.k > afterPan.k && document.activeElement === search, 'focus=' + focused + ', pan=' + afterPan.x + ', zoom=' + afterZoom.k);
  mark('keyboard selection/pan/zoom/fit/search');

  const themeBefore = v.contentEl.getAttribute('data-mn-theme');
  v.plugin.ajustes.temaVisual = 'noche';
  v.aplicarAjustesVisual();
  const nightTheme = v.contentEl.getAttribute('data-mn-theme');
  v.plugin.ajustes.temaVisual = 'tema';
  v.aplicarAjustesVisual();
  gate('theme-switch', themeBefore !== nightTheme && nightTheme === 'noche' && v.contentEl.getAttribute('data-mn-theme') === 'tema', themeBefore + ' → ' + nightTheme + ' → ' + v.contentEl.getAttribute('data-mn-theme'));
  mark('theme switch');

  const healthButton = findButton('Salud');
  if (healthButton) healthButton.click();
  await sleep(0);
  const healthPanel = v.inspectorWorkbench.element.getAttribute('data-panel') === 'salud' && /Salud/.test(v.inspectorWorkbench.title.textContent || '');
  const gapsButton = findButton('Vacíos');
  if (gapsButton) gapsButton.click();
  await sleep(0);
  const gapsPanel = v.inspectorWorkbench.element.getAttribute('data-panel') === 'vacios' && /Vacíos entre temas/.test(v.inspectorWorkbench.title.textContent || '');
  gate('health-gaps', healthPanel && gapsPanel, 'salud=' + healthPanel + ', vacíos=' + gapsPanel);
  mark('health/gaps');

  v.seleccionar(targetId, 'nodo');
  v.plugin.ajustes.profundidadRadial = 2;
  v.renderer.preferencias.profundidadRadial = 2;
  v.cambiarModo('radial');
  v.encuadrar(); v.renderNow();
  const radialReal = v.getState().modo === 'radial' && String(v.getState().seleccion) === String(targetId) && v.renderer.scene.rings.length >= 1;
  const chain = { nodos: ['foco', 'd1', 'd2', 'd3', 'd4'].map((id, index) => ({ id, titulo: id, capa: 0, tema: 'x', grado: index === 0 || index === 4 ? 1 : 2 })), aristas: [['foco', 'd1'], ['d1', 'd2'], ['d2', 'd3'], ['d3', 'd4']].map((edge) => edge.concat('', { texto: 'demo', linea: indexOfDemo(edge) })), capas: [['x', 'Demo']], temas: {} };
  function indexOfDemo() { return 1; }
  const radialDepths = [1, 2, 3, 4].map((depth) => api.layoutRadial(chain, 'foco', { width: 1000, height: 800 }, { profundidad: depth, presupuestoAnillos: 20 }).rings.length === depth + 1);
  gate('radial-depth', radialReal && radialDepths.every(Boolean), 'real=' + radialReal + ', anillos 1..4=' + radialDepths.join('/'));
  mark('radial + depths 1–4');

  const originalLeaves = v.app.workspace.getLeavesOfType;
  v.app.workspace.getLeavesOfType = () => [{ view: v }];
  const savedName = 'Navegador visual';
  await v.plugin.guardarVista(savedName, v.getState());
  v.estado.modo = 'capas';
  v.estado.seleccion = null;
  v.estado.panel = null;
  v.adoptarEstado(v.estado);
  await v.plugin.restaurarVista(savedName);
  v.app.workspace.getLeavesOfType = originalLeaves;
  const restored = v.getState().modo === 'radial' && String(v.getState().seleccion) === String(targetId) && !!v.plugin.ajustes.vistasGuardadas[savedName];
  gate('save-restore', restored, 'vista=' + (v.plugin.ajustes.vistasGuardadas[savedName] ? 'guardada' : 'ausente') + ', modo=' + v.getState().modo);
  mark('save/restore');

  try {
    const result = await api.exportarVista(v, {
      adapter: {
        existe: async () => false,
        carpetaExiste: async () => true,
        escribirTexto: async () => {},
        escribirBinario: async () => {},
      },
      alcance: 'visible',
      formatos: ['png', 'svg', 'html', 'json', 'csv'],
      datos: v.datos,
      estado: v.getState(),
      escena: v.renderer.scene,
      renderizador: v.renderer,
      profundidadRadial: v.plugin.ajustes.profundidadRadial,
      ahora: new Date('2026-09-25T12:00:00Z'),
    });
    const byFormat = Object.fromEntries((result.files || []).map((file) => [file.formato, file.contenido]));
    const svg = String(byFormat.svg || '');
    const html = String(byFormat.html || '');
    let json = null;
    try { json = JSON.parse(String(byFormat.json || '')); } catch (_) {}
    const csv = String(byFormat.csv || '');
    gate('export', result.paths && result.paths.length === 5 && /<title[\s>]/.test(svg) && /<table[\s>]/.test(html) && json && json.schemaVersion === 2 && /origen.*destino.*motivo_origen/i.test(csv), 'paths=' + (result.paths || []).join(','));
  } catch (error) {
    gate('export', false, error && error.message ? error.message : String(error));
  }
  mark('PNG/SVG/HTML/JSON/CSV export');

  diagnostics.unexercised = [
    'pinch gesture',
    'long-press collapse',
    'native Tab traversal across every control',
    'physical mouse/pointer hardware',
    'real Obsidian file writes and download UX',
    'manual mobile safe-area reachability',
  ];
  finish(false);
})().catch((error) => {
  const pre = document.createElement('pre');
  pre.id = 'visual-diag';
  pre.hidden = true;
  pre.textContent = JSON.stringify({ ok: false, failures: ['driver: ' + (error && error.message ? error.message : String(error))], errors: window.__visualErrors || [] });
  document.body.appendChild(pre);
});
</script>`;

let probeWritten = false;
function cleanup() {
  if (process.env.KEEP_VISUAL_PROBE === '1') return;
  for (const file of [PROBE, STYLES_COPY, VAULT_COPY]) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
  }
}

function construirProbe() {
  const original = fs.readFileSync(path.join(MIRADOR, 'mirador.html'), 'utf8');
  if (!original.includes('</head>') || !original.includes('</body>')) throw new Error('mirador.html no tiene </head> y </body>');
  const instrumented = original.replace('</head>', ERROR_HOOK + '\n</head>').replace('</body>', BEHAVIOR + '\n</body>').replace("document.title = 'ERROR: ' + e.message; console.error(e);", "document.title = 'ERROR: ' + e.message + '|' + e.stack; console.error(e);");
  fs.writeFileSync(PROBE, instrumented, 'utf8');
  probeWritten = true;
}

function url(query, mobile) {
  const absolute = path.resolve(PROBE).split(path.sep).map((part, index) => index ? encodeURIComponent(part) : part).join('/');
  const prefix = process.platform === 'win32' ? 'file:///' : 'file://';
  const params = new URLSearchParams(query);
  if (mobile) params.set('movil', '1');
  return prefix + absolute + '?' + params.toString();
}

function runChrome(args) {
  return execFileSync(CHROME, args, {
    encoding: 'utf8',
    maxBuffer: 96 * 1024 * 1024,
    timeout: 45000,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function dump(query, mobile) {
  return runChrome([
    '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
    '--disable-default-apps', '--disable-sync', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1440,900',
    '--virtual-time-budget=30000', '--dump-dom', url(query, mobile),
  ]);
}

function decodeEntities(value) {
  return String(value)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function readDiagnostics(dom) {
  const match = String(dom).match(/<pre id="visual-diag"[^>]*>([\s\S]*?)<\/pre>/);
  if (!match) throw new Error('la página no emitió #visual-diag');
  return JSON.parse(decodeEntities(match[1]));
}

function assertFull(dom) {
  const title = String(dom).match(/<title>([\s\S]*?)<\/title>/i);
  const diagnostics = readDiagnostics(dom);
  const failures = [];
  if (!title || !/^listo$|^visual smoke listo$/.test(decodeEntities(title[1]))) failures.push('title: ' + (title ? decodeEntities(title[1]) : 'ausente'));
  if (!diagnostics.ok) failures.push(...(diagnostics.failures || []), ...(diagnostics.errors || []));
  return { diagnostics, failures };
}

function screenshot(name, query, size, mobile) {
  const file = path.join(SCREENSHOTS, name + '.png');
  runChrome([
    '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
    '--disable-default-apps', '--disable-sync', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=' + size,
    '--virtual-time-budget=30000', '--screenshot=' + file, url(query, mobile),
  ]);
  const data = fs.readFileSync(file);
  if (data.length < 100 || data.readUInt32BE(0) !== 0x89504e47) throw new Error('captura inválida: ' + name);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  return { name, file, width, height };
}

try {
  construirProbe();
  const dom = dump('visual=full', false);
  const result = assertFull(dom);
  const d = result.diagnostics;
  console.error('visual diagnostics:', JSON.stringify(d));
  console.log('visual: contrato DOM, Canvas, tablas y secuencia de interacciones');
  for (const id of ['title', 'toolbar', 'canvas-aria', 'group-aria', 'live-region', 'node-listbox', 'button-names', 'table-companion', 'table-headers', 'node-hover', 'node-hover-clear', 'node-pointer-reason', 'edge-pointer-reason', 'search-focus', 'keyboard', 'theme-switch', 'health-gaps', 'radial-depth', 'save-restore', 'export']) {
    const gate = d.gates && d.gates[id];
    console.log('  ' + (gate && gate.passed ? '✓' : '✕') + ' ' + id + (gate && gate.detail ? ' — ' + gate.detail : ''));
  }
  console.log('  ejercitadas: ' + d.exercised.join(' · '));
  console.log('  no ejercitadas por el límite CDP-free: ' + d.unexercised.join(' · '));

  const captures = [
    screenshot('desktop-light', 'visual=shot&scene=light', '1440,900', false),
    screenshot('desktop-dark', 'visual=shot&scene=dark', '1440,900', false),
    screenshot('table', 'visual=shot&scene=table', '1440,900', false),
    screenshot('health', 'visual=shot&scene=health', '1440,900', false),
    screenshot('gaps', 'visual=shot&scene=gaps', '1440,900', false),
    screenshot('radial', 'visual=shot&scene=radial&foco=Camila', '1440,900', false),
    screenshot('night-theme', 'visual=shot&scene=night', '1440,900', false),
    screenshot('mobile-390x844-surface', 'ancho=390&alto=844&visual=shot&scene=mobile', '500,900', true),
  ];
  for (const capture of captures) console.log('  ✓ captura ' + path.basename(capture.file) + ' — PNG ' + capture.width + '×' + capture.height);

  if (result.failures.length) {
    result.failures.forEach((failure) => console.error('  ✕ ' + failure));
    console.error('visual: ✕ ' + result.failures.length + ' contrato(s) observado(s) fallaron');
    process.exitCode = 1;
  } else {
    console.log('visual: ✓ smoke conductual completo; capturas en pruebas/.build/visual/');
  }
} catch (error) {
  console.error('visual: ✕ ' + (error && error.message ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  if (probeWritten) cleanup();
  else cleanup();
}
