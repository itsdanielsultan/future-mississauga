from datetime import date
from html import escape
from pathlib import Path
import re


def update_homepage(public: Path, days: list[dict]) -> None:
    """Keep the two homepage stories in step with the dated Updates archive."""
    newest = sorted(days, key=lambda day: day["date"], reverse=True)[:2]
    story_links = []
    for day in newest:
        published = date.fromisoformat(day["date"])
        stamp = published.isoformat()
        label = f"{published.day} {published:%B %Y}"
        story_links.append(
            f'      <a href="update-{stamp}.html"><time datetime="{stamp}">{label}</time>'
            f'<strong>{escape(day["title"])}</strong><span aria-hidden="true">→</span></a>'
        )

    home = public / "index.html"
    old = home.read_text(encoding="utf-8")
    block = '\n'.join(['<div class="home-news-list">', *story_links, '    </div>'])
    updated, count = re.subn(r'<div class="home-news-list">.*?</div>', lambda _: block, old,
                             flags=re.DOTALL)
    if count != 1:
        raise ValueError("Expected one homepage news list")
    if updated != old:
        home.write_text(updated, encoding="utf-8")
