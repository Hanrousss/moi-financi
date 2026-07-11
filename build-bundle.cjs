const fs = require('fs');
const path = require('path');

const root = __dirname;

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

function stripExports(source) {
  return source
    .replace(/^export\s+(?=(?:async\s+)?(?:const|let|var|function|class)\b)/gm, '')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
}

function stripImports(source) {
  return source.replace(/^import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];\s*/gm, '');
}

const bundle = [
  '// Generated fallback bundle for file:// and simple static hosting.',
  '// Source files: model.js, storage.js, app.js',
  stripExports(read('model.js')),
  stripExports(read('storage.js')),
  stripImports(read('app.js'))
].join('\n\n');

fs.writeFileSync(path.join(root, 'app.bundle.js'), bundle, 'utf8');
console.log('Built app.bundle.js');
