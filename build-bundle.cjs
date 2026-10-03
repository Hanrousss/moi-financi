const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
  "'use strict';",
  '// Generated fallback bundle for file:// and simple static hosting.',
  '// Source files: model.js, storage.js, app.js',
  stripExports(read('model.js')),
  stripExports(read('storage.js')),
  stripImports(read('app.js'))
].join('\n\n');

// The actual production entry is the committed bundle, not the source modules.
// Fail the build before writing it if source syntax or release assets disagree.
new vm.Script(bundle, {filename:'app.bundle.js'});
new vm.Script(read('sw.js'), {filename:'sw.js'});
const version=read('app.js').match(/const APP_BUILD='([^']+)'/)?.[1];
if(!version||!read('index.html').includes(`app.bundle.js?v=${version}`)||!read('index.html').includes(`styles.css?v=${version}`)||!read('sw.js').includes(`private-v${version}`)||!read('sw.js').includes(`app.bundle.js?v=${version}`)||!read('sw.js').includes(`styles.css?v=${version}`)){
  throw new Error('APP_BUILD, HTML assets and service worker must have the same version');
}
const core=read('sw.js').match(/const CORE=(\[[^;]+\]);/)?.[1];
if(!core)throw new Error('Service worker CORE is missing');
for(const asset of vm.runInNewContext(core)){
  const name=asset.split('?')[0];
  if(!fs.existsSync(path.join(root,name)))throw new Error(`Missing offline asset: ${asset}`);
}
const manifest=JSON.parse(read('manifest.webmanifest'));
for(const entry of manifest.icons||[]){
  if(!fs.existsSync(path.join(root,entry.src)))throw new Error(`Missing manifest icon: ${entry.src}`);
}
fs.writeFileSync(path.join(root, 'app.bundle.js'), bundle, 'utf8');
console.log('Built app.bundle.js');
