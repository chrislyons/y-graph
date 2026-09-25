/* Why Graph (id: mapa-neuronal) — el grafo que explica por qué cada nota se conecta.
 *
 * v1.19 (16.09.2026): el nombre visible pasa a «Why Graph». El id, los nombres de archivo y
 *   las clases CSS se quedan como están: cambiarlos costaría la ficha del directorio.
 *
 *
 * v1.31 (19.09.2026): salud por gravedad (rojo solo lo grave, ámbar el resto); en el teléfono el tope por
 *   capa baja a lo que cabe; ajustes también como definiciones (búsqueda de ajustes de Obsidian 1.13).
 * v1.30 (19.09.2026): la escena se cachea en dos capas fuera de pantalla y cada cuadro de la animación
 *   solo copia y pinta los pulsos: las 1.100 curvas de un vault real ya no se rasterizan 30 veces por segundo.
 * v1.29.2 (19.09.2026): el estado («largo alcance», «salud») ya no tapa el título de la primera capa;
 *   un rótulo que no cabe a la derecha se dibuja a la izquierda del nodo.
 * v1.29.1 (19.09.2026): el asistente con un vault anidado (wiki/…) muestra las carpetas configuradas
 *   con su cuenta real y ya no ofrece la carpeta madre como «No mostrar».
 * v1.29 (19.09.2026): el móvil, visto en un iPhone real —
 *   · Los botones de zoom ya no quedan bajo la barra de Obsidian en el teléfono.
 *   · Los chips de tema van en una sola fila con desplazamiento cuando no caben.
 *   · Elegir un tema atenúa el resto en vez de esconderlo: se ven los puentes hacia afuera.
 *   · Las tres notas más conectadas de cada capa llevan rótulo permanente.
 * v1.28 (18.09.2026): lo que un usuario tuvo que resolver solo, resuelto en el plugin —
 *   · Exportar datos (JSON con reglas de conteo + CSV de enlaces) para análisis afuera.
 *   · Hub explícito por tema (`hub: true`); solo la hub lleva el nombre del tema, sus hermanas
 *     su título; anillo en la hub; aviso en salud cuando varias notas comparten tema en la última capa.
 *   · «archivos citados» en la cabecera, para no chocar con una capa llamada «Fuentes».
 *   · Recargar ajustes desde data.json (comando y menú); el asistente arranca con la config actual.
 *   · Validación: carpetas sin notas y notas fuera de toda capa se avisan y se cuentan.
 *   · Solo enlaces de largo alcance (dos capas o más): el positivo de los vacíos.
 *   · Baricentro ponderado: las capas lejanas también acomodan el orden vertical (peso 1/distancia).
 *   · Plantillas de capas en el asistente: LLM wiki, profesional, académico, Zettelkasten.
 * v1.27.1 (17.09.2026): al aprobar un resumen, la ficha lo muestra en el acto con su etiqueta.
 * v1.27 (17.09.2026): fuentes por carpetas configurables y bajo demanda. Rutas con tildes y espacios;
 *   ficha de fuente con Abrir, «citada por» y salto a la cita; referencias rotas en salud; buscador
 *   sobre el índice completo; bandeja «fuentes sin vínculo» con contador. Nada de esto asume raw/:
 *   sin carpetas configuradas, el mapa es el de siempre. El interruptor viejo migra a «todas».
 * v1.0 (15.09.2026): el mapa por capas dentro de Obsidian, en vivo y táctil.
 * v1.9 (15.09.2026): interfaz en inglés y español, según el idioma de Obsidian (getLanguage()); los
 *   textos del código están en español y EN los traduce. Una prueba verifica que ninguno quede sin traducir.
 * v1.8 (15.09.2026): elige tu IA — Claude, OpenAI, Gemini o una IA local (Ollama, LM Studio), con la
 *   llave guardada por dispositivo; el panel ya no tapa las columnas.
 * v1.7 (15.09.2026): asistente de capas en el primer uso (detecta carpetas y propone capas) y
 *   «Resumir con Claude» por nota, con citas verificadas, segunda revisión y aprobación (propiedad resumen).
 * v1.6 (15.09.2026): listo para vaults ajenos y para la revisión del directorio — valores por
 *   defecto genéricos, sin APIs privadas, API del vault con normalizePath, sin estilos en línea,
 *   sección de motivos configurable; se quita «Exportar para Artifact» (flujo personal).
 * v1.5 (15.09.2026): el panel muestra la frase real de cada enlace; «Conecta tu IA» (llave propia,
 *   solo en el dispositivo) para ✦ Sugerir motivo con citas literales verificadas por código, segunda
 *   revisión y aprobación humana antes de escribir; registro de auditoría en raw/daily.
 * v1.4 (15.09.2026): ⋯ → Exportar para Artifact (página lista para publicar + instrucción copiada).
 * v1.3 (15.09.2026): el panel EXPLICA (resumen, rol: puente / central / aislada, relaciones en
 *   lenguaje claro, «de dónde salió» compacto) y las líneas se ANIMAN con pulsos en el sentido
 *   en que se compila el conocimiento. Solo con la vista visible; respeta reducir movimiento.
 * v1.2 (15.09.2026): vacíos entre temas (con notas que podrían unirlos), temas colapsables en
 *   supernodos con superenlaces, y vista radial (la nota al centro, anillos por distancia).
 * v1.1 (15.09.2026): deja de estar fijo a un vault —
 *   · Ajustes: carpetas → capas, nombres de capa, propiedad de tema, colores, exclusiones.
 *   · Sigue la nota activa: abrir una nota la enfoca en el mapa.
 *   · Camino entre dos notas: la ruta más corta, con el motivo de cada salto.
 *   · Modo salud: huérfanas, sin tema, enlaces sin motivo — el lint, visual.
 *   · Actividad reciente: resalta lo actualizado en 7 o 30 días (propiedad `updated`).
 *   · Exportar PNG a docs/.
 *   · Menú ⋯ con las herramientas, para que la barra quepa en el celular.
 *
 * Funciona en el iPhone: solo API de Obsidian (nada de Node), sin fuentes externas.
 */
import { Plugin, ItemView, PluginSettingTab, Setting, Modal, Notice, Platform, debounce, requestUrl, normalizePath } from 'obsidian';
import { T } from './i18n.js';
import { leerAjustes, carpetasFuentesDe } from './model/graph.js';
import { GraphStore } from './model/store.js';
import { diagnosticos, vecindades, rutaMasCorta, vacios } from './model/analysis.js';
import { normalizarEstado, aplicarFiltros } from './view/state.js';
import { GraphRenderer } from './view/renderer.js';
import { WorkbenchToolbar } from './ui/toolbar.js';
import { FilterPopover } from './ui/filters.js';
import { InspectorController } from './ui/inspector.js';
import { createInteractionController } from './ui/interaction.js';
import { datosExportables as prepararDatosExportables, exportarVista } from './exports.js';

const VISTA = 'mapa-neuronal';
const MARCA = 'DBB Labs';
// El nombre visible. El id del plugin sigue siendo «mapa-neuronal»: cambiarlo costaría la
// ficha del directorio y las instalaciones. Los nombres de archivo también se dejan quietos.
const NOMBRE = 'Why Graph';
// Fecha LOCAL, no UTC: en Chile, después de las 21:00 toISOString() ya es el día siguiente.
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const AJUSTES_BASE = {
  capas: 'Entrada | notas con fecha\nNotas | el resto del vault',
  carpetas: '',
  propiedadTema: 'tema',
  temas: '',
  excluir: '',
  fuentes: 'demanda', // 'no' | 'demanda' | 'todas'. Antes era booleano: se migra al cargar.
  carpetasFuentes: '',
  seguirActiva: true,
  carpetaExport: 'Mapa neuronal',
  animacion: true,
  proveedorIA: 'claude',
  modeloIA: 'claude-opus-5',
  urlLocal: 'http://localhost:11434/v1/chat/completions',
  dobleVerificacion: true,
  propiedadEnlaces: '',
  propiedadFecha: '',
  carpetaAuditoria: 'Mapa neuronal/aprobaciones',
  seccionMotivos: 'Conexiones',
  configurado: false,
  ordenCapas: 'auto',
  profundidadRadial: 2,
  temaVisual: 'tema',
  mostrarLeyenda: true,
  mostrarAyuda: false,
  maxPorCapa: 150,
  vistasGuardadas: {},
  ultimaVista: null,
};

const NOMBRE_VISTA_MAX = 60;
const MAX_VISTAS = 12;
const TIEMPO_VISTA = (valor, defecto) => Number.isFinite(Number(valor)) && Number(valor) >= 0 ? Number(valor) : defecto;
const ENTERO_AJUSTE = (valor, defecto, minimo, maximo, paso = 1) => {
  if (valor == null || valor === '' || typeof valor === 'boolean') return defecto;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return defecto;
  return Math.max(minimo, Math.min(maximo, Math.round(numero / paso) * paso));
};

/** Normaliza el contenido persistido sin crear un segundo almacén de ajustes. */
function normalizarVistasGuardadas(valor, ahora = Date.now()) {
  const salida = Object.create(null);
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return salida;
  const marca = Number.isFinite(Number(ahora)) ? Number(ahora) : Date.now();
  const candidatos = [];
  Object.entries(valor).forEach(([clave, registro], indice) => {
    const nombre = String(clave).trim().slice(0, NOMBRE_VISTA_MAX);
    if (!nombre || !registro || typeof registro !== 'object' || Array.isArray(registro)) return;
    const creada = TIEMPO_VISTA(registro.creada, marca);
    const actualizada = Math.max(creada, TIEMPO_VISTA(registro.actualizada, creada));
    candidatos.push({ nombre, indice, creada, actualizada, estado: normalizarEstado(registro.estado) });
  });
  candidatos.sort((a, b) => b.actualizada - a.actualizada || a.creada - b.creada || a.indice - b.indice);
  const vistos = new Set();
  for (const candidato of candidatos) {
    const clave = candidato.nombre.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida[candidato.nombre] = { estado: candidato.estado, creada: candidato.creada, actualizada: candidato.actualizada };
    if (Object.keys(salida).length === MAX_VISTAS) break;
  }
  return salida;
}

