import {handleSuggestions} from './suggestions.mjs';

// The builder supplies only public, immutable object names. Each request makes
// at most one R2 read. The static asset service handles all other paths first.
export const legacyAtlasPath = '/downloads/Future-Mississauga-Atlas.pdf';

function sliceAsset(body, {offset, length}) {
  const reader=body.getReader();
  return new ReadableStream({
    async pull(controller) {
      while (length) {
        const {done,value}=await reader.read();
        if (done) { controller.error(new Error('Incomplete static original')); return; }
        if (offset >= value.length) { offset-=value.length; continue; }
        const take=Math.min(length,value.length-offset);
        controller.enqueue(value.subarray(offset,offset+take));
        offset=0;length-=take;
        if (!length) { controller.close(); await reader.cancel(); }
        return;
      }
    },
    cancel(reason) { return reader.cancel(reason); }
  });
}

export function serveMedia(files, currentAtlasPath, publishedMedia = {}, staticPrints = []) {
  const staticKeys = new Set(staticPrints);
  const byDigest = new Map(Object.entries(publishedMedia));
  for (const file of Object.values(files)) byDigest.set(file.key, file);
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname === '/' ? '/index.html' : url.pathname;
      if (path === '/api/suggestions' || path.startsWith('/api/suggestions/')) return handleSuggestions(request, env);
      // Dated links identify the original atlas. Its undated bookmark follows
      // the same current edition advertised by the download directory.
      if (currentAtlasPath && path === legacyAtlasPath && !url.search && ['GET','HEAD'].includes(request.method)) {
        return new Response(null, {
          status:307,
          headers:{Location:new URL(currentAtlasPath, url).href, 'Cache-Control':'public, max-age=300'}
        });
      }
      const digest = path.match(/^\/media\/sha256\/([a-f0-9]{64})$/)?.[1];
      const file = digest ? byDigest.get(digest) : Object.hasOwn(files, path) && files[path];
      if (!file) {
        if (path === '/index.html') {
          url.pathname = path;
          return env.ASSETS.fetch(new Request(url, request));
        }
        return env.ASSETS.fetch(request);
      }
      if (!['GET','HEAD'].includes(request.method)) return new Response(null, {status:405,headers:{Allow:'GET, HEAD'}});
      const etag = '"' + file.key + '"';
      const headers = new Headers({'Content-Type':file.type,'Accept-Ranges':'bytes','ETag':etag,'Cache-Control':digest ? 'public, max-age=31536000, immutable' : 'public, max-age=3600, must-revalidate','Content-Length':String(file.bytes)});
      const match = request.headers.get('If-None-Match');
      if (match && match.split(',').some(v => ['*',etag].includes(v.trim().replace(/^W\//,'')))) {
        headers.delete('Content-Length');
        return new Response(null,{status:304,headers});
      }
      if (request.method === 'HEAD') return new Response(null,{headers});
      let range;
      const source = request.headers.get('Range');
      const validator = request.headers.get('If-Range');
      if (source && (!validator || validator === etag)) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(source);
        const suffix = m && !m[1] && m[2];
        if (m && (m[1] || m[2])) {
          const start = suffix ? Math.max(0,file.bytes-Number(m[2])) : Number(m[1]);
          const end = suffix || !m[2] ? file.bytes-1 : Math.min(file.bytes-1,Number(m[2]));
          if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end) range={offset:start,length:end-start+1};
        }
        if (!range) return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+file.bytes,'Accept-Ranges':'bytes'}});
        headers.set('Content-Range','bytes '+range.offset+'-'+(range.offset+range.length-1)+'/'+file.bytes);
        headers.set('Content-Length',String(range.length));
      }
      if (staticKeys.has(file.key)) {
        const assetURL = new URL('/_city-originals/' + file.key + '.png', url);
        const requestHeaders = range ? {Range:`bytes=${range.offset}-${range.offset + range.length - 1}`} : {};
        const asset = await env.ASSETS.fetch(new Request(assetURL, {headers:requestHeaders}));
        // The ASSETS binding can omit Content-Length on a verified streamed asset.
        // The release manifest pins the exact bytes at this content-addressed URL.
        const length = asset.headers.get('Content-Length');
        const matchesLength = expected => length === null || Number(length) === expected;
        const full = asset.status === 200 && matchesLength(file.bytes);
        const partial = range && asset.status === 206 && matchesLength(range.length) &&
          asset.headers.get('Content-Range') === headers.get('Content-Range');
        if (!asset.body || (!full && !partial)) {
          await asset.body?.cancel();
          return new Response('File temporarily unavailable.', {status:503,headers:{'Cache-Control':'no-store','Retry-After':'60','X-City-Print-Status':String(asset.status)}});
        }
        const body=range && full ? sliceAsset(asset.body,range) : asset.body;
        return new Response(body,{status:range ? 206 : 200,headers});
      }
      const item = await env.MEDIA.get(file.key,range ? {range} : undefined);
      if (!item || item.size !== file.bytes) return new Response('File temporarily unavailable.',{status:503,headers:{'Cache-Control':'no-store','Retry-After':'60'}});
      return new Response(item.body,{headers,status:range ? 206 : 200});
    }
  };
}
