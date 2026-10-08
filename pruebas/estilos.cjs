/* Step 9: theme tokens, semantic legend, settings controls and release scripts. */
const fs = require('fs');
const path = require('path');
const { cargarPlugin, pruebas, el } = require('./simulado.cjs');
global.__idioma = 'es';

const cargado = cargarPlugin(process.argv[2]);
const { AjustesMapa, AJUSTES_BASE, normalizarAjustes } = cargado.interno;
const { filas } = cargado;
const p = pruebas('estilos');

p.igual('AJUSTES_BASE contiene los valores exactos de visualización', {
  ordenCapas: AJUSTES_BASE.ordenCapas,
  profundidadRadial: AJUSTES_BASE.profundidadRadial,
  temaVisual: AJUSTES_BASE.temaVisual,
  mostrarLeyenda: AJUSTES_BASE.mostrarLeyenda,
  mostrarAyuda: AJUSTES_BASE.mostrarAyuda,
  vistasGuardadas: AJUSTES_BASE.vistasGuardadas,
  ultimaVista: AJUSTES_BASE.ultimaVista,
}, {
  ordenCapas: 'auto', profundidadRadial: 2, temaVisual: 'tema', mostrarLeyenda: true,
  mostrarAyuda: false, vistasGuardadas: {}, ultimaVista: null,
});

const normalizados = normalizarAjustes({
  ordenCapas: 'inventado', profundidadRadial: 99, temaVisual: 'inventado',
  mostrarLeyenda: 'false', mostrarAyuda: 1, maxPorCapa: 7,
  vistasGuardados: { Viejo: { estado: {}, creada: 1, actualizada: 2 } },
});
p.igual('los ajustes persistidos se normalizan a rangos y enums canónicos', {
  ordenCapas: normalizados.ordenCapas,
  profundidadRadial: normalizados.profundidadRadial,
  temaVisual: normalizados.temaVisual,
  mostrarLeyenda: normalizados.mostrarLeyenda,
  mostrarAyuda: normalizados.mostrarAyuda,
  maxPorCapa: normalizados.maxPorCapa,
}, {
  ordenCapas: 'auto', profundidadRadial: 4, temaVisual: 'tema', mostrarLeyenda: true,
  mostrarAyuda: false, maxPorCapa: 30,
});
p.cierto('la migración sigue ignorando el typo vistasGuardados', !Object.hasOwn(normalizados, 'vistasGuardados'));

const plugin = {
  ajustes: { ...AJUSTES_BASE, maxPorCapa: 150 },
  manifest: { version: '1.31.0' },
  app: { loadLocalStorage: () => null, saveLocalStorage: () => {} },
  guardar: async () => {},
  llamarIA: async () => ({ ok: true }),
};
const tab = new AjustesMapa({}, plugin); tab.containerEl = el();
const antes = JSON.stringify(plugin.ajustes);
const definitions = tab.getSettingDefinitions();
p.igual('getSettingDefinitions() no cambia el almacén de ajustes', JSON.stringify(plugin.ajustes), antes);
// Grupos y páginas (1.32) llevan sus ajustes en items: se aplanan para revisarlos todos.
const aplanar = (xs) => xs.flatMap((d) => (d.items ? aplanar(d.items) : [d]));
const porClave = new Map(aplanar(definitions).filter((item) => item.control).map((item) => [item.control.key, item.control]));
p.igual('las definiciones incluyen dropdown, slider y toggles de Step 9', {
  ordenCapas: porClave.get('ordenCapas')?.type,
  profundidadRadial: porClave.get('profundidadRadial')?.type,
  temaVisual: porClave.get('temaVisual')?.type,
  mostrarLeyenda: porClave.get('mostrarLeyenda')?.type,
  mostrarAyuda: porClave.get('mostrarAyuda')?.type,
}, {
  ordenCapas: 'dropdown', profundidadRadial: 'slider', temaVisual: 'dropdown',
  mostrarLeyenda: 'toggle', mostrarAyuda: 'toggle',
});

tab.display();
for (const nombre of ['Orden de las capas', 'Profundidad radial', 'Tema visual', 'Mostrar leyenda', 'Mostrar ayuda al abrir']) {
  p.cierto(`display() dibuja «${nombre}»`, filas.includes(nombre));
}