function normalizarAjustes(guardado) {
  const ajustes = Object.assign({}, AJUSTES_BASE, guardado && typeof guardado === 'object' ? guardado : {});
  const orden = ['auto', 'alfabetico', 'reciente'].includes(String(ajustes.ordenCapas || '').trim().toLowerCase())
    ? String(ajustes.ordenCapas).trim().toLowerCase() : AJUSTES_BASE.ordenCapas;
  ajustes.ordenCapas = orden;
  ajustes.profundidadRadial = ENTERO_AJUSTE(ajustes.profundidadRadial, AJUSTES_BASE.profundidadRadial, 1, 4);
  ajustes.temaVisual = ajustes.temaVisual === 'noche' ? 'noche' : AJUSTES_BASE.temaVisual;
  ajustes.mostrarLeyenda = typeof ajustes.mostrarLeyenda === 'boolean' ? ajustes.mostrarLeyenda : AJUSTES_BASE.mostrarLeyenda;
  ajustes.mostrarAyuda = typeof ajustes.mostrarAyuda === 'boolean' ? ajustes.mostrarAyuda : AJUSTES_BASE.mostrarAyuda;
  ajustes.maxPorCapa = ENTERO_AJUSTE(ajustes.maxPorCapa, AJUSTES_BASE.maxPorCapa, 30, 600, 10);
  delete ajustes.vistasGuardados;
  ajustes.vistasGuardadas = normalizarVistasGuardadas(ajustes.vistasGuardadas);
  const ultima = typeof ajustes.ultimaVista === 'string' ? ajustes.ultimaVista.trim().slice(0, NOMBRE_VISTA_MAX).toLowerCase() : '';
  ajustes.ultimaVista = Object.keys(ajustes.vistasGuardadas).find((nombre) => nombre.toLowerCase() === ultima) || null;
  return ajustes;
}
// Las llaves viven en el localStorage del vault (por dispositivo): NO viajan por Sync ni por git.
const CLAVE_IA = (proveedor) => `mapa-neuronal-key-${proveedor}`;
const PROVEEDORES = {
  claude: { nombre: 'Claude (Anthropic)', url: 'https://api.anthropic.com/v1/messages', llave: true, ayuda: 'Crea la llave en console.anthropic.com, sección API keys. Una suscripción de Claude (Pro o Max) no sirve: la API se paga por uso.', modeloAyuda: 'claude-opus-5 es el más preciso (97,7 % en nuestra prueba). claude-sonnet-5 y claude-haiku-4-5 son más baratos.', modelo: 'claude-opus-5' },
  openai: { nombre: 'OpenAI (ChatGPT)', url: 'https://api.openai.com/v1/chat/completions', llave: true, ayuda: 'Crea la llave en platform.openai.com. Una suscripción de ChatGPT no sirve: la API se paga por uso.', modeloAyuda: 'Escribe el identificador del modelo, como aparece en la documentación de OpenAI.', modelo: '' },
  gemini: { nombre: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/models', llave: true, ayuda: 'Crea la llave en aistudio.google.com. Tiene una capa gratuita con límites de uso.', modeloAyuda: 'Escribe el identificador del modelo, como aparece en la documentación de Gemini.', modelo: '' },
  local: { nombre: 'IA local (Ollama, LM Studio)', url: 'http://localhost:11434/v1/chat/completions', llave: false, ayuda: 'Gratis y sin enviar tus notas a internet. Necesitas Ollama o LM Studio corriendo en este computador. No funciona en el celular.', modeloAyuda: 'El nombre del modelo que descargaste, por ejemplo el que muestra «ollama list».', modelo: '' },
};

// ── Asistente de capas: el primer uso en un vault cualquiera ─────────────────
const CAPAS_ESTANDAR = [
  ['Entrada', 'notas diarias, fuentes y capturas'],
  ['Entidades', 'proyectos, personas y clientes'],
  ['Conocimiento', 'ideas, referencias y aprendizajes'],
  ['Temas', 'síntesis y mapas de contenido'],
];
const PISTAS = [
  [0, ['daily', 'diario', 'diarias', 'journal', 'inbox', 'bandeja', 'fuente', 'source', 'clipping', 'raw', 'captura', 'periodic', 'reunion', 'meeting', 'log', 'bitacora']],
  [1, ['people', 'persona', 'contact', 'client', 'cliente', 'project', 'proyecto', 'compan', 'empresa', 'entidad', 'entit', 'org']],
  [3, ['topic', 'tema', 'moc', 'map', 'indice', 'index', 'area', 'hub']],
  [-1, ['template', 'plantilla', 'attachment', 'adjunto', 'asset', 'archive', 'archivo', 'excalidraw', 'trash', 'papelera']],
];
function sinAcentos(t) { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function sugerirCapa(nombre) {
  const n = sinAcentos(nombre.split('/').pop());
  for (const [capa, claves] of PISTAS) if (claves.some((k) => n.includes(k))) return capa;
  return 2;
}
function detectarCarpetas(app) {
  const archivos = app.vault.getMarkdownFiles(), total = archivos.length || 1, top = {}, sub = {};
  for (const f of archivos) {
    const partes = f.path.split('/');
    const t = partes.length === 1 ? '/' : partes[0];
    top[t] = (top[t] || 0) + 1;
    if (partes.length > 2) { const k = partes.slice(0, 2).join('/'); sub[k] = (sub[k] || 0) + 1; }
    else if (partes.length === 2) { const k = partes[0] + '/·'; sub[k] = (sub[k] || 0) + 1; }
  }
  let lista = [];
  for (const [t, c] of Object.entries(top)) {
    const hijas = Object.entries(sub).filter(([k]) => k.startsWith(t + '/') && !k.endsWith('/·'));
    if (t !== '/' && c / total > 0.6 && hijas.length >= 2) {
      for (const [k, ch] of hijas) lista.push([k, ch]);
      const sueltas = sub[t + '/·']; if (sueltas) lista.push([t, sueltas]);
    } else lista.push([t, c]);
  }
  return lista.sort((a, b) => b[1] - a[1]).slice(0, 40).map(([carpeta, notas]) => ({ carpeta, notas, capa: carpeta === '/' ? 2 : sugerirCapa(carpeta) }));
}
// Carpetas candidatas a fuentes: tienen archivos que no son notas, o su nombre lo dice. Solo se proponen.
function detectarFuentes(app) {
  const todos = (app.vault.getFiles ? app.vault.getFiles() : []).map((f) => f.path);
  const top = {};
  for (const r of todos) { const partes = r.split('/'); if (partes.length < 2) continue; const t = partes[0]; top[t] = top[t] || { archivos: 0, noNotas: 0 }; top[t].archivos++; if (!r.endsWith('.md')) top[t].noNotas++; }
  const pista = (t) => ['raw', 'source', 'fuente', 'clipping', 'captura'].some((k) => sinAcentos(t).includes(k));
  return Object.entries(top).filter(([t, c]) => c.noNotas > 0 || pista(t)).map(([t, c]) => ({ carpeta: t, archivos: c.archivos })).sort((a, b) => b.archivos - a.archivos).slice(0, 6);
}
// «carpeta/*» conviene cuando la carpeta se organiza en subcarpetas con fecha (un día por carpeta).
function subcarpetasFechadas(app, carpeta) {
  const todos = (app.vault.getFiles ? app.vault.getFiles() : []).map((f) => f.path).filter((r) => r.startsWith(carpeta + '/'));
  const subs = new Set(todos.map((r) => r.slice(carpeta.length + 1).split('/')).filter((p) => p.length > 1).map((p) => p[0]));
  return subs.size >= 2 && [...subs].every((s) => /^\d{4}-\d{2}(-\d{2})?/.test(s));
}
function esLlmWiki(app) {
  return !!(app.vault.getFileByPath('index.md') && app.vault.getFileByPath('log.md'));
}
// Plantillas de capas por tipo de vault. La primera es la de siempre (CAPAS_ESTANDAR); la
// profesional salió de un vault jurídico-contable real que un usuario armó a mano con cinco capas.
const PLANTILLAS = [
  ['llm', 'LLM wiki', CAPAS_ESTANDAR],
  ['profesional', 'Profesional (jurídico, contable)', [['Conceptos', 'definiciones canónicas'], ['Entidades', 'quién dicta, fiscaliza, autoriza'], ['Fuentes', 'leyes, circulares, manuales'], ['Aplicación', 'guías, servicios, proyectos'], ['Temas', 'hubs de dominio']]],
  ['academico', 'Académico', [['Lecturas', 'papers y libros'], ['Notas de lectura', 'lo que subrayaste'], ['Conceptos', 'ideas con nombre propio'], ['Síntesis', 'ensayos y revisiones']]],
  ['zettel', 'Zettelkasten', [['Fugaces', 'capturas rápidas'], ['Literatura', 'notas de lo leído'], ['Permanentes', 'ideas propias, una por nota'], ['Estructura', 'índices y mapas']]],
];
// Las capas que el usuario ya tiene, como plantilla «actual»: así el asistente sirve también
// como editor permanente y no solo para el primer uso. Los nombres son suyos: no se traducen.
function plantillaActual(aj) {
  if (!aj.carpetas.trim()) return null;
  const capas = aj.capas.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map((x) => [x[0], x[1] || '']);
  return capas.length ? ['actual', null, capas] : null;
}

class AsistenteCapas extends Modal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    const { contentEl: c } = this; c.empty(); c.addClass('mn-asistente');
    this.setTitle(T('Organiza tu mapa en capas'));
    c.createEl('p', { text: T('El mapa ordena tus notas de izquierda a derecha, de lo que entra a lo que se sintetiza. Revisa en qué capa va cada carpeta; ya propusimos una según su nombre.') });
    const filas = detectarCarpetas(this.app);
    if (!filas.length) { c.createEl('p', { text: T('Tu vault todavía no tiene notas.') }); return; }
    // Carpetas de fuentes: se proponen las que tienen archivos que no son notas (PDF, capturas) o
    // cuyo nombre lo sugiere; el usuario confirma. Nada se asume por el nombre solo.
    const propuestas = detectarFuentes(this.app);
    for (const f of propuestas) if (!filas.some((x) => x.carpeta === f.carpeta)) filas.push({ carpeta: f.carpeta, notas: f.archivos, capa: -2, archivos: true });
    for (const fila of filas) if (propuestas.some((f) => f.carpeta === fila.carpeta) && fila.capa === 0) fila.capa = -2;
    // Config existente: cada carpeta arranca en la capa que ya tiene, y las carpetas configuradas
    // que la detección no propuso se agregan igual.
    const actual = plantillaActual(this.plugin.ajustes);
    const plantillas = actual ? [actual, ...PLANTILLAS] : PLANTILLAS;
    this.plantilla = actual ? 'actual' : 'llm';
    if (actual) {
      const cfg = leerAjustes(this.plugin.ajustes), fuentesCfg = carpetasFuentesDe(this.plugin.ajustes).map((x) => x.ruta);
      // [1.29.1] Las carpetas configuradas que la detección no separó (wiki/personas dentro
      // de «wiki») se agregan con su cuenta real, y a la carpeta madre se le restan: si queda
      // en cero, desaparece. Antes salía «wiki · 148 notas · No mostrar» y cada hija con 0.
      const archivos = this.app.vault.getMarkdownFiles();
      const cuenta = (c) => archivos.filter((f) => f.path === c || f.path.startsWith(c + '/')).length;
      for (const [carpeta, n] of cfg.carpetas) {
        const fila = filas.find((f) => f.carpeta === carpeta);
        if (fila) { fila.capa = n; continue; }
        const notas = cuenta(carpeta);
        for (const f of filas) if (f.carpeta !== '/' && carpeta.startsWith(f.carpeta + '/')) f.notas = Math.max(0, f.notas - notas);
        filas.push({ carpeta, notas, capa: n });
      }
      for (let i = filas.length - 1; i >= 0; i--) if (filas[i].notas === 0 && !filas[i].archivos && !cfg.carpetas.some(([c]) => c === filas[i].carpeta)) filas.splice(i, 1);
      filas.sort((a, b) => a.carpeta.localeCompare(b.carpeta));
      for (const carpeta of fuentesCfg) { const fila = filas.find((f) => f.carpeta === carpeta); if (fila) fila.capa = -2; }
      for (const fila of filas) if (!cfg.carpetas.some(([c]) => c === fila.carpeta) && !fuentesCfg.includes(fila.carpeta) && fila.capa >= 0) fila.capa = -1;
      c.createEl('p', { cls: 'setting-item-description', text: T('La capa actual de cada carpeta ya viene marcada.') });
    }
    const capasDe = () => plantillas.find((p) => p[0] === this.plantilla)[2];
    new Setting(c).setName(T('Plantilla de capas')).addDropdown((d) => {
      d.addOptions(Object.fromEntries(plantillas.map(([id, nombre, capas]) => [id, nombre ? T(nombre) : T('Mis capas actuales') + ': ' + capas.map((x) => x[0]).join(' → ')]))).setValue(this.plantilla)
        .onChange((v) => { this.plantilla = v; const n = capasDe().length; for (const f of filas) if (f.capa >= n) f.capa = n - 1; pintarFilas(); });
    });
    const cuerpo = c.createDiv();
    const pintarFilas = () => {
      cuerpo.empty();
      const capas = capasDe(), traducir = this.plantilla !== 'actual';
      const opciones = Object.fromEntries(capas.map((x, i) => [String(i), traducir ? T(x[0]) : x[0]]));
      opciones['-2'] = T('Fuentes citadas por ruta'); opciones['-1'] = T('No mostrar');
      for (const fila of filas) {
        new Setting(cuerpo).setName(fila.carpeta === '/' ? T('Notas en la raíz del vault') : fila.carpeta).setDesc(fila.archivos ? T('{0} archivo(s)', fila.notas) : T(fila.notas === 1 ? '{0} nota' : '{0} notas', fila.notas))
          .addDropdown((d) => d.addOptions(opciones).setValue(String(fila.capa)).onChange((v) => { fila.capa = Number(v); }));
      }
    };
    pintarFilas();
    if (esLlmWiki(this.app) && propuestas.length) c.createEl('p', { cls: 'setting-item-description', text: T('Detecté un LLM wiki (index.md y log.md con entradas fechadas): las carpetas marcadas como fuentes se mostrarán bajo demanda.') });
    new Setting(c)
      .addButton((b) => b.setButtonText(T('Ahora no')).onClick(async () => { this.plugin.ajustes.configurado = true; await this.plugin.guardar(); this.close(); }))
      .addButton((b) => b.setButtonText(T('Aplicar')).setCta().onClick(() => this.aplicar(filas, capasDe(), this.plantilla !== 'actual')));
  }
  async aplicar(filas, capasPlantilla = CAPAS_ESTANDAR, traducir = true) {
    const usadas = [...new Set(filas.filter((f) => f.capa >= 0).map((f) => f.capa))].sort((a, b) => a - b);
    if (!usadas.length) { new Notice(T('Elige al menos una carpeta para mostrar')); return; }
    const indice = Object.fromEntries(usadas.map((capa, i) => [capa, i]));
    const aj = this.plugin.ajustes;
    aj.capas = usadas.map((capa) => capasPlantilla[capa].map((x) => (traducir ? T(x) : x)).join(' | ')).join('\n');
    aj.carpetas = filas.filter((f) => f.capa >= 0).map((f) => `${f.carpeta} = ${indice[f.capa]}`).join('\n');
    const fuentes = filas.filter((f) => f.capa === -2);
    if (fuentes.length) { aj.carpetasFuentes = fuentes.map((f) => f.carpeta + (subcarpetasFechadas(this.app, f.carpeta) ? '/*' : '')).join('\n'); if (aj.fuentes === 'no') aj.fuentes = 'demanda'; }
    aj.configurado = true;
    await this.plugin.guardar();
    this.close();
    this.plugin.refrescarVistas();
    new Notice(T('Capas aplicadas. Puedes ajustarlas en la configuración del plugin.'));
  }
  onClose() { this.contentEl.empty(); }
}

