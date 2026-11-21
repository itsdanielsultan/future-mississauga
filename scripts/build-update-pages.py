"""Build the daily Updates index and its permanent, directly readable stories."""
from datetime import date
from html import escape
from itertools import groupby
from pathlib import Path
import json
import re

from update_homepage import update_homepage

repo = Path(__file__).resolve().parents[1]
public = repo / 'public'
origin = 'https://futuremississauga.com/'
arrow = '<svg class="journal-arrow" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>'
back = arrow.replace('class="journal-arrow"', 'class="journal-arrow journal-left"')
old_ids = {'2026-11-01':['earlier-studies','earlier-studies-title','latestNotes','latestNotesTitle','latestNotesDate']}


def e(value):
    return escape(str(value), quote=True)


def filename(day):
    return 'update-' + day['date'] + '.html'


def calendar(day):
    return date.fromisoformat(day['date'])


def date_text(day):
    d = calendar(day)
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def date_tag(day, short=False):
    d = calendar(day)
    label = f"{d.strftime('%b')} {d.day}" if short else date_text(day)
    return f'<time datetime="{d.isoformat()}">{label}</time>'


def alias(id_, target=''):
    jump = f' data-story-jump="{e(target)}"' if target else ''
    return f'<span class="journal-anchor" id="{e(id_)}"{jump}></span>'


def links(items):
    if not items:
        return ''
    result = []
    for item in items:
        doc = ' data-document-preview aria-haspopup="dialog"' if item.get('preview') else ''
        result.append(f'<a href="{e(item["url"])}"{doc}>{e(item["label"])}{arrow}</a>')
    return '<div class="journal-links">' + ''.join(result) + '</div>'


def picture(record):
    if 'picture' not in record:
        return ''
    caption = f'<figcaption>{e(record["caption"])}</figcaption>' if record.get('caption') else ''
    return '<figure class="journal-figure">' + record['picture'] + caption + '</figure>'


def story_record(record, tag, lead=False):
    anchor = f' id="{e(record["id"])}"' if record.get('id') else ''
    paragraphs = ''.join(f'<p>{p}</p>' for p in record.get('paragraphs', []))
    if record.get('text'):
        paragraphs = '<p>' + e(record['text']) + '</p>' + paragraphs
    image = picture(record)
    heading = f'<h2>{e(record["heading"])}</h2>'
    body = (image + heading + paragraphs) if lead else (heading + paragraphs + image)
    return f'<{tag} class="journal-record"{anchor}>' + body + links(record.get('links', [])) + f'</{tag}>'


