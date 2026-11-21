import { readFileSync, writeFileSync } from 'node:fs';
import { projectStatus, publicModelCaveat } from '../public/project-cards.js';

const data = new URL('../public/data/projects.json', import.meta.url);
const page = new URL('../public/accuracy-review.html', import.meta.url);
const projects = new Map(
  JSON.parse(readFileSync(data, 'utf8')).map((row) => [row.id, row])
);
const requested = new Set(process.argv.slice(2));
if (!requested.size)
  throw new Error('Specify the project IDs whose public evidence changed.');

function escape(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const source = readFileSync(page, 'utf8');
const updated = source.replace(
  /<tr data-area="[^"]+"[^>]*>[\s\S]*?<\/tr>/g,
  (row) => {
    const id = row.match(/(?:&amp;|\?)project=([\w-]+)/)?.[1];
    if (!requested.has(id)) return row;
    const project = projects.get(id);
    const label = escape(projectStatus(project).label);
    const note = project.lifecycleNote || project.status || '';
    const detail =
      note && escape(note) !== label
        ? '<small>' + escape(note) + '</small>'
        : '';
    const notes = [project.geometryCoverage, publicModelCaveat(project)].filter(
      Boolean
    );
    requested.delete(id);
    return row
      .replace(/data-status="[^"]*"/, 'data-status="' + label + '"')
      .replace(
        /(<td data-label="Status">).*?(<\/td>)/s,
        (_, open, close) => open + label + detail + close
      )
      .replace(
        /(<td data-label="Sources">)\d+ linked sources?/,
        (_, open) => open + project.sources.length + ' linked sources'
      )
      .replace(
        /(<summary>Model notes<\/summary>).*?(<\/details>)/s,
        (_, open, close) =>
          open + notes.map((n) => '<p>' + escape(n) + '</p>').join('') + close
      );
  }
);
if (requested.size)
  throw new Error('Missing accuracy rows: ' + [...requested].join(', '));
writeFileSync(page, updated);
