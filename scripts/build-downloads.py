"""Refresh the public downloads page from the active publication's PDF catalogue."""
import json
import re
from html import escape
from pathlib import Path

PUBLIC = Path(__file__).resolve().parents[1] / "public"
catalogue = json.loads((PUBLIC / "data/document-previews-20261120.json").read_text())
atlas = catalogue["documents"][-1]
directory = Path(atlas["url"]).parent
studies = [row for row in catalogue["documents"] if Path(row["url"]).parent == directory and row != atlas]


def action(url, text, *, name, download=False, preview=False):
    attributes = ' download data-download' if download else ' data-document-preview aria-haspopup="dialog"' if preview else ''
    return (f'<a class="download-action" href="{escape(url)}"{attributes} aria-label="{escape(name)}">'
            f'{escape(text)}<span aria-hidden="true">{"↓" if download else "→"}</span></a>')


def listing(title, info, actions):
    return (f'<li class="download-row"><div class="download-name"><h3>{escape(title)}</h3>'
            f'<p>{escape(info)}</p></div><div class="download-actions">{actions}</div></li>')


cover = atlas["base"] + atlas["prefix"] + "01.avif"
parts = ['<main id="main" class="downloads-main"><header><h1>Downloads</h1></header>',
         '<article class="download-atlas">',
         f'<a class="download-cover" href="{atlas["url"]}" data-document-preview aria-label="Preview the complete atlas"><img src="{cover}" width="{atlas["width"]}" height="{atlas["height"]}" alt="Cover of the Mississauga atlas"></a>',
         '<div class="download-lead"><h2>City and neighbourhood atlas</h2>',
         f'<p>{atlas["pages"]} pages of city views in one PDF.</p><div class="download-actions">',
         action(atlas["url"],"Preview",name="Preview the complete atlas",preview=True),
         action(atlas["url"],"Download PDF",name="Download the complete atlas PDF",download=True),
         '</div></div></article>',
         '<section id="downtown" aria-labelledby="downtown-title"><h2 id="downtown-title">Downtown prints and film</h2><ul>']
for scenario, title in [('existing', 'Existing buildings'), ('future', 'With proposals')]:
    image = f'gallery/{directory.name}/originals/home-downtown-{scenario}-print.png'
    pdf = f'{directory}/Downtown-{scenario}-print.pdf'
    parts.append(listing(title, "Square One · single print",
                 action(image,"PNG",name=f"Download {title} as PNG",download=True)
                 + action(pdf,"PDF",name=f"Download {title} as a print PDF",download=True)))
film = 'gallery/' + directory.name + '/Downtown-film.mp4'
film_info = json.loads((PUBLIC / 'data/downtown-film-20261120.json').read_text())
parts += [listing("Skyline film",f'Downtown · {film_info["durationSeconds"]} seconds',action("film.html","Watch",name="Watch the skyline film")
                  + action(film,"MP4",name="Download the skyline film as MP4",download=True)),
          '</ul></section><section id="building-studies" aria-labelledby="studies-title"><h2 id="studies-title">Building studies</h2><ul>']
study_details = {"square-one-block22-": "2021 design study", "st-hilarys-anglican-church-": "Roof study"}
for doc in studies:
    detail = study_details.get(doc["prefix"])
    metadata = f'{doc["pages"]} pages' + (' · ' + detail if detail else '')
    parts.append(listing(doc["title"], metadata,
                 action(doc["url"],"Preview",name="Preview " + doc["title"],preview=True)
                 + action(doc["url"],"PDF",name="Download " + doc["title"] + " PDF",download=True)))
parts += ['</ul></section></main>']
page = PUBLIC / "downloads.html"
updated, count = re.subn(r'<main\b[^>]*>.*?</main>',lambda _: '\n'.join(parts),page.read_text(),count=1,flags=re.S)
if count != 1:
    raise ValueError("Missing downloads page content")
page.write_text(updated)