def page_shell(name, title, description, content, listing=False, share=None):
    homepage = (public / 'index.html').read_text()
    template = (public / 'about.html').read_text()
    header = re.search(r'<header class="site-header".*?</header>', homepage, re.S).group()
    header = re.sub(r' aria-current="(?:page|location)"', '', header)
    active = 'page' if listing else 'location'
    header = header.replace('data-section="updates"', f'data-section="updates" aria-current="{active}"')
    footer = re.search(r'<footer\b.*?</footer>', homepage, re.S).group()
    styles = [m.group() for m in re.finditer(r'<link\b[^>]*>', template)
              if 'rel="stylesheet"' in m.group() and not any(s in m.group() for s in ('updates.css', 'reading-rail.css', 'project-desk.css'))]
    section = json.loads((public / 'data/edition-shares.json').read_text())['updates']
    social = share or {**section, 'alt':'The City Centre area of the Downtown model','type':'image/jpeg'}
    doc_title = e(title + ' | Future Mississauga')
    css = '\n'.join(styles)
    rail_css = '<link rel="stylesheet" href="reading-rail.css?v=20261120-rail">' if listing else ''
    rail_js = '<script type="module" src="reading-rail.js?v=20261120-rail"></script>' if listing else ''
    ui = re.search(r'<script\b[^>]*src="site-ui\.js[^"]*"[^>]*></script>', homepage).group()
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{doc_title}</title><meta name="description" content="{e(description)}">
<link rel="canonical" href="{origin}{e(name)}"><link rel="icon" type="image/svg+xml" href="assets/favicon.svg?v=transparent1">
<meta property="og:type" content="{'website' if listing else 'article'}"><meta property="og:title" content="{doc_title}"><meta property="og:description" content="{e(description)}"><meta property="og:url" content="{origin}{e(name)}"><meta property="og:image" content="{origin}{e(social['url'])}"><meta property="og:image:alt" content="{e(social['alt'])}"><meta property="og:image:width" content="{int(social['width'])}"><meta property="og:image:height" content="{int(social['height'])}"><meta property="og:image:type" content="{e(social['type'])}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{doc_title}"><meta name="twitter:image" content="{origin}{e(social['url'])}"><meta name="twitter:image:alt" content="{e(social['alt'])}">
{css}
<link rel="stylesheet" href="journal.css?v=20261120-days">{rail_css}<script src="image-entry.js?v=20261120-plates"></script>
</head><body class="reading-page journal-page"><a class="site-skip" href="#main">Skip to content</a>{header}
{content}
{footer}
{ui}{rail_js}<script type="module" src="journal-history.js?v=20261120-return3"></script>
</body></html>
"""


def listing_page(days):
    rail, months = [], []
    years = {calendar(day).year for day in days}
    newest_year = max(years)
    for (year, month), group in groupby(days, lambda day: (calendar(day).year, calendar(day).month)):
        entries = list(group)
        month_name = calendar(entries[0]).strftime('%B')
        label = f'{month_name} {year}'
        rail.append(f'<p data-rail-month>{label}</p>')
        old_month = ('month-' + month_name.lower()) if year == newest_year else None
        month_anchor = alias(old_month) if old_month else ''
        if year == 2026 and month == 10:
            month_anchor += alias('october-2026') + alias('october-title')
        cards = []
        for day in entries:
            d = calendar(day)
            stamp = d.isoformat()
            rail.append(f'<a href="#day-{stamp}" aria-label="{date_text(day)}">{month_name} {d.day}</a>')
            ids = [*old_ids.get(stamp, []), *(r['id'] for r in day['records'] if r.get('id'))]
            anchors = ''.join(alias(id_, filename(day) + '#' + id_) for id_ in dict.fromkeys(ids))
            cover = day.get('cardImage')
            img = f'<img class="journal-thumb" src="{e(cover)}" width="100" height="74" alt="" loading="lazy" decoding="async">' if cover else ''
            cards.append(f'''<li class="journal-day" id="day-{stamp}">{anchors}<a class="journal-card" href="{filename(day)}">
{date_tag(day, True)}<div class="journal-card-copy"><h3>{e(day['title'])}</h3><p>{e(day['summary'])}</p></div>{img}{arrow}</a></li>''')
        months.append(f'<section class="journal-month" aria-labelledby="month-{year}-{month:02}">{month_anchor}<h2 id="month-{year}-{month:02}">{label}</h2><ol>{"".join(cards)}</ol></section>')
    return page_shell('updates.html', 'Updates', 'Follow changes to the city model, one date at a time.',
        f'''<main id="main" class="publication journal-index" data-publication="updates" tabindex="-1">
<header class="publication-heading">{alias('project-timeline')}{alias('edition-notes')}<h1>Updates</h1></header>
<div class="journal-layout"><nav data-reading-rail data-rail-label="Date" aria-label="Update dates"><div data-rail-viewport><div data-rail-track>{''.join(rail)}</div></div></nav>
<div class="journal-months">{''.join(months)}</div></div></main>''', listing=True)


def story_page(day, newer, older):
    stamp = day['date']
    aliases = ''.join(alias(item) for item in old_ids.get(stamp, []))
    main_records = [*day['details'], *day['records']]
    lead = next((record for record in main_records if record.get('picture')), None)
    art = day.get('illustration')
    intro_picture = ''
    if art:
        intro_picture = (f'<figure class="journal-figure journal-intro-figure"><img src="{e(art["image"])}" '
                         f'width="{art["width"]}" height="{art["height"]}" alt="{e(art["alt"])}" '
                         f'decoding="async"><figcaption>{e(art["caption"])}</figcaption></figure>')
    if lead:
        main_records = [lead, *(record for record in main_records if record is not lead)]
    blocks = intro_picture + ''.join(story_record(record, 'section', record is lead) for record in main_records)
    neighbours = []
    for sibling, direction in [(newer, 'Newer update'), (older, 'Older update')]:
        if sibling:
            neighbours.append(f'<a href="{filename(sibling)}"><span>{direction} · {date_tag(sibling, True)}</span><strong>{e(sibling["title"])}</strong>{arrow}</a>')
    next_pages = '<nav class="journal-neighbours" aria-label="Nearby dates">' + ''.join(neighbours) + '</nav>' if neighbours else ''
    content = f'''<main id="main" class="publication journal-article" data-publication="update-story" tabindex="-1"><article>
<a class="journal-back" data-updates-back href="updates.html#day-{stamp}">{back}Back to updates</a>
<header class="journal-title">{aliases}{date_tag(day)}<h1>{e(day['title'])}</h1><p>{e(day['summary'])}</p></header>
<div class="journal-report">{blocks}</div>{links(day['links'])}{next_pages}</article></main>'''
    return page_shell(filename(day),day['title'],day['summary'], content, share=day.get('share'))


def main():
    days = sorted(json.loads((repo / 'scripts/editions/updates/days.json').read_text()), key=calendar, reverse=True)
    dates = [day['date'] for day in days]
    if len(dates) != len(set(dates)):
        raise ValueError('Each documented date needs one daily update')
    for index, day in enumerate(days):
        if not day['records'] and not day['details']:
            raise ValueError(day['date'] + ' needs a documented story')
        newer = days[index - 1] if index else None
        older = days[index + 1] if index + 1 < len(days) else None
        (public / filename(day)).write_text(story_page(day, newer, older))
    (public / 'updates.html').write_text(listing_page(days))
    update_homepage(public, days)
    print(f'Built Updates and {len(days)} dated stories.')


if __name__ == '__main__':
    main()
