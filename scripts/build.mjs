// Bundles the game into one self-contained HTML file: dist/wortkonfekt.html.
// The modules are concatenated in dependency order with import/export lines
// removed, inside one function scope.
//   node scripts/build.mjs             → dist/wortkonfekt.html (full page)
//   node scripts/build.mjs --fragment  → page body only, for hosts that add <html>/<head>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['util', 'lexicon', 'grammar', 'english', 'solver', 'board', 'engine', 'levels', 'audio', 'game', 'app', 'main'];
const fragment = process.argv.includes('--fragment');

const seen = new Map();
const parts = ORDER.map(name => {
  const src = readFileSync(join(root, 'js', `${name}.js`), 'utf8');
  if (/^export\s*\{/m.test(src) || /^import\s*\{[^}]*$/m.test(src)) throw new Error(`${name}.js: use single-line imports and inline exports`);
  const body = src.replace(/^import .*;\s*$/gm, '').replace(/^export (?=(async )?function|const|let|class)/gm, '');
  for (const m of body.matchAll(/^(?:async )?(?:function\*?|const|let|class) ([\w$]+)/gm)) {
    if (seen.has(m[1])) throw new Error(`Top-level name «${m[1]}» is declared in both ${seen.get(m[1])}.js and ${name}.js`);
    seen.set(m[1], name);
  }
  return `// ---- ${name}.js\n${body}`;
});

const css = readFileSync(join(root, 'css', 'style.css'), 'utf8');
const js = `(() => {\n'use strict';\n${parts.join('\n')}\n})();`;
const head = `<title>Wortkonfekt</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="A candy-style match game for learning German: link falling word tiles into correct sentences.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Shrikhand&display=swap">
<style>
${css}
</style>`;
const body = `<main id="app"></main>
<script>
${js}
</script>`;

const html = fragment
  ? `${head}\n${body}\n`
  : `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body data-screen="map">
${body}
</body>
</html>
`;

const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) || join(root, 'dist', fragment ? 'wortkonfekt.fragment.html' : 'wortkonfekt.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
