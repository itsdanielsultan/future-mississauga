# Shared controls

The site uses the MIT-licensed **Basecoat 1.1.0** button, input and native-select
structures with the selected Vega skin. These are compiled from the pinned npm
package, rather than recreated as similar-looking local controls. Tailwind CSS
4.3.5 and PostCSS 8.5.32 are build tools only. No new JavaScript reaches visitors.

Official references:

- https://basecoatui.com/installation/
- https://basecoatui.com/customization/
- https://basecoatui.com/components/button/
- https://github.com/hunvreus/basecoat

Run `npm ci` and `npm run build:ui` to regenerate
`public/vendor/basecoat/controls.css`. The script reads these exact package files:

- `dist/components/button.css`
- `dist/components/input.css`
- `dist/components/native-select.css`
- `dist/styles/vega.css`, limited to those three components

It excludes field-wrapper aliases, other components, unused sizes and variants,
Tailwind Preflight and Basecoat's global base layer. It compiles the selected
rules and then namespaces every library and Tailwind property as `--ui-*`.
This prevents collisions with existing site variables such as `--accent`.
`public/vendor/basecoat/provenance.json` records the package source hashes,
generated stylesheet digest, actual byte/gzip sizes and zero runtime JavaScript.
The package MIT licence is copied alongside the stylesheet.

## Markup

```html
<button class="ui-button" data-variant="outline">Reset view</button>
<button class="ui-button" data-variant="ghost" data-size="icon"
        aria-label="Close preview"><svg aria-hidden="true">…</svg></button>
<a class="ui-button" data-variant="primary" href="…" download>Download</a>
<input class="ui-input" type="search" aria-label="Find a building">
<select class="ui-select" aria-label="Choose a neighbourhood">…</select>
```

The default button variant is primary. Supported variants are primary, outline
and ghost. Standard controls are 48px high; `data-size="icon"` makes a 44px square.
Controls use an 8px radius and 20px icons. Native selects remain native elements,
with their browser menus, keyboard support and existing event handlers intact.
Selects fill their layout cell without expanding it; long selected labels can
truncate visually while the native menu retains their full text. Pressed toggle
buttons have a pale-blue fill, darker blue text and a blue border.
The theme uses the existing Lato font, blue accent and slate text. It does not
change media, model colours or page composition.

The opt-in component selectors are unlayered and scoped to `html body`, with
four repeated component classes. Site sizing uses five repeated classes so it
wins over the skin's typed-input selectors. This is intentional compatibility
with the existing stylesheet stack. No element needs repeated classes in HTML.
`public/ui-consistency.css` handles page layout and exceptional controls after
this stylesheet. ID-specific existing rules still need to be reconciled there.
Do not apply these classes to image triggers, comparison dividers, film custom
elements or other controls whose dimensions have a different purpose.

Changing the component package or compiler requires regenerating the stylesheet
and checking desktop/mobile controls, focus, native selects, image/PDF previews
and map search. The build refuses unscoped selectors and uncompiled directives.
