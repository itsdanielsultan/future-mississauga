// Switch both paths together when the reviewed combined edition is available.
export const DOCUMENT_PREVIEW_CATALOG_URL = 'data/document-previews-20261121.json?v=20261121';
export const DOCUMENT_PAGE_TEXT_URL = 'document-page-text-20261121.txt?v=20261121';

// PDF pathnames identify editions. Query strings may bust caches, never rebind pages.
export function documentPreviewKey(url, baseURL) {
  const resolved = new URL(url, baseURL);
  return resolved.origin + resolved.pathname;
}

export function createDocumentPreviewIndex(catalog, baseURL, archive) {
  const index = new Map();
  const upgraded = new Map((archive?.documents || []).map(doc=>[documentPreviewKey(doc.url,baseURL),doc]));
  catalog.documents.forEach((doc, position) => {
    const key = documentPreviewKey(doc.url, baseURL);
    if (index.has(key)) throw new Error('Each document edition needs a distinct PDF pathname.');
    const reader = upgraded.get(key);
    const pin = doc.sourceSHA256 || new URL(doc.url,baseURL).searchParams.get('edition');
    const sameSource = reader && /^[a-f0-9]{64}$/.test(reader.sourceSHA256) &&
      (!pin || reader.sourceSHA256.startsWith(pin)) && reader.pages === doc.pages;
    if (sameSource) {
      const {base,zoomBase,prefix,width,height,zoomWidth,sizes,sourceSHA256} = reader;
      doc = {...doc,base,zoomBase,prefix,width,height,zoomWidth,sizes,sourceSHA256};
    }
    // Keep the catalogue position: accessible text uses the same document/page order.
    index.set(key, {d: doc, i: position});
  });
  return index;
}

export function documentPageURL(catalog, doc, page, baseURL, zoom = false) {
  if (!Number.isInteger(page) || page < 1 || page > doc.pages) {
    throw new RangeError('Document page is out of range.');
  }
  const base = new URL((zoom && doc.zoomBase) || doc.base || catalog.base, baseURL);
  const url = new URL(doc.prefix + String(page).padStart(2, '0') + '.avif', base);
  if (doc.zoomBase && doc.sourceSHA256) url.searchParams.set('edition', doc.sourceSHA256.slice(0, 12));
  return url.href;
}

export function isDocumentPreviewCandidate(url, baseURL, index = new Map()) {
  const resolved = new URL(url, baseURL);
  if (index.has(documentPreviewKey(url, baseURL))) return true;
  // Recognize known files while the catalogue is still loading; resolution stays exact.
  return (resolved.origin === new URL(baseURL).origin &&
    /\/downloads\/(edition-(?:20261120|20261121)\/(?:Mississauga-Atlas|[a-z0-9-]+-review)|Future-Mississauga-Atlas(?:-\d{8}-[a-f0-9]{12})?|City-of-Mississauga-Open-Data-Terms)\.pdf$/.test(resolved.pathname)) ||
    (resolved.hostname === 'github.com' &&
      resolved.pathname.startsWith('/itsdanielsultan/future-mississauga/releases/download/') &&
      resolved.pathname.endsWith('-review.pdf'));
}

// Atlas links can name a page while keeping a single PDF and its accessible text.
export function requestedDocumentPage(href, pageCount) {
  const value = new URLSearchParams(new URL(href).hash.slice(1)).get('page');
  const page = Number(value);
  return value && /^\d+$/.test(value) && Number.isSafeInteger(page) && page >= 1 && page <= pageCount ? page : 1;
}

function installDocumentGestures(dialog, stage, changePage, atFit) {
  let backdropPress = false;
  dialog.addEventListener('pointerdown', event => {
    backdropPress = event.target === dialog;
  });
  dialog.addEventListener('click', event => {
    if (backdropPress && event.target === dialog) dialog.close();
    backdropPress = false;
  });

  let contact = null;
  stage.addEventListener('touchstart', event => {
    contact = atFit() && event.touches.length === 1 ? event.touches[0] : null;
  }, {passive:true});
  stage.addEventListener('touchcancel', () => { contact = null; }, {passive:true});
  stage.addEventListener('touchend', event => {
    const start = contact;
    contact = null;
    if (!start || !atFit() || event.touches.length) return;
    const end = Array.from(event.changedTouches).find(touch => touch.identifier === start.identifier);
    if (!end) return;
    const dx = end.clientX - start.clientX;
    const dy = end.clientY - start.clientY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) changePage(dx < 0 ? 1 : -1);
  }, {passive:true});
}

