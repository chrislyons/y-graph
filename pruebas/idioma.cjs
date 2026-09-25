/* Prueba de cobertura del idioma del plugin «Mapa neuronal».
 *
 * Verifica que TODO texto que pase por T() tenga traducción al inglés, y que no queden
 * entradas muertas en el diccionario. Un texto sin traducir no se ve hasta que lo abre un
 * usuario en inglés: por eso es una prueba y no una nota.
 *
 *   node pruebas/idioma.cjs                       usa pruebas/.build/main-test.js
 *   node pruebas/idioma.cjs ruta/main-test.js     usa otro bundle de pruebas
 */
const fs = require('fs'), path = require('path');
const { cargarPlugin } = require('./simulado.cjs');
const RUTA = process.argv[2] || path.join(__dirname, '.build/main-test.js');
const sourceFiles = ['../src/main.js', '../src/model/graph.js', '../src/model/analysis.js', '../src/model/store.js', '../src/view/state.js', '../src/view/layouts.js', '../src/view/renderer.js', '../src/view/table.js', '../src/ui/interaction.js', '../src/ui/toolbar.js', '../src/ui/filters.js', '../src/ui/inspector.js', '../src/exports.js'];
const texto = sourceFiles.map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
const fuenteI18n = fs.readFileSync(path.join(__dirname, '../src/i18n.js'), 'utf8');

const cargar = () => cargarPlugin(RUTA).interno;
const { CAPAS_ESTANDAR, PROVEEDORES, PLANTILLAS } = cargar();

// El diccionario es privado por contrato: sus claves se leen estáticamente del módulo, mientras
// que el comportamiento de T se ejecuta desde el bundle público de pruebas.
const clavesDiccionario = new Set();
for (const mt of fuenteI18n.matchAll(/^  (['"])((?:\\.|(?!\1).)*)\1\s*:/gm)) {
  clavesDiccionario.add(mt[2].replace(/\\(['"\\n])/g, (_, c) => c === 'n' ? '\n' : c));
}

// Claves usadas: el primer argumento de cada T(, incluidos los ternarios.
const usadas = new Set();
for (let i = 0; (i = texto.indexOf('T(', i)) !== -1; i += 2) {
  if (/[A-Za-z0-9_$.]/.test(texto[i - 1] || '')) continue;
  let j = i + 2, prof = 1, q = null, arg = '';
  while (j < texto.length && prof > 0) {
    const c = texto[j];
    if (q) { if (c === '\\') { arg += c + texto[j + 1]; j += 2; continue; } if (c === q) q = null; }
    else if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === '(' || c === '[') prof++;
    else if (c === ')' || c === ']') { prof--; if (!prof) break; }
    else if (c === ',' && prof === 1) break;
    arg += c; j++;
  }
  for (const mt of arg.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) {
    const bruto = mt[1] !== undefined ? mt[1] : mt[2];
    usadas.add(bruto.replace(/\\(['"\\n])/g, (_, c) => c === 'n' ? '\n' : c));
  }
}
for (const mt of texto.matchAll(/area\((?:T\()?['"]([^'"]+)['"]\)?,\s*['"]((?:[^'"\\]|\\.)*)['"]/g)) { usadas.add(mt[1]); usadas.add(mt[2]); }
for (const par of CAPAS_ESTANDAR) for (const x of par) usadas.add(x);
for (const [, nombre, capas] of PLANTILLAS) { usadas.add(nombre); for (const par of capas) for (const x of par) usadas.add(x); }
for (const def of Object.values(PROVEEDORES)) { usadas.add(def.ayuda); usadas.add(def.modeloAyuda); }

const faltan = [...usadas].filter((k) => !clavesDiccionario.has(k));
const sobran = [...clavesDiccionario].filter((k) => !usadas.has(k));
console.log(`textos que pasan por T(): ${usadas.size}`);
faltan.forEach((k) => console.log('  SIN TRADUCIR  ' + JSON.stringify(k)));
sobran.forEach((k) => console.log('  YA NO SE USA  ' + JSON.stringify(k)));

// Los dos idiomas tienen que producir texto distinto y sustituir los valores.
const muestras = [['Abrir el mapa'], ['Filtros del mapa'], ['Borrar todo']];
const salida = {};
for (const idioma of ['es', 'en']) {
  global.__idioma = idioma;
  const { T } = cargar();
  salida[idioma] = muestras.map((m) => T(...m));
  console.log(`${idioma}: ${salida[idioma].join(' · ')}`);
}
const noTraduce = salida.es.filter((x, i) => x === salida.en[i] && !/^\d+$/.test(x));
if (noTraduce.length) console.log('  IGUAL EN LOS DOS IDIOMAS  ' + JSON.stringify(noTraduce));

const problemas = faltan.length + sobran.length + noTraduce.length;
console.log(problemas ? `✕ ${problemas} problema(s) de idioma` : '✓ idioma completo en inglés y español');
process.exit(problemas ? 1 : 0);
