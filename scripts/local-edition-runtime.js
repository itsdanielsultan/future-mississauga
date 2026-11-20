// Standalone folder transport. Browsers allow local classic scripts and media
// while restricting fetch() and ES module imports from file URLs.
(() => {
  const base = new URL('./', document.baseURI);
  const catalog = window.fmEditionFiles;
  const files = new Set(catalog.files);
  const pending = new Map();

  function key(url) {
    if (url.protocol !== 'file:' || url.host !== base.host || !url.pathname.startsWith(base.pathname)) return null;
    const name = decodeURIComponent(url.pathname.slice(base.pathname.length));
    return files.has(name) ? name : null;
  }

  function localize(value) {
    if (typeof value !== 'string' || !value) return value;
    let url;
    try { url = new URL(value, document.baseURI); } catch { return value; }
    const mapped = catalog.routes[url.origin + url.pathname];
    if (mapped) return new URL(mapped, base).href + url.search + url.hash;
    if (['futuremississauga.com', 'www.futuremississauga.com', 'futuremississauga.ca'].includes(url.hostname)) {
      const path = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
      if (files.has(path)) return new URL(path, base).href + url.search + url.hash;
    }
    if (url.href.split(/[?#]/)[0] === base.href) return new URL('index.html', base).href + url.search + url.hash;
    return value;
  }

  // Local files may update a fragment in place but cannot rewrite their query.
  // Preserve each page's shareable filters, scenario and back/forward navigation.
  function historyURL(view = window) {
    const url = new URL(view.location.href);
    if (url.hash.startsWith('#?')) {
      const [search, anchor] = url.hash.slice(2).split('#');
      url.search = search;
      url.hash = anchor || '';
    }
    return url;
  }

  function writeHistory(method, state, title, canonicalURL) {
    const current = new URL(location.href);
    const next = new URL(canonicalURL, current);
    if (next.protocol === 'file:' && next.pathname === current.pathname) {
      current.hash = next.search === current.search ? next.hash : '?' + next.search.slice(1) + next.hash;
      try {
        history[method](state, title, current);
      } catch (error) {
        if (error.name !== 'SecurityError') throw error;
        if (method === 'replaceState') location.replace(current.href);
        else location.hash = current.hash;
      }
      return;
    }
    history[method](state, title, next);
  }

  function fromBase64(value) {
    if (Uint8Array.fromBase64) return Uint8Array.fromBase64(value);
    const bytes = new Uint8Array((value.length / 4 | 0) * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0));
    for (let start = 0, offset = 0; start < value.length; start += 32768) {
      const part = atob(value.slice(start, start + 32768));
      for (let i = 0; i < part.length; ++i) bytes[offset++] = part.charCodeAt(i);
    }
    return bytes;
  }

  function bytesFor(name) {
    if (pending.has(name)) return pending.get(name).promise;
    const entry = {};
    pending.set(name, entry);
    entry.promise = new Promise((resolve, reject) => {
      entry.resolve = resolve;
      const script = document.createElement('script');
      script.src = new URL('_local/bytes/' + name + '.js', base).href;
      script.onload = () => {
        script.remove();
        if (!entry.received) reject(new Error('Invalid local asset: ' + name));
        pending.delete(name);
      };
      script.onerror = () => {
        script.remove();
        pending.delete(name);
        reject(new Error('Missing local asset: ' + name));
      };
      document.head.append(script);
    });
    return entry.promise;
  }

  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async function editionFetch(input, init = {}) {
    const address = input instanceof Request ? input.url : String(input);
    let url;
    try { url = new URL(localize(address), document.baseURI); } catch { return nativeFetch(input, init); }
    if (url.protocol !== 'file:') return nativeFetch(input, init);
    const name = key(url);
    const resource = catalog.transport[name];
    if (!name || !resource) return new Response(null, {status:404});
    const signal = init.signal || (input instanceof Request ? input.signal : null);
    signal?.throwIfAborted();
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return new Response(null, {status:405});
    const headers = {'Content-Type':resource[0], 'Content-Length':String(resource[1])};
    if (method === 'HEAD') return new Response(null, {headers});
    let rejectAbort;
    const cancelled = signal && new Promise((_, reject) => { rejectAbort = () => reject(signal.reason); });
    if (cancelled) signal.addEventListener('abort', rejectAbort, {once:true});
    try {
      const decoded = await (cancelled ? Promise.race([bytesFor(name),cancelled]) : bytesFor(name));
      signal?.throwIfAborted();
      return new Response(decoded, {headers});
    } finally {
      if (cancelled) signal.removeEventListener('abort', rejectAbort);
    }
  };

  window.fmLocal = {
    localize, historyURL, writeHistory,
    loadBuildingGraph(script) {
      const wantsModel = historyURL().searchParams.get('model');
      const bundle = wantsModel ? script.dataset.viewer : script.dataset.catalogue;
      // This call runs synchronously in the document head. Parser insertion
      // installs one local import map before any module specifiers are resolved.
      document.write('<script src="' + bundle + '"></script>');
    },
    validationBase(value) {
      const url = new URL(value);
      return url.protocol === 'file:' && url.pathname.startsWith(base.pathname) ?
        new URL(url.pathname.slice(base.pathname.length), 'https://futuremississauga.com/').href : value;
    },
    contains: url => Boolean(key(url)),
    receive(name, data, packed) {
      const request = pending.get(name);
      if (!request || request.received) return;
      request.received = true;
      const result = Promise.resolve().then(async () => {
        const bytes = fromBase64(data);
        return packed ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : bytes;
      });
      request.resolve(result);
    },
    modules(sources) {
      const imports = {};
      for (const [name, source] of Object.entries(sources)) {
        imports['fm:' + name] = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
      }
      const map = document.createElement('script');
      map.type = 'importmap';
      map.textContent = JSON.stringify({imports});
      document.head.append(map);
    },
  };

  // Data binds image and document paths at runtime too. The catalogue keeps
  // source URLs for provenance; localize only the resource that will be opened.
  const fixSet = value => value.replace(/https?:\/\/[^\s,]+/g, localize);
  for (const [type, props] of [[HTMLImageElement,['src','srcset']], [HTMLSourceElement,['src','srcset']],
       [HTMLMediaElement,['src']], [HTMLVideoElement,['poster']], [HTMLAnchorElement,['href']]]) {
    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(type.prototype, prop);
      if (!desc?.set || !desc.configurable) continue;
      Object.defineProperty(type.prototype, prop, {...desc,
        set(value) { desc.set.call(this, prop === 'srcset' ? fixSet(String(value)) : localize(String(value))); },
      });
    }
  }
  const attrs = ['href','src','srcset','poster','data-preview-download'];
  function fixElement(el) {
    if (!(el instanceof Element)) return;
    for (const attr of attrs) {
      const old = el.getAttribute(attr);
      if (!old || !/^https?:/i.test(old)) continue;
      const value = attr === 'srcset' ? fixSet(old) : localize(old);
      if (value !== old) el.setAttribute(attr, value);
    }
  }
  const selectors = attrs.map(attr => '[' + attr + '^="http"]').join(',');
  new MutationObserver(records => {
    for (const change of records) {
      if (change.type === 'attributes') fixElement(change.target);
      for (const element of change.addedNodes) if (element instanceof Element) {
        fixElement(element);
        element.querySelectorAll(selectors).forEach(fixElement);
      }
    }
  }).observe(document.documentElement, {subtree:true,childList:true,attributes:true,attributeFilter:attrs});
})();
