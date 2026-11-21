import {readFile, readdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const pages = fileURLToPath(new URL('../public/', import.meta.url));
const links = [
  ['about.html', 'About'],
  ['suggestions.html', 'Suggestions'],
  ['downloads.html', 'Downloads'],
  ['sources.html', 'Sources']
];

for (const name of await readdir(pages)) {
  if (!name.endsWith('.html')) continue;
  const path = pages + name;
  const html = await readFile(path, 'utf8');
  const navigation = links.map(([href,label]) => {
    const active = href === name ? ' aria-current="page"' : '';
    return '<a href="'+href+'"'+active+'>'+label+'</a>';
  }).join('');
  // Keep the map's conditional attribution and each edition's required notices.
  const footer = /(<footer class="compact-footer"><div class="footer-identity">[\s\S]*?<\/div>)[\s\S]*?(<p class="footer-attribution">)/g;
  let matches=0;
  const updated = html.replace(footer,(_,identity,credit) => {
    matches++;
    return identity+'<nav class="footer-links" aria-label="Project information">'+navigation+'</nav>'+credit;
  });
  if (matches!==1) throw Error('Expected one site footer in '+name);
  if (html!==updated) await writeFile(path,updated);
}
