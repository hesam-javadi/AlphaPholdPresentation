// Fold a Vite build into a single self-contained index.html (scripts and styles inline).
// Browsers refuse to load module scripts from file://, but inline ones run fine, so the
// result opens straight from disk on any computer with a modern browser — no server needed.
// Usage: node tools/inline.mjs dist-offline
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] ?? 'dist-offline';
const htmlPath = path.join(dir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const read = (src) => fs.readFileSync(path.join(dir, src.replace(/^\.\//, '')), 'utf8');

html = html.replace(/<script type="module"[^>]*\ssrc="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  // A literal "</script" inside the code would end the tag early.
  const js = read(src).replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet"[^>]*\shref="([^"]+)"[^>]*>/g, (_, href) => `<style>${read(href)}</style>`);

const left = html.match(/(?:src|href)="\.?\/?assets\/[^"]+"/g);
if (left) {
  console.error('Not inlined:', left);
  process.exit(1);
}
fs.writeFileSync(htmlPath, html);
fs.rmSync(path.join(dir, 'assets'), { recursive: true, force: true });
console.log(`${htmlPath}: ${(fs.statSync(htmlPath).size / 1e6).toFixed(1)} MB, self-contained`);