// Group the atlas page numbers by neighbourhood in the native page picker.
function documentPageOptions(doc) {
  const options = document.createDocumentFragment();
  const sections = new Map((doc.pageSections || []).map(section => [section.page, section.label]));
  let group = options;
  for (let page = 1; page <= doc.pages; page++) {
    if (sections.has(page)) {
      group = document.createElement('optgroup');
      group.label = sections.get(page);
      options.append(group);
    }
    group.append(new Option(page + ' / ' + doc.pages, String(page)));
  }
  return options;
}
const relativeAsset = file => new URL(file, import.meta.url).href;
const downloadIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 16v4h14v-4"/></svg>';
let installed = false;

export function installDocumentPreviews() {
  if (installed) return;
  installed = true;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = relativeAsset('document-preview.css?v=20261121-pagination');
  document.head.insertBefore(css, document.querySelector('link[href^="vendor/basecoat/controls.css"]'));
  const dialog = document.createElement('dialog');
  dialog.className = 'document-preview';
  dialog.setAttribute('aria-labelledby','documentTitle');
  dialog.innerHTML = `<div class="document-shell"><header><h2 id="documentTitle">Document preview</h2>
    <a class="document-download ui-button" data-download download data-variant="outline" data-size="icon">${downloadIcon}</a>
    <button type="button" class="ui-button" data-close aria-label="Close document" data-variant="ghost" data-size="icon"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
    <nav class="document-toolbar" aria-label="Document controls"><div class="document-pagination">
    <button type="button" class="ui-button" data-prev aria-label="Previous page" data-variant="outline" data-size="icon">←</button>
    <select class="ui-select" aria-label="Page"></select><button type="button" class="ui-button" data-next aria-label="Next page" data-variant="outline" data-size="icon">→</button></div>
    <div class="document-zoom"><button type="button" class="ui-button" data-out aria-label="Zoom out" data-variant="outline" data-size="icon">−</button>
    <button type="button" class="ui-button" data-in aria-label="Zoom in" data-variant="outline" data-size="icon">+</button><button type="button" class="ui-button" data-fit data-variant="outline" data-size="icon">Fit</button></div></nav>
    <div class="document-stage" tabindex="0" aria-label="Document pages"><div class="document-canvas"></div></div>
    <div class="document-status"><span role="status"></span><button type="button" class="ui-button" data-retry hidden data-variant="outline">Try again</button></div>
    <div class="document-reader"><h3>Page text</h3><pre></pre></div></div>`;
  document.body.append(dialog);
  const el = selector => dialog.querySelector(selector);
  const stage = el('.document-stage'), canvas = el('.document-canvas'), select = el('select');
  const status = el('.document-status'), message = el('[role=status]'), retry = el('[data-retry]');
  const download = el('[data-download]'), toolbar = el('.document-toolbar');
  let catalog, index = new Map(), catalogRequest, textRequest, pageText;
  let record, opener, pages = [], current = 1, zoom = 1, generation = 0, scrollFrame = 0;
  let selectedScrollTop = null;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!dialog.open || !entry.target.isConnected) continue;
      const frame = entry.target;
      if (entry.isIntersecting) renderPage(frame);
      else if (Number(frame.dataset.page) !== current) frame.querySelector('img').removeAttribute('src');
    }
  }, {root:stage,rootMargin:'100% 0px'});

  function addDownloadLinks() {
    for (const link of document.querySelectorAll('main a[href]')) {
      const item = index.get(documentPreviewKey(link.href,location.href));
      if (!item || link.hasAttribute('data-download') || link.hasAttribute('data-document-preview') || link.hasAttribute('download')) continue;
      link.dataset.documentPreview = '';
      link.setAttribute('aria-haspopup','dialog');
      const pair = document.createElement('span');
      pair.className = 'document-action-pair';
      if (link.closest('.sources-documents')) {
        pair.classList.add('document-action-pair--card');
        link.querySelector('span[aria-hidden]')?.remove();
      }
      const save = download.cloneNode(true);
      save.href = link.href;
      save.download = new URL(link.href).pathname.split('/').pop();
      save.setAttribute('aria-label','Download ' + item.d.title + ' PDF');
      link.replaceWith(pair);
      pair.append(link,save);
    }
  }
  function loadCatalog() {
    if (!catalogRequest) catalogRequest = Promise.all([
      fetch(relativeAsset(DOCUMENT_PREVIEW_CATALOG_URL), {cache:'no-cache'}).then(response => {
        if (!response.ok) throw Error('Catalogue unavailable');
        return response.json();
      }),
      fetch(relativeAsset('data/archive-reader-20261121.json'), {cache:'no-cache'}).then(response =>
        response.ok ? response.json() : null).catch(()=>null)
    ]).then(([data,archive]) => {
      index = createDocumentPreviewIndex(data,location.href,archive);
      catalog = data;
      addDownloadLinks();
    }).catch(error => { catalogRequest = null; throw error; });
    return catalogRequest;
  }
  function loadText() {
    if (!('DecompressionStream' in window)) return;
    if (!textRequest) textRequest = fetch(relativeAsset(DOCUMENT_PAGE_TEXT_URL), {cache:'no-cache'}).then(async response => {
      if (!response.ok) throw Error('Text unavailable');
      const bytes = Uint8Array.from(atob((await response.text()).trim()), ch => ch.charCodeAt(0));
      pageText = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
      if (dialog.open && record) el('.document-reader pre').textContent = pageText[record.i]?.[current-1] || '';
    }).catch(() => { textRequest = null; });
  }
  function announce(text, state) {
    message.textContent = text;
    retry.hidden = state !== 'error';
    if (state === 'ready') status.dataset.ready = 'true';
    else delete status.dataset.ready;
    stage.setAttribute('aria-busy',String(state === 'loading'));
  }
  function syncPage() {
    if (!record || !pages[current-1]) return;
    select.value = String(current);
    el('[data-prev]').disabled = current === 1;
    el('[data-next]').disabled = current === pages.length;
    el('.document-reader pre').textContent = pageText?.[record.i]?.[current-1] || '';
    const img = pages[current-1].querySelector('img');
    if (img.complete && img.naturalWidth) announce('Page ' + current + ' of ' + pages.length,'ready');
    else if (img.dataset.failed) announce('This page could not load.','error');
    else announce('Loading page ' + current + '…','loading');
  }
  function renderPage(frame) {
    if (!record) return;
    const number = Number(frame.dataset.page);
    const image = frame.querySelector('img'), doc = record.d;
    const high = !!doc.zoomBase && frame.clientWidth * (window.devicePixelRatio || 1) > doc.width;
    const url = documentPageURL(catalog,doc,number,location.href,high && !image.dataset.standardOnly);
    if (image.getAttribute('src') !== url) {
      delete image.dataset.failed;
      image.src = url;
    }
  }
  function jump(number) {
    if (!pages.length) return;
    current = Math.min(pages.length,Math.max(1,number));
    const frame = pages[current-1];
    const stageBox = stage.getBoundingClientRect();
    stage.scrollTop += frame.getBoundingClientRect().top-stageBox.top-12;
    // Several short pages fit at a time on a phone. A page selected explicitly
    // stays selected until the reader scrolls away from its actual position.
    selectedScrollTop = stage.scrollTop;
    renderPage(frame);
    syncPage();
  }
  function addHotspots(frame, doc, number) {
    const layer = document.createElement('div');
    layer.className = 'document-page-links';
    for (const link of doc.pageLinks?.[number] || []) {
      const internal = Number.isInteger(link.page) && link.page >= 1 && link.page <= doc.pages;
      if (!internal && !/^https?:\/\//.test(link.url || '')) continue;
      const item = document.createElement(internal ? 'button' : 'a');
      const [left,top,width,height] = link.bounds;
      Object.assign(item.style,{left:left*100+'%',top:top*100+'%',width:width*100+'%',height:height*100+'%'});
      if (internal) {
        item.type = 'button';
        const heading = doc.pageSections?.find(section => section.page === link.page)?.label;
        item.setAttribute('aria-label',heading ? heading+', page '+link.page : 'Go to page '+link.page);
        item.onclick = () => { jump(link.page); stage.focus({preventScroll:true}); };
      } else {
        item.href = link.url; item.target = '_blank'; item.rel = 'noopener';
        item.setAttribute('aria-label',link.label || 'Open linked reference');
      }
      layer.append(item);
    }
    if (layer.childElementCount) frame.append(layer);
  }
  function makePages(doc) {
    const output = document.createDocumentFragment();
    for (let number=1; number<=doc.pages; number++) {
      const frame = document.createElement('div'), image = document.createElement('img');
      frame.className = 'document-page-frame';
      frame.dataset.page = String(number);
      const [width,height] = doc.sizes?.[number-1] || [doc.width,doc.height];
      frame.style.aspectRatio = width + ' / ' + height;
      image.width = width; image.height = height; image.decoding = 'async';
      image.alt = doc.title + ', page ' + number + ' of ' + doc.pages;
      image.onload = () => { if (frame.isConnected && dialog.open && current === number) syncPage(); };
      image.onerror = () => {
        if (!frame.isConnected || !dialog.open || !image.getAttribute('src')) return;
        const standardURL = documentPageURL(catalog,doc,number,location.href,false);
        if (doc.zoomBase && image.getAttribute('src') !== standardURL) {
          image.dataset.standardOnly = 'true';
          renderPage(frame);
        } else {
          image.dataset.failed = 'true';
          if (current === number) syncPage();
        }
      };
      frame.append(image);
      addHotspots(frame,doc,number);
      output.append(frame);
      pages.push(frame);
    }
    canvas.replaceChildren(output);
    pages.forEach(frame=>observer.observe(frame));
  }
  function resize(keepPlace=true) {
    if (!dialog.open || !record || !pages.length) return;
    const frame = pages[current-1];
    const relative = keepPlace ? (stage.getBoundingClientRect().top-frame.getBoundingClientRect().top)/Math.max(1,frame.clientHeight) : 0;
    const width = Math.round(Math.max(1,Math.min(stage.clientWidth-24,1280))*zoom);
    if (canvas.style.width !== width+'px') {
      canvas.style.width=width+'px';
      if (keepPlace) stage.scrollTop += frame.getBoundingClientRect().top-stage.getBoundingClientRect().top + relative*frame.clientHeight;
    }
    stage.dataset.pageFit = String(zoom===1);
    el('[data-out]').disabled=zoom<=.5;
    el('[data-in]').disabled=zoom>=4;
    renderPage(frame);
  }
  function selectVisiblePage() {
    scrollFrame=0;
    if (!dialog.open || !pages.length) return;
    if (selectedScrollTop !== null && Math.abs(stage.scrollTop-selectedScrollTop)<1) return;
    selectedScrollTop = null;
    const top=stage.getBoundingClientRect().top + Math.min(stage.clientHeight/2,200);
    let lo=0,hi=pages.length-1;
    while (lo<hi) {
      const mid=Math.ceil((lo+hi)/2);
      if (pages[mid].getBoundingClientRect().top<=top) lo=mid;
      else hi=mid-1;
    }
    if (stage.scrollHeight-stage.scrollTop-stage.clientHeight<2) lo=pages.length-1;
    if (current!==lo+1) { current=lo+1;renderPage(pages[lo]);syncPage(); }
  }
  stage.addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(selectVisiblePage);},{passive:true});
  async function openDocument(link) {
    const request = ++generation;
    opener=link;record=null;pages=[];observer.disconnect();canvas.replaceChildren();
    zoom=1;toolbar.hidden=true;
    el('h2').textContent='Document preview';
    el('.document-reader pre').textContent='';
    download.href=link.href;download.download=new URL(link.href).pathname.split('/').pop();
    download.setAttribute('aria-label','Download PDF');
    announce('Opening document…','loading');
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('document-preview-open');
    el('[data-close]').focus({preventScroll:true});
    try {
      await loadCatalog();
      if (request!==generation || !dialog.open) return;
      record=index.get(documentPreviewKey(link.href,location.href));
      if (!record) throw Error('Document unavailable');
      const doc=record.d;
      current=requestedDocumentPage(link.href,doc.pages);
      el('h2').textContent=doc.title;
      download.setAttribute('aria-label','Download '+doc.title+' PDF');
      select.replaceChildren(documentPageOptions(doc));
      toolbar.hidden=false;
      makePages(doc);
      resize(false);
      jump(current);
      loadText();
    } catch { if (request===generation && dialog.open) announce('The document preview could not load.','error'); }
  }
  installDocumentGestures(dialog,stage,delta=>jump(current+delta),()=>zoom===1);
  el('[data-close]').onclick=()=>dialog.close();
  el('[data-prev]').onclick=()=>jump(current-1);
  el('[data-next]').onclick=()=>jump(current+1);
  select.onchange=()=>jump(Number(select.value));
  el('[data-out]').onclick=()=>{zoom=Math.max(.5,zoom/1.25);resize();};
  el('[data-in]').onclick=()=>{zoom=Math.min(4,zoom*1.25);resize();};
  el('[data-fit]').onclick=()=>{zoom=1;resize();};
  retry.onclick=()=>{
    if (!record) {openDocument(opener);return;}
    const image=pages[current-1].querySelector('img');
    image.removeAttribute('src');delete image.dataset.failed;delete image.dataset.standardOnly;
    renderPage(pages[current-1]);syncPage();
  };
  dialog.addEventListener('close',()=>{
    generation++;observer.disconnect();pages=[];record=null;canvas.replaceChildren();
    document.documentElement.classList.remove('document-preview-open');
    if(opener?.isConnected) opener.focus({preventScroll:true});
  });
  dialog.addEventListener('keydown',event=>{
    if(event.target.matches('select,input,textarea') || event.target.isContentEditable) return;
    if(event.key==='ArrowRight' || event.key==='ArrowLeft') {
      event.preventDefault();jump(current+(event.key==='ArrowRight' ? 1 : -1));
    }
  });
  new ResizeObserver(()=>resize()).observe(stage);
  document.addEventListener('click',event=>{
    if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link=event.target.closest?.('a[href]');
    if(!link || link.hasAttribute('download') || link.hasAttribute('data-download')) return;
    if (isDocumentPreviewCandidate(link.href,location.href,index)) {event.preventDefault();openDocument(link);}
  });
  loadCatalog().catch(()=>{});
}