class VistaMapa extends ItemView {
  constructor(hoja, plugin) {
    super(hoja);
    this.plugin = plugin;
    this.store = plugin.store && typeof plugin.store.rebuild === 'function' ? plugin.store : new GraphStore();
    this.datos = { nodos: [], aristas: [], capas: [], temas: {} };
    this.estado = normalizarEstado();
    this.seleccionArista = null;
    this.eligiendo = null;
    this.cerrada = false;
    this.animacion = null;
  }

  getViewType() { return VISTA; }
  getDisplayText() { return NOMBRE; }
  getIcon() { return 'brain-circuit'; }

  getState() { return normalizarEstado(this.estado, { datos: this.datos }); }

  aplicarAjustesVisual() {
    const tema = this.plugin.ajustes.temaVisual === 'noche' ? 'noche' : 'tema';
    this.estado.temaVisual = tema;
    this.contentEl?.setAttribute?.('data-mn-theme', tema);
    if (this.leyenda) this.leyenda.hidden = this.plugin.ajustes.mostrarLeyenda === false;
    if (this.ayuda && this.workbenchToolbar) {
      this.ayuda.hidden = this.plugin.ajustes.mostrarAyuda !== true;
      this.ayuda.open = this.plugin.ajustes.mostrarAyuda === true;
      this.workbenchToolbar.helpButton.setAttribute('aria-expanded', this.plugin.ajustes.mostrarAyuda === true ? 'true' : 'false');
    }
    this.adoptarEstado(this.estado);
  }

  async setState(state, result) {
    if (result !== undefined && result !== null) await this.recargar(result);
    this.estado = normalizarEstado(state, { datos: this.datos });
    this.seleccionArista = null;
    this.eligiendo = null;
    this.adoptarEstado(this.estado);
    return this.getState();
  }

  async onOpen() {
    this.cerrada = false;
    const raiz = this.contentEl;
    raiz.empty();
    raiz.addClass('mn-raiz');
    this.estado = normalizarEstado(this.estado, { datos: this.datos });
    this.estado.temaVisual = this.plugin.ajustes.temaVisual === 'noche' ? 'noche' : 'tema';
    raiz.setAttribute('data-mn-theme', this.estado.temaVisual);

    const escena = raiz.createDiv('mn-workbench-scene');
    this.lienzo = escena.createEl('canvas', { cls: 'mn-lienzo' });
    this.ctx = this.lienzo.getContext('2d');
    const documento = this.lienzo.ownerDocument || raiz.ownerDocument || globalThis.document;
    const stateForRenderer = this.rendererState();
    this.renderer = new GraphRenderer(this.lienzo, {
      medirTexto: (text, font) => {
        if (!this.ctx || typeof this.ctx.measureText !== 'function') return { width: String(text).length * 6.5 };
        this.ctx.font = font || '12px system-ui, sans-serif';
        return this.ctx.measureText(String(text));
      },
      preferencias: {
        ordenCapas: this.plugin.ajustes.ordenCapas,
        profundidadRadial: this.plugin.ajustes.profundidadRadial,
        mobile: Platform.isPhone,
        pointerDown: false,
        wheelUntil: 0,
      },
    });
    this.renderer.setViewport({ width: this.viewportSize().width, height: this.viewportSize().height, dpr: window.devicePixelRatio || 1 });
    this.renderer.setGraph(this.datos, stateForRenderer);

    this.workbenchToolbar = new WorkbenchToolbar({
      container: raiz,
      document: documento,
      datos: this.datos,
      state: this.estado,
      callbacks: {
        onMode: (modo) => this.cambiarModo(modo),
        onFilter: () => this.workbenchFilters.toggle(),
        onSaveView: () => this.guardarVista(),
        onRestoreView: () => this.restaurarVista(),
        onHealth: () => this.accionSalud(),
        onGaps: () => this.accionVacios(),
        onTable: () => this.accionTabla(),
        onExport: () => this.exportar(),
        onHelp: () => this.alternarAyuda(),
      },
    });
    const ayudaInicial = this.plugin.ajustes.mostrarAyuda === true;
    this.workbenchToolbar.helpButton.setAttribute('aria-expanded', ayudaInicial ? 'true' : 'false');
    this.ayuda = raiz.createEl('details', { cls: 'mn-workbench-help' });
    this.ayuda.createEl('summary', { text: T('Ayuda') });
    this.ayuda.createEl('p', { text: T('Cada línea es un enlace real. Selecciona una nota o un enlace para leer por qué se conecta. Usa Tab para moverte entre los controles y el mapa.') });
    this.ayuda.hidden = !ayudaInicial;
    this.ayuda.open = ayudaInicial;
    this.leyenda = escena.createEl('section', { cls: 'mn-workbench-legend', attr: { 'aria-label': T('Leyenda del mapa') } });
    const marcas = this.leyenda.createEl('ul');
    for (const [clase, etiqueta] of [['', T('Nota')], ['mn-mark-source', T('Fuente')], ['mn-mark-super', T('Supernodo')], ['mn-mark-health', T('Con problemas')]]) {
      const item = marcas.createEl('li');
      item.createSpan({ cls: `mn-legend-mark ${clase}`.trim(), attr: { 'aria-hidden': 'true' } });
      item.createSpan({ text: etiqueta });
    }
    this.leyenda.hidden = this.plugin.ajustes.mostrarLeyenda === false;
    this.workbenchFilters = new FilterPopover({
      container: raiz,
      document: documento,
      datos: this.datos,
      state: this.estado,
      sourceMode: this.plugin.ajustes.fuentes,
      callbacks: {
        onChange: (estado, result) => this.adoptarEstado(estado, result),
        onSourceMode: async (fuentes) => {
          this.plugin.ajustes.fuentes = fuentes;
          await this.plugin.guardar();
          await this.recargar();
        },
      },
    });
    this.inspectorWorkbench = new InspectorController({
      container: escena,
      document: documento,
      datos: this.datos,
      state: this.estado,
      mobile: Platform.isPhone,
      callbacks: this.inspectorCallbacks(),
    });
    this.interaccion = createInteractionController(this.lienzo, this.renderer, {
      document: documento,
      datos: this.datos,
      estado: this.estado,
      searchInput: this.workbenchToolbar.searchInput,
      onSelect: (id, tipo) => this.seleccionar(id, tipo),
      onOpen: (id, tipo) => this.abrirSeleccion(id, tipo),
      onCenter: (id) => this.enfocar(id, true),
      onFit: () => this.encuadrar(),
      onSearch: (filtro) => { this.estado.filtro = filtro; this.adoptarEstado(this.estado); },
      onPan: ({ camera }) => { this.estado.camara = { ...camera }; this.adoptarEstado(this.estado); },
      onZoom: (k) => { this.estado.camara.k = k; this.adoptarEstado(this.estado); },
      onLongPress: (id, tipo) => {
        const nodo = this.datos.nodos.find((n) => n.id === id);
        if (tipo === 'nodo' && nodo?.tema) this.alternarColapso(nodo.tema);
      },
    });

    const resize = () => {
      const size = this.viewportSize();
      this.renderer.setViewport({ width: size.width, height: size.height, dpr: window.devicePixelRatio || 1 });
      this.inspectorWorkbench.setMobile(size.width < 640 || Platform.isPhone);
      this.adoptarEstado(this.estado);
    };
    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    this.resizeObserver?.observe(raiz);
    this.registerEvent(this.app.workspace.on('file-open', (file) => {
      if (!this.plugin.ajustes.seguirActiva || !file || this.eligiendo) return;
      const id = this.datos.nodos.some((node) => node.id === file.path) ? file.path : file.path;
      if (this.datos.nodos.some((node) => node.id === id)) this.enfocar(id, true);
    }));
    await this.recargar();
    this.encuadrar();
    this.renderNow();
    this.iniciarAnimacion();
    if (!this.plugin.ajustes.configurado && !this.plugin.ajustes.carpetas.trim()) new AsistenteCapas(this.app, this.plugin).open();
  }

  debeAnimar() {
    return this.plugin.ajustes.animacion && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      && document.visibilityState === 'visible' && this.contentEl.isShown?.() !== false;
  }

  iniciarAnimacion() {
    if (this.animacion) return;
    const intervalo = Platform.isMobile ? 50 : 33;
    const paso = (tiempo) => {
      this.animacion = window.requestAnimationFrame(paso);
      if (!this.debeAnimar() || tiempo - (this.ultimoCuadro || 0) < intervalo) return;
      this.ultimoCuadro = tiempo;
      this.tiempo = tiempo;
      this.renderNow();
    };
    this.animacion = window.requestAnimationFrame(paso);
  }

  async onClose() {
    this.cerrada = true;
    this.resizeObserver?.disconnect();
    this.interaccion?.destroy();
    this.renderer?.destroy();
    this.workbenchToolbar?.destroy();
    this.workbenchFilters?.destroy();
    this.inspectorWorkbench?.destroy();
    if (this.animacion) window.cancelAnimationFrame(this.animacion);
    this.animacion = null;
  }

  viewportSize() {
    const scene = this.lienzo?.parentNode || this.contentEl;
    const rect = scene?.getBoundingClientRect?.() || { width: 1, height: 1 };
    return { width: Math.max(1, Number(rect.width) || 1), height: Math.max(1, Number(rect.height) || 1) };
  }

  rendererState() {
    const edge = this.seleccionArista ? this.datos.aristas.find((item) => JSON.stringify([item[0], item[1]].sort()) === this.seleccionArista) : null;
    return {
      ...this.getState(),
      foco: this.estado.seleccion,
      reservaPanel: Number(this.inspectorWorkbench?.width) || 0,
      visibles: this.visibles,
      ruta: edge ? [edge[0], edge[1]] : this.estado.ruta,
      salud: this.estado.panel === 'salud',
    };
  }

