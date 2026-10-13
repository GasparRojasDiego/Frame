// Comprueba el diccionario inglés (src/lib/i18n-en.ts) contra el código:
//
//   · claves que el código pide con tr()/trc() y el diccionario no tiene
//     (en inglés se verían en español: es el fallo que no puede ocurrir);
//   · mensajes del núcleo nativo (Rust y, en Android, Kotlin) que pueden
//     llegar a la interfaz y el diccionario no tiene: errorText() los traduce
//     si están, exactos o con la forma «Prefijo: {e}»;
//   · entradas que ya nadie usa (sobran: pesan y confunden);
//   · traducciones cuyas variables {así} no coinciden con las del español.
//
// Las llamadas con un argumento que no es un literal (tr(item)) no se pueden
// resolver aquí: una entrada cuenta como usada si su texto aparece como
// cadena en cualquier parte del código. Uso: node scripts/comprobar-idioma.mjs
// Sale con código 1 si falta alguna clave o alguna variable no coincide.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const DICTIONARY = path.join(root, 'src/lib/i18n-en.ts');

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name) && full !== DICTIONARY) files.push(full);
  }
})(path.join(root, 'src'));

const literal = (node) => {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return literal(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const [a, b] = [literal(node.left), literal(node.right)];
    return a !== null && b !== null ? a + b : null;
  }
  return null;
};

const wanted = new Map(); // clave → primer lugar donde se pide
const strings = new Set(); // toda cadena literal del código
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const visit = (node) => {
    const value = literal(node);
    if (value !== null) strings.add(value);
    if (ts.isJsxText(node)) strings.add(node.text.trim());
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['tr', 'trc'].includes(node.expression.text)) {
      const withContext = node.expression.text === 'trc';
      const key = literal(node.arguments[withContext ? 1 : 0]);
      const context = withContext ? literal(node.arguments[0]) : '';
      if (key !== null && context !== null) {
        const full = withContext ? `${context}|${key}` : key;
        if (!wanted.has(full)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          wanted.set(full, `${rel}:${line + 1}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// ---- Mensajes del núcleo nativo ----
const nativeFiles = [];
for (const dir of ['src-tauri/src', 'src-tauri/gen/android/app/src/main/java']) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'generated') walk(f);
      } else if (/\.(rs|kt)$/.test(entry.name)) nativeFiles.push(f);
    }
  })(full);
}
const SPANISH_TEXT = /[áéíóúñ¿¡]|\b(no|se|de|la|el|los|las|del|que|para|por|con|sin|ya|un|una|es|ilegible|archivo|carpeta|informe|adjunto)\b/i;
const NATIVE_CALL = /Err\(|reject\(|settle\(|format!\(|\.into\(\)|super\(|Error::|map_err\(|\.to_string\(\)|ifBlank|^\s*"/;
const nativeWanted = new Map();
for (const file of nativeFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  fs.readFileSync(file, 'utf8')
    // ui("es", "en") ya sale traducido del propio núcleo (aunque ocupe varias líneas).
    .replace(/\bui\(\s*"(?:[^"\\]|\\.)*"\s*,\s*"(?:[^"\\]|\\.)*"\s*,?\s*\)/g, 'ui()')
    .split(/\r?\n/)
    .forEach((line, index) => {
      const code = line.replace(/^\s*\/\/.*$/, '');
      // Lo que pasa por ui(es, en) ya sale traducido del propio núcleo.
      if (!NATIVE_CALL.test(code) || /println!|eprintln!|log::|Log\.[dwie]\(|\bui\(/.test(code)) return;
      for (const match of code.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
        let text = match[1].replace(/\\"/g, '"');
        if (!text.includes(' ') || !SPANISH_TEXT.test(text) || text.includes('$')) continue;
        text = text.replace(/\{[a-z_]*\}/g, '{e}');
        // errorText() solo entiende el detalle al final: «Prefijo: {e}».
        if (text.includes('{e}') && !/^[^{]+: \{e\}$/.test(text)) continue;
        if (!nativeWanted.has(text)) nativeWanted.set(text, `${rel}:${index + 1}`);
      }
    });
}

const dictionarySource = ts.createSourceFile(DICTIONARY, fs.readFileSync(DICTIONARY, 'utf8'), ts.ScriptTarget.Latest, true);
const english = new Map();
dictionarySource.forEachChild(function find(node) {
  if (ts.isPropertyAssignment(node)) {
    const key = literal(node.name);
    const value = literal(node.initializer);
    if (key !== null && value !== null) english.set(key, value);
    return;
  }
  ts.forEachChild(node, find);
});

const variables = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const missing = [...wanted].filter(([key]) => !english.has(key) && !english.has(key.split('|').pop()));
const missingNative = [...nativeWanted].filter(([key]) => !english.has(key));
const mismatched = [...english].filter(([key, value]) => variables(key.split('|').pop()) !== variables(value));
const unused = [...english.keys()].filter((key) => {
  if (wanted.has(key) || nativeWanted.has(key)) return false;
  const [context, text] = key.includes('|') ? key.split('|') : [null, key];
  if ([...wanted.keys()].some((w) => w.endsWith(`|${key}`))) return false;
  return !(strings.has(text) && (context === null || strings.has(context)));
});

const report = (title, lines) => {
  if (!lines.length) return;
  console.log(`\n${title} (${lines.length}):`);
  for (const line of lines) console.log(`  ${line}`);
};
report('Sin traducir', missing.map(([key, where]) => `${JSON.stringify(key)}  ← ${where}`));
report('Sin traducir (núcleo nativo)', missingNative.map(([key, where]) => `${JSON.stringify(key)}  ← ${where}`));
report('Variables que no coinciden', mismatched.map(([key, value]) => `${JSON.stringify(key)} → ${JSON.stringify(value)}`));
report('Entradas sin uso', unused.map((key) => JSON.stringify(key)));
console.log(
  `\n${wanted.size} claves en el código · ${nativeWanted.size} mensajes nativos · ${english.size} en el diccionario · ` +
    `${missing.length + missingNative.length} sin traducir · ${unused.length} sin uso`
);
process.exit(missing.length || missingNative.length || mismatched.length ? 1 : 0);
