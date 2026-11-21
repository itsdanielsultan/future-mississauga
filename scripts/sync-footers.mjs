import {readFile, readdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const pages = fileURLToPath(new URL('../public/', import.meta.url));
const publicOrigin = 'https://futuremississauga.com/';
const destinations = [
  ['neighbourhoods.html', 'places', 'Neighbourhoods'],
  ['model.html', 'buildings', 'Buildings'],
  ['compare.html', 'compare', 'Compare'],
  ['gallery.html', 'gallery', 'Gallery'],
  ['updates.html', 'updates', 'Updates'],
  ['downloads.html', 'downloads', 'Downloads'],
  ['sources.html', 'sources', 'Sources'],
  ['contact.html', 'contact', 'Contact']
];

const navigation = /(<nav class="site-nav"[^>]*>)([\s\S]*?)(<\/nav>)/;
const siteFooter = /(<footer class="compact-footer"><div class="footer-identity">[\s\S]*?<\/div>)[\s\S]*?(<p class="footer-attribution">[\s\S]*?<\/p>)(<\/footer>)/;
const sitemap = [];
for (const name of (await readdir(pages)).sort()) {
  if (!name.endsWith('.html')) continue;
  const path = pages + name;
  const html = await readFile(path, 'utf8');
  if (!navigation.test(html) || !siteFooter.test(html)) throw Error('Missing site header or footer: ' + name);
  let updated = html.replace(navigation, (_, opening, existing, closing) => {
    const section = destinations.find(([href]) => href === name)?.[1]
      ?? (['about.html','suggestions.html'].includes(name) ? 'contact' : undefined)
      ?? existing.match(/data-section="([^"]+)"[^>]*aria-current="(?:page|location)"/)?.[1];
    const links = destinations.map(([href, key, label]) => {
      const active = key === section ? ' aria-current="' + (href === name ? 'page' : 'location') + '"' : '';
      return '<a href="'+href+'" data-section="'+key+'"'+active+'>'+label+'</a>';
    });
    return opening + links.join('') + closing;
  }).replace(siteFooter, (_, identity, attribution, closing) => {
    // The map has a conditional OpenStreetMap credit. Preserve it, along with each page's licence text.
    return identity + attribution.replace(' · <a href="sources.html#data">Data licences</a>', '') + closing;
  });

  // Give keyboard visitors a predictable landing point after the skip link.
  updated = updated.replace(/<main\b(?=[^>]*\bid="main")(?![^>]*\btabindex=)([^>]*)>/, '<main$1 tabindex="-1">');
  const route = name === 'index.html' ? '' : name;
  const canonicalURL = publicOrigin + route;
  if (!/<link\b(?=[^>]*\brel="canonical")[^>]*>/i.test(updated))
    updated = updated.replace('</head>', '<link rel="canonical" href="'+canonicalURL+'"></head>');
  const canonical = updated.match(/<link\b(?=[^>]*\brel="canonical")[^>]*>/i)?.[0].match(/\bhref="([^"]+)"/)?.[1];
  const exclude = /<meta\b(?=[^>]*\bname="robots")(?=[^>]*\bcontent="[^"]*noindex)[^>]*>/i.test(updated);
  if (canonical === canonicalURL && !exclude) sitemap.push(canonical);
  if (updated !== html) await writeFile(path, updated);
}
sitemap.sort((a,b) => a === publicOrigin ? -1 : b === publicOrigin ? 1 : a.localeCompare(b,'en'));
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + sitemap.map(url => '  <url><loc>'+url+'</loc></url>').join('\n') + '\n</urlset>\n';
const sitemapPath = pages + 'sitemap.xml';
if (await readFile(sitemapPath,'utf8') !== xml) await writeFile(sitemapPath,xml);