  async recargar(result) {
    const adoptable = result && typeof result === 'object' && Array.isArray(result.nodos) && Array.isArray(result.aristas) && Array.isArray(result.capas) && result.temas && typeof result.temas === 'object';
    this.datos = adoptable ? result : await this.store.rebuild(this.app, this.plugin.ajustes);
    this.estado = normalizarEstado(this.estado, { datos: this.datos });
    this.seleccionArista = null;
    if (this.estado.seleccion && !this.datos.nodos.some((n) => n.id === this.estado.seleccion)) this.estado.seleccion = null;
    this.estado.ruta = this.estado.ruta.filter((id) => this.datos.nodos.some((n) => n.id === id));
    if (this.estado.panel === 'salud' || this.estado.panel === 'vacios' || this.estado.panel === 'tabla') this.estado.panel = null;
    this.workbenchToolbar?.setGraph(this.datos);
    this.workbenchFilters?.setGraph(this.datos);
    this.inspectorWorkbench?.setGraph(this.datos);
    this.adoptarEstado(this.estado);
  }

  adoptarEstado(estadoInicial, resultado = null) {
    const estado = normalizarEstado(estadoInicial || {}, { datos: this.datos });
    this.estado = estado;
    const filtrado = resultado || aplicarFiltros(this.datos, estado);
    this.visibles = new Set(filtrado.visibles);
    if (this.plugin.ajustes.fuentes === 'demanda') {
      const selected = estado.seleccion;
      const vecinos = selected ? new Set(vecindades(this.datos, selected, 1).ids) : new Set();
      for (const node of this.datos.nodos) if (node.fuente && node.id !== selected && !vecinos.has(node.id)) this.visibles.delete(node.id);
    }
    this.workbenchToolbar?.setState(estado, filtrado);
    this.workbenchFilters?.setState(estado);
    this.workbenchFilters?.setSourceMode(this.plugin.ajustes.fuentes);
    this.interaccion?.setGraph(this.datos, estado);
    this.renderer?.setGraph(this.datos, this.rendererState());
    this.inspectorWorkbench?.update(this.datos, estado, {
      selectionId: this.seleccionArista || estado.seleccion,
      selectionType: this.seleccionArista ? 'arista' : 'nodo',
      diagnostics: diagnosticos(this.datos),
      gaps: vacios(this.datos),
      tableMode: estado.panel === 'tabla',
    });
    this.renderNow();
    return estado;
  }
  renderNow() {
    if (!this.cerrada) this.renderer?.render(this.tiempo);
  }

  render() { this.renderNow(); }

  cambiarModo(modo) {
    if (modo === 'radial' && !this.estado.seleccion) { new Notice(T('Toca una nota para ponerla al centro')); return; }
    this.estado.modo = modo === 'radial' ? 'radial' : 'capas';
    this.adoptarEstado(this.estado);
    this.encuadrar();
  }

  enfocar(id, centrar = false) {
    if (!this.datos.nodos.some((n) => n.id === id)) return;
    this.estado.seleccion = id;
    this.estado.panel = 'nota';
    this.estado.ruta = [];
    this.seleccionArista = null;
    this.eligiendo = null;
    if (centrar && this.estado.modo === 'radial') this.encuadrar();
    this.adoptarEstado(this.estado);
    if (centrar && this.estado.modo !== 'radial' && this.renderer?.scene) {
      const node = this.renderer.scene.nodes.find((item) => item.id === id);
      const size = this.viewportSize();
      if (node) {
        this.estado.camara.x = size.width * 0.42 - node.x * this.estado.camara.k;
        this.estado.camara.y = size.height * 0.5 - node.y * this.estado.camara.k;
        this.adoptarEstado(this.estado);
      }
    }
  }

  seleccionar(id, tipo = 'nodo') {
    if (!id) {
      this.seleccionArista = null;
      this.eligiendo = null;
      this.estado.seleccion = null;
      this.estado.ruta = [];
      this.estado.panel = null;
      this.adoptarEstado(this.estado);
      return;
    }
    if (tipo === 'arista') {
      this.seleccionArista = String(id);
      this.estado.seleccion = null;
      this.estado.panel = 'nota';
      this.inspectorWorkbench?.setTransientSelection(this.seleccionArista, 'arista');
      this.adoptarEstado(this.estado);
      return;
    }
    if (this.eligiendo) {
      if (!this.eligiendo.desde) {
        this.eligiendo.desde = id;
        this.estado.seleccion = id;
        this.estado.panel = 'nota';
        new Notice(T('Ahora toca la nota de destino'));
      } else {
        const ruta = rutaMasCorta(this.datos, this.eligiendo.desde, id);
        this.eligiendo = null;
        this.estado.ruta = ruta || [];
        this.estado.seleccion = ruta ? null : id;
        this.estado.panel = ruta ? null : 'nota';
        if (!ruta) new Notice(T('No hay camino entre esas dos notas'));
      }
      this.adoptarEstado(this.estado);
      return;
    }
    this.seleccionArista = null;
    this.enfocar(id, false);
  }
  encuadrar() {
    const size = this.viewportSize();
    const scene = this.renderer?.scene;
    if (!scene) return;
    const b = scene.bounds || { minX: 0, minY: 0, maxX: size.width, maxY: size.height };
    const reserve = Number(this.inspectorWorkbench?.width) || 0;
    const width = Math.max(1, size.width - (Platform.isPhone ? 0 : reserve));
    const height = Math.max(1, size.height);
    const spanX = Math.max(1, b.maxX - b.minX), spanY = Math.max(1, b.maxY - b.minY);
    const k = Math.max(0.3, Math.min(6, Math.min(width / (spanX + 80), height / (spanY + 80))));
    this.estado.camara = { x: width / 2 - ((b.minX + b.maxX) / 2) * k, y: height / 2 - ((b.minY + b.maxY) / 2) * k, k };
    this.adoptarEstado(this.estado);
  }


  alternarColapso(tema) {
    const colapsados = new Set(this.estado.colapsados);
    if (colapsados.has(tema)) colapsados.delete(tema); else colapsados.add(tema);
    this.estado.colapsados = [...colapsados];
    this.estado.ruta = [];
    this.adoptarEstado(this.estado);
  }

  async guardarVista() {
    const nombre = window.prompt(T('Escribe un nombre para la vista guardada'), '');
    if (nombre !== null) await this.plugin.guardarVista(nombre, this.getState());
  }

  async restaurarVista() {
    const guardadas = Object.keys(this.plugin.ajustes.vistasGuardadas || {});
    const nombre = this.plugin.ajustes.ultimaVista || guardadas[0] || window.prompt(T('Escribe el nombre de la vista guardada'), '');
    if (nombre) await this.plugin.restaurarVista(nombre);
  }

  accionSalud() {
    this.estado.panel = this.estado.panel === 'salud' ? null : 'salud';
    this.adoptarEstado(this.estado);
  }

  accionVacios() {
    this.estado.panel = this.estado.panel === 'vacios' ? null : 'vacios';
    this.adoptarEstado(this.estado);
  }

  accionTabla() {
    this.estado.panel = this.estado.panel === 'tabla' ? null : 'tabla';
    this.adoptarEstado(this.estado);
  }

  alternarAyuda() {
    const visible = this.ayuda.hidden;
    this.ayuda.hidden = !visible;
    this.ayuda.open = visible;
    this.workbenchToolbar.helpButton.setAttribute('aria-expanded', visible ? 'true' : 'false');
  }

  inspectorCallbacks() {
    return {
      onClose: () => this.seleccionar(null),
      onSelect: (id, tipo) => this.seleccionar(id, tipo),
      onOpen: (id) => this.abrirSeleccion(id),
      onRadial: (id) => { this.estado.seleccion = id; this.cambiarModo('radial'); },
      onPath: (id) => { this.eligiendo = { desde: id }; this.estado.seleccion = id; this.adoptarEstado(this.estado); new Notice(T('Toca la nota de destino')); },
      onCollapse: (tema) => this.alternarColapso(tema),
      onSummarize: (id) => this.proponerResumen(this.datos.nodos.find((n) => n.id === id)),
      onSuggestReason: (fr) => this.sugerirMotivo(fr),
      onTable: () => this.accionTabla(),
      onHealth: () => this.accionSalud(),
      onGaps: () => this.accionVacios(),

      onGapFocus: (candidate) => { this.estado.ruta = [candidate.a, candidate.b]; this.estado.seleccion = null; this.estado.panel = null; this.adoptarEstado(this.estado); },
    };
  }

  onPaneMenu(menu, origen) {
    if (origen === 'more-options') { this.llenarHerramientas(menu); menu.addSeparator(); }
    super.onPaneMenu(menu, origen);
  }

  llenarHerramientas(menu) {
    const estado = this.getState();
    menu.addItem((item) => item.setTitle(T('Camino entre dos notas')).setIcon('route').onClick(() => {
      this.eligiendo = { desde: null };
      this.estado.ruta = [];
      this.adoptarEstado(this.estado);
      new Notice(T('Toca la nota de origen'));
    }));
    menu.addItem((item) => item.setTitle(estado.modo === 'radial' ? T('Volver a la vista por capas') : T('Vista radial (la nota al centro)')).setIcon('orbit').onClick(() => this.cambiarModo(estado.modo === 'radial' ? 'capas' : 'radial')));
    menu.addItem((item) => item.setTitle(estado.panel === 'vacios' ? T('Ocultar vacíos entre temas') : T('Vacíos entre temas')).setIcon('unlink').onClick(() => this.accionVacios()));
    menu.addItem((item) => item.setTitle(estado.panel === 'salud' ? T('Quitar modo salud') : T('Modo salud')).setIcon('heart-pulse').onClick(() => this.accionSalud()));
    menu.addSeparator();
    for (const [id, definition] of Object.entries(this.datos.temas || {})) {
      if (!this.datos.nodos.some((n) => n.tema === id)) continue;
      menu.addItem((item) => item.setTitle(T('{0} {1}', estado.colapsados.includes(id) ? T('Expandir') : T('Colapsar'), definition[0] || id)).setIcon(estado.colapsados.includes(id) ? 'maximize-2' : 'minimize-2').onClick(() => this.alternarColapso(id)));
    }
    menu.addSeparator();
    menu.addItem((item) => item.setTitle(T('Exportar imagen (PNG)')).setIcon('image-down').onClick(() => this.exportar()));
    menu.addItem((item) => item.setTitle(T('Exportar datos (JSON y CSV)')).setIcon('file-json').onClick(() => this.exportarDatos()));
    menu.addItem((item) => item.setTitle(T('Recargar el mapa')).setIcon('refresh-cw').onClick(() => this.recargar()));
    menu.addItem((item) => item.setTitle(T('Recargar ajustes desde data.json')).setIcon('file-cog').onClick(() => this.plugin.recargarAjustes()));
    menu.addItem((item) => item.setTitle(T('Asistente de capas')).setIcon('layers').onClick(() => new AsistenteCapas(this.app, this.plugin).open()));
  }

  async proponerResumen(nodo) {
    if (!nodo?.ruta) return;
    const zona = this.inspectorWorkbench.content.createDiv('mn-ia');
    zona.createDiv({ cls: 'mn-ia-estado', text: T('Leyendo la nota…') });
    try {
      const res = await this.plugin.proponerResumen(nodo.ruta);
      zona.empty();
      const caja = zona.createDiv('mn-ia-caja' + (res.aprobable ? '' : ' rechazada'));
      caja.createDiv({ cls: 'mn-ia-titulo', text: res.aprobable ? T('Resumen propuesto (verificado)') : T('No se puede aprobar') });
      caja.createDiv({ cls: 'mn-ia-motivo', text: res.resumen || '' });
      for (const cita of res.citas || []) caja.createDiv({ cls: 'mn-ia-cita', text: `${cita.ok ? '✓ ' : '✕ '}${cita.texto}` });
      if (res.advertencia) caja.createDiv({ cls: 'mn-ia-rev', text: res.advertencia });
      if (res.aprobable) {
        const acciones = caja.createDiv('mn-acciones');
        acciones.createEl('button', { cls: 'mn-btn mn-btn-primario', text: T('Aprobar y guardar en la nota') }).onclick = async () => { await this.plugin.aprobarResumen(nodo.ruta, res); new Notice(T('Resumen guardado en la propiedad resumen de la nota.')); await this.recargar(); };
      }
    } catch (error) { zona.empty(); zona.createDiv({ cls: 'mn-ia-estado mn-falta', text: '✕ ' + (error.message || String(error)) }); }
  }

