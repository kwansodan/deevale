import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const BASE_URL = 'https://www.deevalegh.com'
const today = new Date().toISOString().slice(0, 10)

// Extract guide slugs from src/data/guidesData.ts
const guidesFilePath = path.join(rootDir, 'src', 'data', 'guidesData.ts')
let guideSlugs = []

try {
  const content = fs.readFileSync(guidesFilePath, 'utf-8')
  const matches = [...content.matchAll(/slug:\s*["']([^"']+)["']/g)]
  guideSlugs = matches.map(m => m[1])
} catch (err) {
  console.warn('[sitemap-generator] Could not read guidesData.ts:', err.message)
}

// Extract service slugs from src/data/servicesData.ts
const servicesFilePath = path.join(rootDir, 'src', 'data', 'servicesData.ts')
let serviceSlugs = []

try {
  const content = fs.readFileSync(servicesFilePath, 'utf-8')
  const matches = [...content.matchAll(/slug:\s*["']([^"']+)["']/g)]
  serviceSlugs = matches.map(m => m[1])
} catch (err) {
  console.warn('[sitemap-generator] Could not read servicesData.ts:', err.message)
}

const routes = [
  { path: '', changefreq: 'daily', priority: '1.0' },
  { path: 'calculator', changefreq: 'weekly', priority: '0.95' },
  { path: 'services', changefreq: 'weekly', priority: '0.90' },
  ...serviceSlugs.map(slug => ({
    path: `services/${slug}`,
    changefreq: 'monthly',
    priority: '0.88',
  })),
  { path: 'guides', changefreq: 'weekly', priority: '0.90' },
  ...guideSlugs.map(slug => ({
    path: `guides/${slug}`,
    changefreq: 'monthly',
    priority: '0.85',
  })),
  { path: 'signup', changefreq: 'monthly', priority: '0.80' },
  { path: 'login', changefreq: 'yearly', priority: '0.40' },
  { path: 'legal/terms', changefreq: 'yearly', priority: '0.30' },
  { path: 'legal/privacy', changefreq: 'yearly', priority: '0.30' },
  { path: 'legal/refund', changefreq: 'yearly', priority: '0.30' },
]

const urlsXml = routes
  .map(
    route => `  <url>
    <loc>${BASE_URL}/${route.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join('\n')

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlsXml}
</urlset>
`

const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml')
fs.writeFileSync(sitemapPath, sitemapXml, 'utf-8')
console.log(`[sitemap-generator] Generated ${routes.length} URLs in ${sitemapPath}`)
