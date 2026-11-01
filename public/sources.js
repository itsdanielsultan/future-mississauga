const links = [...document.querySelectorAll('.sources-jumps a[href^="#"]')];
const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
function markCurrent(id) {
  for (const link of links) {
    if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
for (const link of links) link.addEventListener('click', () => markCurrent(link.hash.slice(1)));
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible.length) markCurrent(visible[0].target.id);
  }, { rootMargin: '-100px 0px -60% 0px', threshold: 0 });
  sections.forEach(section => observer.observe(section));
}