  async sugerirMotivo(fr) {
    const zona = this.inspectorWorkbench.content.createDiv('mn-ia');
    zona.createDiv({ cls: 'mn-ia-estado', text: T('Leyendo las dos notas…') });
    try {
      const res = await this.plugin.sugerir(fr);
      zona.empty();
      const caja = zona.createDiv('mn-ia-caja' + (res.aprobable ? '' : ' rechazada'));
      caja.createDiv({ cls: 'mn-ia-titulo', text: res.aprobable ? T('✦ Motivo propuesto (verificado)') : T('✕ No se puede aprobar') });
      caja.createDiv({ cls: 'mn-ia-motivo', text: res.motivo || '' });
      for (const cita of [res.cita_origen, res.cita_destino]) if (cita) caja.createDiv({ cls: 'mn-ia-cita', text: `${cita.ok ? '✓' : '✕'} ${cita.texto}` });
      if (res.advertencia) caja.createDiv({ cls: 'mn-ia-rev', text: res.advertencia });
      if (res.aprobable) {
        const acciones = caja.createDiv('mn-acciones');
        acciones.createEl('button', { cls: 'mn-btn mn-btn-primario', text: T('Aprobar y escribir en la nota') }).onclick = async () => { await this.plugin.aprobar(fr, res); new Notice(T('Motivo escrito en la nota y registrado.')); await this.recargar(); };
      }
    } catch (error) { zona.empty(); zona.createDiv({ cls: 'mn-ia-estado mn-falta', text: '✕ ' + (error.message || String(error)) }); }
  }

  async exportar() {
    const avisarFallo = (ruta, exitos) => T('No se pudo guardar «{0}». Archivos guardados antes del error: {1}', ruta, exitos.length ? exitos.join(' · ') : T('Ningún archivo'));
    try {
      const resultado = await exportarVista(this, {
        alcance: 'visible', formatos: ['png'], vault: this.app.vault, carpeta: this.plugin.ajustes.carpetaExport,
        renderizador: this.renderer, onNotice: (mensaje) => new Notice(mensaje), crearMensajeFallo: avisarFallo,
      });
      if (resultado.paths[0]) new Notice(T('Imagen guardada en {0}', resultado.paths[0]));
    } catch { /* exportarVista ya informa los archivos que quedaron guardados. */ }
  }

  datosExportables() {
    return prepararDatosExportables(this.datos, 'all', {
      estado: this.getState(), plugin: NOMBRE, version: this.plugin.manifest?.version || '',
      compatibilidadLegada: true, ahora: new Date(),
    });
  }

  async exportarDatos() {
    const avisarFallo = (ruta, exitos) => T('No se pudo guardar «{0}». Archivos guardados antes del error: {1}', ruta, exitos.length ? exitos.join(' · ') : T('Ningún archivo'));
    try {
      const resultado = await exportarVista(this, {
        alcance: 'all', formatos: ['json', 'csv'], vault: this.app.vault, carpeta: this.plugin.ajustes.carpetaExport,
        omitirSufijoAlcance: true, compatibilidadLegada: true,
        onNotice: (mensaje) => new Notice(mensaje), crearMensajeFallo: avisarFallo,
      });
      if (resultado.paths.length) new Notice(T('Datos guardados en {0}', resultado.paths.join(' · ')));
    } catch { /* exportarVista ya informa los archivos que quedaron guardados. */ }
  }

  abrirNota(ruta, linea) {
    const file = this.app.vault.getFileByPath(ruta);
    if (!file) return new Notice(T('Archivo no encontrado: {0}', ruta));
    this.app.workspace.getLeaf(Platform.isMobile ? false : 'tab').openFile(file, linea ? { eState: { line: linea - 1 } } : undefined);
  }
}

