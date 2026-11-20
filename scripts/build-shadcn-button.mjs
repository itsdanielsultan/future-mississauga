import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { compile, optimize } from '@tailwindcss/node';
import postcss from 'postcss';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'public/vendor/shadcn');
const recipe = JSON.parse(await readFile(join(root, 'styles/registry/shadcn-button.json'), 'utf8'));
const license = (await readFile(join(output, 'LICENSE.txt'), 'utf8')).trim();
const buttons = [
  { selectors: ['.site-map-action', '#showAllPictures:not([hidden])', '#showAllBuildings:not([hidden])'], variant: 'outline' },
  { selectors: ['#interactButton:not([hidden])'], variant: 'default' },
  { selectors: ['.profile-actions .profile-action'], variant: 'ghost' },
];
const targets = buttons.flatMap(group => group.selectors).join(', ');
const input = `
  @reference "tailwindcss";
  @custom-variant dark (&:where(.dark, .dark *));
  @theme inline {
    --color-primary: var(--ink, #182023);
    --color-primary-foreground: var(--paper, #f7f7f3);
    --color-background: var(--panel, #fff);
    --color-accent: var(--site-accent-soft, #f4e9e6);
    --color-accent-foreground: var(--ink, #182023);
    --color-input: var(--line, #cdd3cf);
    --color-ring: var(--brand, #923b31);
    --color-destructive: #a73636;
  }
  ${targets} { @apply ${recipe.base} ${recipe.sizes.default}; }
  ${buttons.map(({selectors, variant}) => `${selectors.join(', ')} { @apply ${recipe.variants[variant]}; }`).join('\n')}
  ${targets} {
    min-height: 44px;
    text-decoration: none;
  }
  @media (prefers-reduced-motion: reduce) {
    ${targets} { transition: none; }
  }
`;
const compiler = await compile(input, { base: root, onDependency() {} });
const compiled = optimize(compiler.build([]), { minify: true }).code;
const parsed = postcss.parse(compiled);
// Tailwind emits a reset for internal variables on older browsers. Confine it
// to these controls so an independently embedded viewer retains its own state.
parsed.walkAtRules('layer', layer => {
  if (layer.params === 'properties') {
    layer.walkRules(rule => { rule.selector = `:where(${targets})`; });
  }
});
const css = `/*! ${license} */\n${parsed.toString().replaceAll('--tw-', '--atlas-button-')}\n`;
await mkdir(output, { recursive: true });
await writeFile(join(output, 'button.css'), css);
const proof = {
  component: 'Button', style: 'new-york-v4', registry: recipe.registry, upstreamFile: recipe.component,
  license: 'MIT', upstreamLicense: 'https://github.com/shadcn-ui/ui/blob/main/LICENSE.md',
  adaptation: 'Button class and variant recipes compiled for static HTML anchors and buttons.',
  compiler: `tailwindcss ${JSON.parse(await readFile(join(root, 'node_modules/tailwindcss/package.json'))).version}`,
  build: 'npm run build:ui', controls: buttons, sha256: createHash('sha256').update(css).digest('hex'),
  runtimeJavaScriptBytes: 0,
};
await writeFile(join(output, 'provenance.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(`shadcn/ui Button: ${Buffer.byteLength(css)} bytes, no client JavaScript.`);
