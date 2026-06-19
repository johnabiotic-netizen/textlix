// Build-time sitemap generator. Runs after the prerender step and writes
// dist/sitemap.xml covering: static marketing routes, every blog post, the
// /virtual-numbers hub, and all country×service landing pages.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '..');
const dist = join(clientRoot, 'dist');
const SITE = 'https://www.textlix.com';

const { getCombos } = await import(pathToFileURL(join(clientRoot, 'src', 'data', 'pseoContent.js')).href);

// Blog slugs live in BlogPage.jsx as `slug: '...'` — pull them out without
// importing the JSX module.
const blogSrc = readFileSync(join(clientRoot, 'src', 'pages', 'public', 'BlogPage.jsx'), 'utf8');
const blogSlugs = [...blogSrc.matchAll(/slug:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

const staticRoutes = [
  '/',
  '/virtual-numbers',
  '/pricing',
  '/about',
  '/docs',
  '/faq',
  '/support',
  '/terms',
  '/privacy',
  '/blog',
];

const urls = [
  ...staticRoutes,
  ...blogSlugs.map((s) => `/blog/${s}`),
  ...getCombos().map((c) => `/virtual-numbers/${c.country}/${c.service}`),
];

const body = urls
  .map((u) => `  <url>\n    <loc>${SITE}${u}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`)
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(dist, 'sitemap.xml'), xml);
console.log(`Sitemap written: ${urls.length} URLs (${blogSlugs.length} blog, ${getCombos().length} landing pages).`);