class AjustesMapa extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl: c } = this, p = this.plugin; c.empty();
    c.createEl('p', { text: T('Los cambios se aplican al cerrar este panel o al tocar ⋯ herramientas y luego recargar el mapa.'), cls: 'setting-item-description' });
    const area = (nombre, desc, clave, filas) => new Setting(c).setName(T(nombre)).setDesc(T(desc)).addTextArea((t) => {
      t.setValue(p.ajustes[clave]).onChange(async (v) => { p.ajustes[clave] = v; await p.guardar(); });
      t.inputEl.rows = filas; t.inputEl.addClass('mn-ajuste-area');
    });
    area(T('Capas'), 'Una por línea, de izquierda a derecha: «Nombre | descripción».', 'capas', 5);
    area('Carpetas → capa', 'Una por línea: «carpeta = número de capa» (0 es la primera). Gana la carpeta más específica. Lo que no esté aquí no aparece.', 'carpetas', 8);
    new Setting(c).setName(T('Propiedad de tema')).setDesc(T('Propiedad del frontmatter que agrupa y colorea las notas. Vacío = sin temas.'))
      .addText((t) => t.setValue(p.ajustes.propiedadTema).onChange(async (v) => { p.ajustes.propiedadTema = v.trim(); await p.guardar(); }));
    area('Temas', 'Una por línea: «valor = nombre visible = #color». Los temas que no estén aquí reciben un color automático.', 'temas', 7);
    area('Excluir notas', 'Nombres de nota (sin .md), separados por coma o línea. Útil para notas que enlazan a todo.', 'excluir', 2);
    area('Carpetas de fuentes', 'Una por línea. «carpeta» cuenta cada archivo; «carpeta/*» agrupa cada subcarpeta en un nodo (por ejemplo, un día). Vacío = sin fuentes.', 'carpetasFuentes', 3);
    new Setting(c).setName(T('Mostrar fuentes citadas')).setDesc(T('Las fuentes son los archivos de esas carpetas que tus notas citan por su ruta. «Bajo demanda»: aparecen al tocar la nota que las cita. «Todas»: siempre en la primera capa.'))
      .addDropdown((d) => d.addOptions({ no: T('No mostrar'), demanda: T('Bajo demanda'), todas: T('Todas') }).setValue(String(p.ajustes.fuentes)).onChange(async (v) => { p.ajustes.fuentes = v; await p.guardar(); }));
    new Setting(c).setName(T('Notas visibles por capa')).setDesc(T('En vaults grandes, cada capa muestra sus notas más conectadas. Las demás aparecen al buscarlas o al tocarlas desde el panel.'))
      .addSlider((sl) => sl.setLimits(30, 600, 10).setValue(Number(p.ajustes.maxPorCapa) || 150).setDynamicTooltip().onChange(async (v) => { p.ajustes.maxPorCapa = v; await p.guardar(); }));
    new Setting(c).setName(T('Orden de las capas')).setDesc(T('Elige el orden de las notas dentro de cada capa.'))
      .addDropdown((d) => d.addOptions({ auto: T('Automático'), alfabetico: T('Alfabético'), reciente: T('Más recientes') }).setValue(p.ajustes.ordenCapas)
        .onChange(async (v) => { p.ajustes = normalizarAjustes({ ...p.ajustes, ordenCapas: v }); await p.guardar(); }));
    new Setting(c).setName(T('Profundidad radial')).setDesc(T('Cuántos saltos alrededor de la nota seleccionada muestra la vista radial.'))
      .addSlider((s) => s.setLimits(1, 4, 1).setValue(p.ajustes.profundidadRadial).setDynamicTooltip()
        .onChange(async (v) => { p.ajustes.profundidadRadial = v; await p.guardar(); }));
    new Setting(c).setName(T('Tema visual')).setDesc(T('Sigue el tema claro u oscuro de Obsidian o usa la paleta nocturna clásica.'))
      .addDropdown((d) => d.addOptions({ tema: T('Seguir el tema'), noche: T('Noche estrellada') }).setValue(p.ajustes.temaVisual)
        .onChange(async (v) => { p.ajustes = normalizarAjustes({ ...p.ajustes, temaVisual: v }); await p.guardar(); }));
    new Setting(c).setName(T('Mostrar leyenda')).setDesc(T('Muestra las formas de notas, fuentes, supernodos y problemas.'))
      .addToggle((t) => t.setValue(p.ajustes.mostrarLeyenda)
        .onChange(async (v) => { p.ajustes.mostrarLeyenda = v; await p.guardar(); }));
    new Setting(c).setName(T('Mostrar ayuda al abrir')).setDesc(T('Abre la guía breve al abrir el mapa; también puedes abrirla desde Ayuda.'))
      .addToggle((t) => t.setValue(p.ajustes.mostrarAyuda)
        .onChange(async (v) => { p.ajustes.mostrarAyuda = v; await p.guardar(); }));
    new Setting(c).setName(T('Seguir la nota activa')).setDesc(T('Al abrir una nota, el mapa la enfoca.'))
      .addToggle((t) => t.setValue(p.ajustes.seguirActiva).onChange(async (v) => { p.ajustes.seguirActiva = v; await p.guardar(); }));
    new Setting(c).setName(T('Animación')).setDesc(T('Pulsos de luz que viajan por los enlaces. Solo mientras el mapa está visible; se apaga si el sistema pide reducir movimiento.'))
      .addToggle((t) => t.setValue(p.ajustes.animacion).onChange(async (v) => { p.ajustes.animacion = v; await p.guardar(); }));
    new Setting(c).setName(T('Carpeta para exportar imágenes')).addText((t) => t.setValue(p.ajustes.carpetaExport).onChange(async (v) => { p.ajustes.carpetaExport = v.trim(); await p.guardar(); }));
    new Setting(c).setName(T('Propiedad de enlaces externos')).setDesc(T('Propiedades del frontmatter con enlaces web, separadas por coma. Acepta «Título | https://…», «https://…» y «usuario/repo». Vacío = no se muestran.'))
      .addText((t) => t.setValue(p.ajustes.propiedadEnlaces).onChange(async (v) => { p.ajustes.propiedadEnlaces = v.trim(); await p.guardar(); }));
    new Setting(c).setName(T('Propiedad de fecha de modificación')).setDesc(T('Si la escribes, al aprobar un motivo o un resumen se pone la fecha de hoy en esa propiedad de la nota. Vacío = el plugin no toca el frontmatter.'))
      .addText((t) => t.setValue(p.ajustes.propiedadFecha).onChange(async (v) => { p.ajustes.propiedadFecha = v.trim(); await p.guardar(); }));
    new Setting(c).setName(T('Sección de conexiones')).setDesc(T('Título de la sección al final de cada nota donde van los motivos aprobados («- [[nota]] — motivo»).'))
      .addText((t) => t.setValue(p.ajustes.seccionMotivos).onChange(async (v) => { p.ajustes.seccionMotivos = v.trim() || 'Conexiones'; await p.guardar(); }));
    this.pintarIA(c);
    new Setting(c).setName(T('Segunda revisión')).setDesc(T('Una segunda llamada revisa que el motivo sea fiel (negaciones, estados, pendientes). Cuesta el doble y bloquea errores de matiz.'))
      .addToggle((t) => t.setValue(p.ajustes.dobleVerificacion).onChange(async (v) => { p.ajustes.dobleVerificacion = v; await p.guardar(); }));
    new Setting(c).setName(T('Carpeta del registro de aprobaciones')).setDesc(T('Cada motivo aprobado deja constancia (fecha, citas, modelo) en <carpeta>/<fecha>/mapa-neuronal-motivos.md.'))
      .addText((t) => t.setValue(p.ajustes.carpetaAuditoria).onChange(async (v) => { p.ajustes.carpetaAuditoria = v.trim(); await p.guardar(); }));
    new Setting(c).setName(T('Restablecer')).setDesc(T('Vuelve a los valores por defecto.'))
      .addButton((b) => b.setButtonText(T('Restablecer')).onClick(async () => { p.ajustes = Object.assign({}, AJUSTES_BASE); await p.guardar(); this.display(); }));
    c.createEl('p', { cls: 'setting-item-description', text: T('Restablecer no borra la llave guardada en este dispositivo.') });
    const pie = c.createEl('p', { cls: 'mn-pie' });
    pie.appendText(`${NOMBRE} ${p.manifest?.version || ''} · Powered by`);
    // El nombre de la marca va en una constante: la regla de mayúsculas del linter revisa
    // los textos escritos a mano y no puede saber que «DBB Labs» es un nombre propio.
    const enlace = pie.createEl('a', { href: 'https://dontbuybuild.cl', attr: { 'aria-label': `Powered by ${MARCA}` } });
    enlace.createSpan({ cls: 'mn-marca-dbb' });
  }
  // [1.31] La sección de IA se dibuja a mano (llave en localStorage, botón de probar): sirve
  // igual desde display() (Obsidian < 1.13) y como ítem `render` de getSettingDefinitions().
  pintarIA(c) {
    const p = this.plugin;
    new Setting(c).setName(T('Conecta tu inteligencia artificial (opcional)')).setHeading();
    c.createEl('p', { cls: 'setting-item-description', text: T('Para el botón de sugerir motivo. Usa tu propia llave de la API, se guarda solo en este dispositivo y no viaja por Sync ni por git. La IA propone; tú apruebas.') });
    const prov = p.ajustes.proveedorIA || 'claude', def = PROVEEDORES[prov];
    new Setting(c).setName(T('Proveedor')).setDesc(T('Elige con qué IA se generan los motivos y los resúmenes. Los controles de calidad (citas verificadas y tu aprobación) funcionan con todos.'))
      .addDropdown((d) => d.addOptions(Object.fromEntries(Object.entries(PROVEEDORES).map(([k, v]) => [k, v.nombre]))).setValue(prov)
        .onChange(async (v) => { p.ajustes.proveedorIA = v; p.ajustes.modeloIA = PROVEEDORES[v].modelo; await p.guardar(); this.refrescar(); }));
    if (def.llave) {
      // Pegar una llave en un campo de contraseña y no ver nada deja la duda de si quedó guardada.
      // El aviso va en la DESCRIPCIÓN de la fila, no en un evento del DOM: `PluginSettingTab` no
      // es un `Component` y no tiene `registerDomEvent`, así que llamarlo lanzaba un TypeError que
      // cortaba el dibujado justo aquí — sin botón «Borrar», sin «Modelo» y sin «Probar».
      // Además la descripción se queda: un aviso que pasa y se va no sirve para comprobar nada.
      const fila = new Setting(c).setName(T('Llave de la API'));
      const decir = () => fila.setDesc(p.app.loadLocalStorage(CLAVE_IA(prov)) ? T('Guardada en este dispositivo. ') + T(def.ayuda) : T(def.ayuda));
      decir();
      fila.addText((t) => { t.inputEl.type = 'password';
        t.setPlaceholder(p.app.loadLocalStorage(CLAVE_IA(prov)) ? T('guardada') : T('pega la llave aquí'));
        t.onChange((v) => { p.app.saveLocalStorage(CLAVE_IA(prov), v.trim() || null); decir(); }); })
        .addButton((b) => b.setButtonText(T('Borrar')).onClick(() => { p.app.saveLocalStorage(CLAVE_IA(prov), null); this.refrescar(); new Notice(T('Llave borrada de este dispositivo')); }));
    } else new Setting(c).setName(T('Sin llave')).setDesc(T(def.ayuda));
    if (prov === 'local') new Setting(c).setName(T('Dirección del servidor local')).setDesc(T('Compatible con OpenAI. Ollama usa http://localhost:11434/v1/chat/completions.'))
      .addText((t) => t.setValue(p.ajustes.urlLocal).onChange(async (v) => { p.ajustes.urlLocal = v.trim() || PROVEEDORES.local.url; await p.guardar(); }));
    if (prov === 'claude') new Setting(c).setName(T('Modelo')).setDesc(T(def.modeloAyuda))
      .addDropdown((d) => d.addOptions({ 'claude-opus-5': 'Claude Opus 5', 'claude-sonnet-5': 'Claude Sonnet 5', 'claude-haiku-4-5': 'Claude Haiku 4.5' }).setValue(p.ajustes.modeloIA || 'claude-opus-5').onChange(async (v) => { p.ajustes.modeloIA = v; await p.guardar(); }));
    else new Setting(c).setName(T('Modelo')).setDesc(T(def.modeloAyuda))
      .addText((t) => t.setPlaceholder(T('nombre del modelo')).setValue(p.ajustes.modeloIA).onChange(async (v) => { p.ajustes.modeloIA = v.trim(); await p.guardar(); }));
    c.createEl('p', { cls: 'setting-item-description', text: T('La calidad de los motivos se midió con Claude Opus 5: 97,7 % correctos y 0 inventados sobre 50 conexiones. Con otros modelos los candados siguen puestos (citas verificadas y tu aprobación), pero la precisión no está medida.') });
    new Setting(c).setName(T('Probar la conexión')).setDesc(T('Hace una llamada mínima —unos pocos tokens— y te dice si tu IA responde. Ninguna nota se envía.'))
      .addButton((b) => b.setButtonText(T('Probar')).onClick(async () => {
        b.setButtonText(T('Probando…')).setDisabled(true);
        try {
          const r = await p.llamarIA('Responde solo con JSON.', 'Devuelve exactamente {"ok": true}.',
            { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } });
          new Notice(r && r.ok === true
            ? T('Funciona: {0} respondió.', p.ajustes.modeloIA || def.nombre)
            : T('{0} respondió algo inesperado. Prueba con otro modelo.', def.nombre), 8000);
        } catch (e) { new Notice(e.message, 10000); }
        b.setButtonText(T('Probar')).setDisabled(false);
      }));
  }
  refrescar() { if (typeof this.update === 'function') this.update(); else this.display(); }
  // Obsidian 1.13+: los ajustes también como definiciones, para que aparezcan en la búsqueda
  // de ajustes. Los valores viven en plugin.ajustes, no en plugin.settings.
  getControlValue(clave) { return this.plugin.ajustes[clave]; }
  async setControlValue(clave, valor) {
    const p = this.plugin;
    if (typeof valor === 'string' && !['capas', 'carpetas', 'temas', 'excluir', 'carpetasFuentes'].includes(clave)) valor = valor.trim();
    if (clave === 'seccionMotivos' && !valor) valor = 'Conexiones';
    p.ajustes = normalizarAjustes({ ...p.ajustes, [clave]: valor });
    await p.guardar();
  }
  getSettingDefinitions() {
    const area = (nombre, desc, key, rows) => ({ name: T(nombre), desc: T(desc), control: { type: 'textarea', key, rows } });
    const texto = (nombre, desc, key) => ({ name: T(nombre), desc: desc ? T(desc) : undefined, control: { type: 'text', key } });
    const interruptor = (nombre, desc, key) => ({ name: T(nombre), desc: T(desc), control: { type: 'toggle', key } });
    return [
      area('Capas', 'Una por línea, de izquierda a derecha: «Nombre | descripción».', 'capas', 5),
      area('Carpetas → capa', 'Una por línea: «carpeta = número de capa» (0 es la primera). Gana la carpeta más específica. Lo que no esté aquí no aparece.', 'carpetas', 8),
      texto('Propiedad de tema', 'Propiedad del frontmatter que agrupa y colorea las notas. Vacío = sin temas.', 'propiedadTema'),
      area('Temas', 'Una por línea: «valor = nombre visible = #color». Los temas que no estén aquí reciben un color automático.', 'temas', 7),
      area('Excluir notas', 'Nombres de nota (sin .md), separados por coma o línea. Útil para notas que enlazan a todo.', 'excluir', 2),
      area('Carpetas de fuentes', 'Una por línea. «carpeta» cuenta cada archivo; «carpeta/*» agrupa cada subcarpeta en un nodo (por ejemplo, un día). Vacío = sin fuentes.', 'carpetasFuentes', 3),
      { name: T('Mostrar fuentes citadas'), desc: T('Las fuentes son los archivos de esas carpetas que tus notas citan por su ruta. «Bajo demanda»: aparecen al tocar la nota que las cita. «Todas»: siempre en la primera capa.'),
        control: { type: 'dropdown', key: 'fuentes', options: { no: T('No mostrar'), demanda: T('Bajo demanda'), todas: T('Todas') } } },
      { name: T('Notas visibles por capa'), desc: T('En vaults grandes, cada capa muestra sus notas más conectadas. Las demás aparecen al buscarlas o al tocarlas desde el panel.'),
        control: { type: 'slider', key: 'maxPorCapa', min: 30, max: 600, step: 10, defaultValue: 150 } },
      { name: T('Orden de las capas'), desc: T('Elige el orden de las notas dentro de cada capa.'),
        control: { type: 'dropdown', key: 'ordenCapas', options: { auto: T('Automático'), alfabetico: T('Alfabético'), reciente: T('Más recientes') }, defaultValue: 'auto' } },
      { name: T('Profundidad radial'), desc: T('Cuántos saltos alrededor de la nota seleccionada muestra la vista radial.'),
        control: { type: 'slider', key: 'profundidadRadial', min: 1, max: 4, step: 1, defaultValue: 2 } },
      { name: T('Tema visual'), desc: T('Sigue el tema claro u oscuro de Obsidian o usa la paleta nocturna clásica.'),
        control: { type: 'dropdown', key: 'temaVisual', options: { tema: T('Seguir el tema'), noche: T('Noche estrellada') }, defaultValue: 'tema' } },
      interruptor('Mostrar leyenda', 'Muestra las formas de notas, fuentes, supernodos y problemas.', 'mostrarLeyenda'),
      interruptor('Mostrar ayuda al abrir', 'Abre la guía breve al abrir el mapa; también puedes abrirla desde Ayuda.', 'mostrarAyuda'),
      interruptor('Seguir la nota activa', 'Al abrir una nota, el mapa la enfoca.', 'seguirActiva'),
      interruptor('Animación', 'Pulsos de luz que viajan por los enlaces. Solo mientras el mapa está visible; se apaga si el sistema pide reducir movimiento.', 'animacion'),
      texto('Carpeta para exportar imágenes', null, 'carpetaExport'),
      texto('Propiedad de enlaces externos', 'Propiedades del frontmatter con enlaces web, separadas por coma. Acepta «Título | https://…», «https://…» y «usuario/repo». Vacío = no se muestran.', 'propiedadEnlaces'),
      texto('Propiedad de fecha de modificación', 'Si la escribes, al aprobar un motivo o un resumen se pone la fecha de hoy en esa propiedad de la nota. Vacío = el plugin no toca el frontmatter.', 'propiedadFecha'),
      texto('Sección de conexiones', 'Título de la sección al final de cada nota donde van los motivos aprobados («- [[nota]] — motivo»).', 'seccionMotivos'),
      { name: T('Conecta tu inteligencia artificial (opcional)'), aliases: ['IA', 'AI', 'API key', 'Claude', 'OpenAI', 'Gemini', 'Ollama'],
        render: (setting) => { const el = setting?.settingEl; if (!el) return; el.empty(); el.addClass('mn-ajuste-ia'); this.pintarIA(el); } },
      interruptor('Segunda revisión', 'Una segunda llamada revisa que el motivo sea fiel (negaciones, estados, pendientes). Cuesta el doble y bloquea errores de matiz.', 'dobleVerificacion'),
      texto('Carpeta del registro de aprobaciones', 'Cada motivo aprobado deja constancia (fecha, citas, modelo) en <carpeta>/<fecha>/mapa-neuronal-motivos.md.', 'carpetaAuditoria'),
    ];
  }
  hide() {
    this.plugin.app.workspace.getLeavesOfType(VISTA).forEach((hoja) => hoja.view.aplicarAjustesVisual?.());
    this.plugin.refrescarVistas();
  }
}