const css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
for (const token of ['--mn-bg', '--mn-surface', '--mn-border', '--mn-text', '--mn-muted', '--mn-grid', '--mn-accent', '--mn-danger', '--mn-warning', '--mn-success', '--mn-label-halo']) {
  p.cierto(`el tema raíz define ${token}`, css.includes(`${token}:`));
}
p.cierto('el selector adaptability existe para tema claro', css.includes('.theme-light .mn-raiz[data-mn-theme="tema"]'));
p.cierto('el selector adaptability existe para tema oscuro', css.includes('.theme-dark .mn-raiz[data-mn-theme="tema"]'));
p.cierto('la paleta nocturna permanece como opción', css.includes('.mn-raiz[data-mn-theme="noche"]'));
p.cierto('el fondo del workbench usa el token y no un azul fijo', /\.mn-raiz\s*\{[\s\S]*?background:\s*var\(--mn-bg\)/.test(css) && !css.includes('background: #060A18'));
p.cierto('la leyenda incluye marcas semánticas de nota, fuente, supernodo y problema', ['mn-mark-source', 'mn-mark-super', 'mn-mark-health'].every((clase) => css.includes(clase)));
p.cierto('los estados de foco usan focus-visible', css.includes(':focus-visible'));
p.cierto('la disposición móvil respeta safe-area', css.includes('safe-area-inset-bottom'));
p.cierto('el inspector móvil es una hoja inferior', css.includes('.mn-workbench-inspector[data-mobile="true"]'));

const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
p.cierto('la vista selecciona data-mn-theme al abrir', main.includes("raiz.setAttribute('data-mn-theme', this.estado.temaVisual)"));
p.cierto('la ayuda se crea como details y permanece oculta por defecto', main.includes("createEl('details', { cls: 'mn-workbench-help' })") && main.includes('this.ayuda.hidden = !ayudaInicial'));
p.cierto('el orden de capas se entrega al renderer', main.includes('ordenCapas: this.plugin.ajustes.ordenCapas'));
p.cierto('la vista radial entrega la profundidad al renderer', main.includes('profundidadRadial: this.plugin.ajustes.profundidadRadial'));
p.cierto('la leyenda tiene lista y texto junto a las marcas', main.includes("createEl('ul')") && main.includes("createSpan({ text: etiqueta })"));
p.cierto('el controlador usa GraphStore, GraphRenderer e InteractionController', ['GraphStore', 'GraphRenderer', 'createInteractionController'].every((name) => main.includes(name)));
p.cierto('no conserva nombres privados de layout, hit-test o export heredados', ['hitTestLegacy', 'nodoEn', 'medirRadial', 'dibujarEscena', 'paletaVisual', 'registrarGestos', 'calcularVacios', 'rehacer', 'rendererLegacy'].every((name) => !main.includes(name)));
p.cierto('no conserva aliases privados de datos o selección', ['this.D', 'this.N', 'this.E', 'this.porId', 'this.foco', 'this.radial'].every((name) => !main.includes(name)));
p.cierto('no existe inyección de pruebas en producción', !main.includes('new Function') && !main.includes('__whyGraphTest'));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
p.igual('el manifest conserva su identidad y compatibilidad', [manifest.id, manifest.minAppVersion, manifest.isDesktopOnly], ['mapa-neuronal', '1.8.7', false]);
p.igual('la producción conserva exactamente tres IDs de comando', [...main.matchAll(/addCommand\(\{ id: '([^']+)'/g)].map((match) => match[1]), ['abrir', 'recargar-ajustes', 'enfocar-actual']);

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
for (const script of ['build:test', 'test:visual', 'test:performance', 'test:browser']) {
  p.cierto(`package.json declara ${script}`, typeof packageJson.scripts[script] === 'string' && packageJson.scripts[script].length > 0);
}
const testScript = packageJson.scripts.test;
for (const required of ['npm run build', 'npm run build:test', 'plugin.cjs', 'fuentes.cjs', 'workbench.cjs', 'exports.cjs', 'estado.cjs', 'vistas.cjs', 'analisis.cjs', 'render.cjs', 'interaccion.cjs', 'v128.cjs', 'idioma.cjs', 'npm run test:visual', 'npm run test:performance', 'npm run test:browser']) {
  p.cierto(`npm test incluye ${required}`, testScript.includes(required));
}
const browser = fs.readFileSync(path.join(__dirname, 'interfaz.cjs'), 'utf8');
p.cierto('el runner de navegador solo se salta cuando Chrome no existe', browser.includes('if (!fs.existsSync(CHROME))') && browser.includes('falta el build de pruebas'));

process.exit(p.cerrar() ? 1 : 0);
