// Post-build prerender: turns the marketing routes into real static HTML files.
//
// Runs AFTER `vite build` (client) and `vite build --ssr` (the prerender entry).
// For each combo it renders the page via the SSR bundle, injects the markup and
// the per-page <head> into the built index.html template, and writes
// dist/virtual-numbers/<country>/<service>/index.html — a real crawlable page.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '..');
const dist = join(clientRoot, 'dist');

const { render } = await import(pathToFileURL(join(clientRoot, 'dist-ssr', 'entry-prerender.js')).href);
const { getCombos } = await import(pathToFileURL(join(clientRoot, 'src', 'data', 'pseoContent.js')).href);

// The built index.html is the shell template (correct hashed asset tags, fonts,
// icons, PWA manifest, theme script, pixel). Strip the base SEO tags that each
// page overrides via Helmet so the prerendered <head> has no duplicate
// <title>/description/canonical/og.
function stripBaseSeo(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<meta\s+name="keywords"[^>]*>/i, '')
    .replace(/<link\s+rel="canonical"[^>]*>/i, '')
    .replace(/<meta\s+property="og:title"[^>]*>/i, '')
    .replace(/<meta\s+property="og:description"[^>]*>/i, '')
    .replace(/<meta\s+property="og:url"[^>]*>/i, '');
}

const template = stripBaseSeo(readFileSync(join(dist, 'index.html'), 'utf8'));

const routes = [
  '/virtual-numbers',
  ...getCombos().map((c) => `/virtual-numbers/${c.country}/${c.service}`),
];

let written = 0;
let skipped = 0;
for (const route of routes) {
  const { body, head } = await render(route);
  if (!body) {
    console.warn(`  skipped (empty render): ${route}`);
    skipped++;
    continue;
  }
  const page = template
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
    .replace('</head>', `${head}</head>`);
  const outDir = join(dist, route);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), page);
  written++;
}

console.log(`Prerendered ${written} marketing page(s)${skipped ? `, ${skipped} skipped` : ''}.`);