export default class MapaNeuronal extends Plugin {
  async onload() {
    const guardado = await this.loadData();
    this.ajustes = normalizarAjustes(guardado);
    this.store = new GraphStore();
    const migroVistas = !!guardado && (
      Object.hasOwn(guardado, 'vistasGuardados')
      || JSON.stringify(guardado.vistasGuardadas ?? null) !== JSON.stringify(this.ajustes.vistasGuardadas)
      || (guardado.ultimaVista ?? null) !== this.ajustes.ultimaVista
    );
    if (typeof this.ajustes.fuentes === 'boolean') {
      if (this.ajustes.fuentes && !this.ajustes.carpetasFuentes) this.ajustes.carpetasFuentes = 'raw/articles\nraw/daily/*';
      this.ajustes.fuentes = this.ajustes.fuentes ? 'todas' : 'no';
      if (guardado) await this.guardar();
    }
    if (!guardado) {
      this.ajustes.capas = `${T('Entrada')} | ${T('notas con fecha')}\n${T('Notas')} | ${T('el resto del vault')}`;
      this.ajustes.seccionMotivos = T('Conexiones');
    }
    if (migroVistas) await this.guardar();
    this.registerView(VISTA, (hoja) => new VistaMapa(hoja, this));
    this.addSettingTab(new AjustesMapa(this.app, this));
    this.addRibbonIcon('brain-circuit', T('Abrir el mapa'), () => this.abrir());
    this.addCommand({ id: 'abrir', name: T('Abrir el mapa'), callback: () => this.abrir() });
    this.addCommand({ id: 'recargar-ajustes', name: T('Recargar ajustes desde data.json'), callback: () => this.recargarAjustes() });
    this.addCommand({ id: 'enfocar-actual', name: T('Mostrar la nota actual en el mapa'), checkCallback: (probar) => {
      const f = this.app.workspace.getActiveFile(); if (!f) return false;
      if (!probar) this.abrir().then(() => this.app.workspace.getLeavesOfType(VISTA)[0]?.view.enfocar(f.path, true));
      return true;
    } });
    this.refrescarVistas = debounce(() => this.app.workspace.getLeavesOfType(VISTA).forEach((h) => h.view.recargar?.()), 1500, true);
    this.registerEvent(this.app.metadataCache.on('changed', (file) => { this.store.invalidate(file.path); this.refrescarVistas(); }));
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.refrescarVistas()));
    if (typeof this.app.vault.on === 'function') {
      this.registerEvent(this.app.vault.on('delete', (file) => { this.store.invalidate(file.path); this.refrescarVistas(); }));
      this.registerEvent(this.app.vault.on('rename', (file, oldPath) => { this.store.invalidate(oldPath, file.path); this.refrescarVistas(); }));
    }
  }
  async guardar() { await this.saveData(this.ajustes); }

  async guardarVista(nombre, estado) {
    const clave = String(nombre ?? '').trim().slice(0, NOMBRE_VISTA_MAX);
    if (!clave) {
      new Notice(T('Escribe un nombre para la vista guardada'));
      return null;
    }
    const guardadas = normalizarVistasGuardadas(this.ajustes.vistasGuardadas);
    if (Object.keys(guardadas).some((vista) => vista.toLowerCase() === clave.toLowerCase())) {
      new Notice(T('Ya existe una vista guardada con ese nombre'));
      return null;
    }
    const ahora = Date.now();
    guardadas[clave] = { estado: normalizarEstado(estado), creada: ahora, actualizada: ahora };
    const exceso = Object.entries(guardadas).sort((a, b) => a[1].actualizada - b[1].actualizada);
    if (exceso.length > MAX_VISTAS) delete guardadas[exceso[0][0]];
    this.ajustes.vistasGuardadas = guardadas;
    await this.guardar();
    new Notice(T('Vista guardada: {0}', clave));
    return clave;
  }

  async restaurarVista(nombre) {
    const solicitado = String(nombre ?? '').trim().slice(0, NOMBRE_VISTA_MAX).toLowerCase();
    const clave = Object.keys(this.ajustes.vistasGuardadas || {}).find((vista) => vista.toLowerCase() === solicitado);
    if (!clave) {
      new Notice(T('No se encontró la vista guardada: {0}', nombre));
      return null;
    }
    await this.abrir();
    const vista = this.app.workspace.getLeavesOfType(VISTA)[0]?.view;
    if (!vista) {
      new Notice(T('No se pudo abrir el mapa para restaurar la vista'));
      return null;
    }
    const estado = await vista.setState(this.ajustes.vistasGuardadas[clave].estado);
    this.ajustes.ultimaVista = clave;
    await this.guardar();
    new Notice(T('Vista restaurada: {0}', clave));
    return estado;
  }
  // Para quien edita data.json a mano (ya pasó): vuelve a leerlo sin reiniciar Obsidian.
  async recargarAjustes() {
    const guardado = await this.loadData();
    this.ajustes = normalizarAjustes(guardado);
    this.app.workspace.getLeavesOfType(VISTA).forEach((h) => h.view.recargar?.());
    new Notice(T('Ajustes recargados desde data.json'));
  }
  tieneIA() {
    const prov = this.ajustes.proveedorIA || 'claude', def = PROVEEDORES[prov];
    if (!def) return false;
    return def.llave ? !!this.app.loadLocalStorage(CLAVE_IA(prov)) : !!this.ajustes.modeloIA;
  }

  // Una sola puerta para todos los proveedores. Devuelve el objeto JSON que pide el esquema.
  // Se usa requestUrl de Obsidian y no un SDK: en el celular una llamada fetch del navegador choca
  // con CORS y requestUrl no, y así el plugin no arrastra dependencias de red.
  async llamarIA(sistema, usuario, esquema) {
    const prov = this.ajustes.proveedorIA || 'claude', def = PROVEEDORES[prov];
    if (!def) throw new Error(T('Proveedor de IA desconocido.'));
    const llave = def.llave ? this.app.loadLocalStorage(CLAVE_IA(prov)) : '';
    if (def.llave && !llave) throw new Error(T('Falta la llave de {0} en este dispositivo (configuración del plugin).', def.nombre));
    const modelo = (this.ajustes.modeloIA || def.modelo || '').trim();
    if (!modelo) throw new Error(T('Falta escribir el modelo en la configuración del plugin.'));
    const texto = prov === 'claude' ? await this.pedirClaude(llave, modelo, sistema, usuario, esquema)
      : prov === 'gemini' ? await this.pedirGemini(llave, modelo, sistema, usuario, esquema)
      : await this.pedirCompatible(prov, llave, modelo, sistema, usuario, esquema);
    const limpio = String(texto).trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    try { return JSON.parse(limpio); } catch { throw new Error(T('La IA no devolvió un resultado legible. Prueba con otro modelo.')); }
  }
  revisarRespuesta(r, nombre, local) {
    const j = r.json || {};
    if (r.status === 401 || r.status === 403) throw new Error(T('{0} rechazó la llave ({1}).', nombre, r.status));
    if (r.status === 429) throw new Error(T('{0} alcanzó su límite de uso (429). Intenta más tarde.', nombre));
    // El consejo tiene que corresponder al proveedor: a quien usa Gemini no se le puede decir que
    // revise si su servidor local está corriendo. Y un 5xx remoto no es culpa de su configuración:
    // decirlo evita que se ponga a cambiar ajustes que estaban bien.
    if (r.status === 0 || r.status >= 500) throw new Error(local
      ? T('{0} no respondió ({1}). Revisa que Ollama o LM Studio esté corriendo en este computador.', nombre, r.status)
      : T('{0} no respondió ({1}): su servicio está caído o sobrecargado. No es tu configuración; vuelve a intentar en un rato.', nombre, r.status));
    if (r.status >= 400) throw new Error(T('{0} respondió {1}: {2}', nombre, r.status, j.error?.message || 'error'));
    return j;
  }
  // Pedir y, si el servicio está sobrecargado, volver a intentar. Un 503 o un 429 en la capa
  // gratuita es lo normal a ciertas horas, y rendirse en el primer intento hacía fallar una
  // sugerencia que iba a funcionar dos segundos después. Solo se reintenta lo que tiene sentido
  // reintentar: red caída (0), límite de uso (429) y errores del servidor (5xx). Un 401 o un 400
  // no mejoran por insistir, y repetirlos sería gastar la cuota del usuario para nada.
  async pedirReintentando(opciones, nombre, local) {
    const esperas = this.esperasReintento || [1200, 3500, 8000];   // las pruebas las ponen en 0
    for (let i = 0; ; i++) {
      const r = await requestUrl(Object.assign({ method: 'POST', throw: false }, opciones));
      const vale = r.status === 0 || r.status === 429 || r.status >= 500;
      if (!vale || i >= esperas.length) return this.revisarRespuesta(r, nombre, local);
      await new Promise((ok) => window.setTimeout(ok, esperas[i]));
    }
  }
  async pedirClaude(llave, modelo, sistema, usuario, esquema) {
    const headers = { 'content-type': 'application/json', 'x-api-key': llave, 'anthropic-version': '2023-06-01' };
    const cuerpo = { model: modelo, max_tokens: 16000, system: sistema, messages: [{ role: 'user', content: usuario }],
      output_config: { format: { type: 'json_schema', schema: esquema } } };
    if (modelo === 'claude-opus-5') { headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; cuerpo.fallbacks = 'default'; }
    const j = await this.pedirReintentando({ url: PROVEEDORES.claude.url, headers, body: JSON.stringify(cuerpo) }, 'Claude');
    if (j.stop_reason === 'refusal') throw new Error(T('El modelo declinó esta solicitud.'));
    if (j.stop_reason === 'max_tokens') throw new Error(T('La respuesta quedó cortada. Reintenta.'));
    return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  async pedirCompatible(prov, llave, modelo, sistema, usuario, esquema) {
    const url = prov === 'local' ? (this.ajustes.urlLocal || PROVEEDORES.local.url) : PROVEEDORES.openai.url;
    const headers = { 'content-type': 'application/json' };
    if (llave) headers.authorization = `Bearer ${llave}`;
    const cuerpo = { model: modelo, messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
      response_format: prov === 'local' ? { type: 'json_object' } : { type: 'json_schema', json_schema: { name: 'respuesta', strict: true, schema: esquema } } };
    if (prov === 'local') cuerpo.messages[0].content += '\nResponde SOLO con un objeto JSON con estas claves: ' + Object.keys(esquema.properties).join(', ') + '.';
    const j = await this.pedirReintentando({ url, headers, body: JSON.stringify(cuerpo) }, prov === 'local' ? 'La IA local' : 'OpenAI', prov === 'local');
    return j.choices?.[0]?.message?.content || '';
  }
  async pedirGemini(llave, modelo, sistema, usuario, esquema) {
    const limpiar = (e) => ({ type: e.type, ...(e.properties ? { properties: Object.fromEntries(Object.entries(e.properties).map(([k, v]) => [k, limpiar(v)])) } : {}), ...(e.items ? { items: limpiar(e.items) } : {}), ...(e.required ? { required: e.required } : {}) });
    const url = `${PROVEEDORES.gemini.url}/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(llave)}`;
    const cuerpo = { systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: [{ text: usuario }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: limpiar(esquema) } };
    const j = await this.pedirReintentando({ url, headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }, 'Gemini');
    return (j.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
  }
  async sugerir(fr) {
    const leer = async (ruta) => { const f = this.app.vault.getFileByPath(ruta); return f ? this.app.vault.cachedRead(f) : ''; };
    const origen = await leer(fr.origen), destino = await leer(fr.destino);
    const LIM = 60000;
    if (origen.length > LIM || destino.length > LIM) throw new Error(T('Una de las notas es demasiado larga para enviarla completa (más de 60.000 caracteres).'));
    const nombre = (ruta) => ruta.split('/').pop().replace(/\.md$/, '');
    const sistema = 'Explicas por qué una nota de un wiki personal enlaza a otra. Reglas estrictas: usa SOLO lo que dicen las dos notas; no infieras ni completes con conocimiento externo. Respeta negaciones ("nadie lo conectó"), estados ("idea", "pendiente", "descartado", "sin verificar") y condicionales: un pendiente no es un hecho. Las citas deben ser copias LITERALES, carácter por carácter, de un fragmento de cada nota (sin reformular, sin "…"). Si la relación no se puede afirmar con citas literales, responde con suficiente=false.';
    const usuario = `NOTA DE ORIGEN (${nombre(fr.origen)}). El enlace a [[${nombre(fr.destino)}]] está en la línea ${fr.linea}:\n<origen>\n${origen}\n</origen>\n\nNOTA ENLAZADA (${nombre(fr.destino)}):\n<destino>\n${destino}\n</destino>\n\nEscribe el motivo del enlace: una frase de 6 a 18 palabras, concreta, que diga por qué la nota de origen se conecta con la enlazada. ESCRIBE EL MOTIVO EN EL MISMO IDIOMA EN QUE ESTÁN ESCRITAS LAS NOTAS, no en el idioma de estas instrucciones. Da una cita literal de la nota de origen (idealmente la línea ${fr.linea} o parte de ella) y una cita literal de la nota enlazada que respalde el motivo.`;
    const esquema = { type: 'object', additionalProperties: false, required: ['suficiente', 'motivo', 'cita_origen', 'cita_destino'],
      properties: { suficiente: { type: 'boolean' }, motivo: { type: 'string' }, cita_origen: { type: 'string' }, cita_destino: { type: 'string' } } };
    const g = await this.llamarIA(sistema, usuario, esquema);
    const res = { motivo: (g.motivo || '').trim(), modelo: this.ajustes.modeloIA,
      cita_origen: g.cita_origen ? { texto: g.cita_origen, ok: this.verificarCita(g.cita_origen, origen) } : null,
      cita_destino: g.cita_destino ? { texto: g.cita_destino, ok: this.verificarCita(g.cita_destino, destino) } : null };
    const palabras = res.motivo.split(/\s+/).filter(Boolean).length;
    if (!g.suficiente || !res.motivo) { res.advertencia = T('La IA no encontró base literal suficiente para afirmar un motivo.'); res.aprobable = false; return res; }
    if (palabras < 4 || palabras > 24) { res.advertencia = T('El motivo tiene {0} palabras; debe ser una frase corta.', palabras); }
    if (!res.cita_origen?.ok || !res.cita_destino?.ok) { res.aprobable = false; res.advertencia = T('Una cita no aparece literal en la nota: se bloquea para no escribir algo no verificable.'); return res; }
    if (this.ajustes.dobleVerificacion) {
      const esquema2 = { type: 'object', additionalProperties: false, required: ['fiel', 'problema'], properties: { fiel: { type: 'boolean' }, problema: { type: 'string' } } };
      const sistema2 = 'Eres un revisor escéptico. Decides si un motivo de enlace es FIEL a dos notas. Es infiel si: afirma algo que las notas no dicen; convierte un pendiente, idea o posibilidad en un hecho; ignora una negación; atribuye algo a la nota equivocada; o describe otra relación distinta de la que el texto establece. Si hay cualquier duda, fiel=false.';
      const usuario2 = `<origen>\n${origen}\n</origen>\n\n<destino>\n${destino}\n</destino>\n\nEnlace: línea ${fr.linea} de la nota de origen, hacia [[${nombre(fr.destino)}]].\nMotivo propuesto: "${res.motivo}"\nCitas: origen «${g.cita_origen}» · destino «${g.cita_destino}»\n\n¿Es fiel? Si no, explica el problema en una frase; si es fiel, problema="".`;
      res.revision = await this.llamarIA(sistema2, usuario2, esquema2);
      res.aprobable = !!res.revision.fiel;
    } else res.aprobable = true;
    return res;
  }
  verificarCita(cita, texto) {
    const norm = (t) => String(t || '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a).replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const c = norm(cita); return c.length >= 12 && (norm(texto).includes(c) || texto.replace(/\s+/g, ' ').toLowerCase().includes(String(cita).replace(/\s+/g, ' ').trim().toLowerCase()));
  }
  async proponerResumen(ruta) {
    const f = this.app.vault.getFileByPath(ruta); if (!f) throw new Error(T('No encuentro la nota'));
    const texto = await this.app.vault.cachedRead(f);
    if (texto.length > 60000) throw new Error(T('La nota es demasiado larga para enviarla completa (más de 60.000 caracteres).'));
    const sistema = 'Resumes una nota de un wiki personal. Reglas estrictas: usa SOLO lo que dice la nota; no agregues conocimiento externo. Respeta negaciones, estados ("idea", "pendiente", "descartado", "sin verificar") y condicionales: un pendiente no es un hecho. Las citas deben ser copias LITERALES, carácter por carácter, de fragmentos de la nota. Si la nota no tiene contenido suficiente para resumirla, responde suficiente=false.';
    const usuario = `<nota>\n${texto}\n</nota>\n\nEscribe un resumen de 1 o 2 frases (máximo 40 palabras) que diga qué es la nota y lo más importante que afirma. ESCRIBE EL RESUMEN EN EL MISMO IDIOMA EN QUE ESTÁ ESCRITA LA NOTA, no en el idioma de estas instrucciones. Da 1 o 2 citas literales de la nota que respalden el resumen (cada una de al menos 12 caracteres).`;
    const esquema = { type: 'object', additionalProperties: false, required: ['suficiente', 'resumen', 'citas'], properties: { suficiente: { type: 'boolean' }, resumen: { type: 'string' }, citas: { type: 'array', items: { type: 'string' } } } };
    const g = await this.llamarIA(sistema, usuario, esquema);
    const res = { resumen: (g.resumen || '').trim(), modelo: this.ajustes.modeloIA, citas: (g.citas || []).slice(0, 2).map((t) => ({ texto: t, ok: this.verificarCita(t, texto) })) };
    if (!g.suficiente || !res.resumen) { res.aprobable = false; res.advertencia = T('La nota no tiene contenido suficiente para un resumen fiel.'); return res; }
    const palabras = res.resumen.split(/\s+/).filter(Boolean).length;
    if (palabras > 55) { res.aprobable = false; res.advertencia = T('El resumen tiene {0} palabras; debe ser breve.', palabras); return res; }
    if (!res.citas.length || res.citas.some((c) => !c.ok)) { res.aprobable = false; res.advertencia = T('Una cita no aparece literal en la nota: se bloquea para no guardar algo no verificable.'); return res; }
    if (this.ajustes.dobleVerificacion) {
      const esquema2 = { type: 'object', additionalProperties: false, required: ['fiel', 'problema'], properties: { fiel: { type: 'boolean' }, problema: { type: 'string' } } };
      const sistema2 = 'Eres un revisor escéptico. Decides si un resumen es FIEL a una nota. Es infiel si afirma algo que la nota no dice, convierte un pendiente o idea en hecho, ignora una negación u omite la idea central. Ante cualquier duda, fiel=false.';
      res.revision = await this.llamarIA(sistema2, `<nota>\n${texto}\n</nota>\n\nResumen propuesto: "${res.resumen}"\n\n¿Es fiel? Si no, explica el problema en una frase; si es fiel, problema="".`, esquema2);
      res.aprobable = !!res.revision.fiel;
    } else res.aprobable = true;
    return res;
  }
  async aprobarResumen(ruta, res) {
    const f = this.app.vault.getFileByPath(ruta); if (!f) throw new Error(T('No encuentro la nota'));
    // Guardar el resumen MODIFICA la nota, así que también le corresponde la fecha de hoy. Antes
    // solo la estampaba al aprobar un motivo: la nota quedaba tocada con una fecha vieja, y en un
    // wiki donde esa fecha es el criterio de qué está al día, eso es una mentira silenciosa.
    // Sigue dependiendo de que el usuario haya configurado la propiedad: sin eso, no se toca.
    const prop = this.ajustes.propiedadFecha, hoyStr = hoy();
    await this.app.fileManager.processFrontMatter(f, (fm) => { fm.resumen = res.resumen; if (prop) fm[prop] = hoyStr; });
    await this.registrar(`\n## ${new Date().toTimeString().slice(0, 5)} · resumen de ${ruta}\n- Resumen aprobado: ${res.resumen}\n${(res.citas || []).map((c) => `- Cita: «${c.texto}»`).join('\n')}\n- Modelo: ${res.modelo} · segunda revisión: ${res.revision ? (res.revision.fiel ? 'fiel' : 'no fiel') : 'desactivada'} · aprobado por la persona\n`);
    this.refrescarVistas();
  }
  async registrar(entrada) {
    const hoyStr = hoy(), carpeta = normalizePath(`${this.ajustes.carpetaAuditoria || 'Mapa neuronal/aprobaciones'}/${hoyStr}`), ruta = normalizePath(`${carpeta}/mapa-neuronal-motivos.md`);
    if (!this.app.vault.getFolderByPath(carpeta)) await this.app.vault.createFolder(carpeta);
    const registro = this.app.vault.getFileByPath(ruta);
    if (registro) await this.app.vault.append(registro, entrada);
    else await this.app.vault.create(ruta, `---\ndate: ${hoyStr}\nsource: mapa-neuronal\n---\n\n# ${T('Aprobaciones desde {0}', NOMBRE)}\n` + entrada);
  }
  // Escribe el motivo aprobado en la sección final de la nota de origen y deja registro de auditoría.
  async aprobar(fr, res) {
    const f = this.app.vault.getFileByPath(fr.origen); if (!f) throw new Error(T('No encuentro la nota de origen'));
    const titulo = this.ajustes.seccionMotivos || 'Conexiones';
    const base = fr.destino.split('/').pop().replace(/\.md$/, ''), linea = `- [[${base}]] — ${res.motivo.replace(/\s+/g, ' ').replace(/\.$/, '')}`, hoyStr = hoy();
    await this.app.vault.process(f, (t) => {
      const out = t;
      const esc = titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), i = out.search(new RegExp('^## ' + esc + '[^\\n]*$', 'm'));
      if (i < 0) return out.replace(/\s*$/, '') + `\n\n## ${titulo}\n\n${linea}\n`;
      const resto = out.slice(i), fin = resto.slice(1).search(/^## /m);
      const seccion = fin < 0 ? resto : resto.slice(0, fin + 1), despues = fin < 0 ? '' : resto.slice(fin + 1);
      return out.slice(0, i) + seccion.replace(/\s*$/, '') + `\n${linea}\n` + (despues ? '\n' + despues : '');
    });
    // La fecha de modificación solo si el usuario la pidió: escribir en el frontmatter de alguien
    // sin avisar es exactamente lo que el README promete que no pasa.
    if (this.ajustes.propiedadFecha) {
      const prop = this.ajustes.propiedadFecha;
      await this.app.fileManager.processFrontMatter(f, (fm) => { fm[prop] = hoyStr; });
    }
    const entrada = `\n## ${new Date().toTimeString().slice(0, 5)} · ${fr.origen} → [[${base}]]\n- Motivo aprobado: ${res.motivo}\n- Cita origen (línea ${fr.linea}): «${res.cita_origen?.texto}»\n- Cita destino: «${res.cita_destino?.texto}»\n- Modelo: ${res.modelo} · segunda revisión: ${res.revision ? (res.revision.fiel ? 'fiel' : 'no fiel') : 'desactivada'} · aprobado por la persona\n`;
    await this.registrar(entrada);
    this.refrescarVistas();
  }
  async abrir() {
    const ya = this.app.workspace.getLeavesOfType(VISTA)[0];
    if (ya) { this.app.workspace.revealLeaf(ya); return; }
    const hoja = this.app.workspace.getLeaf(Platform.isMobile ? false : 'tab');
    await hoja.setViewState({ type: VISTA, active: true });
    this.app.workspace.revealLeaf(hoja);
  }
}

// Estas exportaciones son contratos consumidos por el entry de pruebas; el runtime de Obsidian
// sigue consumiendo únicamente la exportación predeterminada.
export {
  VistaMapa,
  AsistenteCapas,
  AjustesMapa,
  AJUSTES_BASE,
  normalizarVistasGuardadas,
  normalizarAjustes,
  PROVEEDORES,
  CAPAS_ESTANDAR,
  detectarCarpetas,
  CLAVE_IA,
  detectarFuentes,
  subcarpetasFechadas,
  PLANTILLAS,
  plantillaActual,
};
