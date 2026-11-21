// Only the edited question and Daniel's reply are ever selected for the public feed.
const route = '/api/suggestions';
const admin = route + '/admin';
const pageSize = 50;
const encoder = new TextEncoder();

function json(body, status = 200) {
  return Response.json(body, {status, headers: {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}});
}

async function authorized(request, secret) {
  const value = request.headers.get('Authorization') || '';
  if (!value.startsWith('Bearer ') || value.length > 512) return false;
  const digest = async text => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
  const [actual, expected] = await Promise.all([digest(value.slice(7)), digest(secret)]);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

async function bodyJSON(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    throw new Response(null, {status:415});
  }
  if (!request.body) throw new Response(null, {status:400});
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', {fatal:true});
  let text = '', size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new Response(null, {status:413});
      }
      text += decoder.decode(value,{stream:true});
    }
    const parsed = JSON.parse(text + decoder.decode());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response(null,{status:400});
  } finally {
    reader.releaseLock();
  }
}

function shortText(value, max) {
  return typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
}

async function listing(url, db, isAdmin) {
  const before = url.searchParams.get('before');
  if (before !== null && (!/^[1-9]\d{0,14}$/.test(before))) return json({error:'Invalid page.'},400);
  const columns = isAdmin
    ? 'id, original, created_at, approved, public_question, response'
    : 'id, public_question, response, reviewed_at';
  const where = isAdmin ? '1 = 1' : "approved = 1 AND trim(response) <> '' AND trim(public_question) <> ''";
  const {results} = await db.prepare(
    'SELECT ' + columns + ' FROM suggestions WHERE ' + where + ' AND id < ? ORDER BY id DESC LIMIT ?'
  ).bind(before ? Number(before) : Number.MAX_SAFE_INTEGER, pageSize + 1).all();
  const items = results.slice(0,pageSize);
  return json({items, next:results.length > pageSize ? items.at(-1).id : null});
}

export async function handleSuggestions(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const adminId = path.match(/^\/api\/suggestions\/admin\/([1-9]\d{0,14})$/)?.[1];
  if (![route,admin].includes(path) && !adminId) return json({error:'Page not found.'},404);
  if (!env.SUGGESTIONS_DB) {
    return json({error:'The suggestion desk is currently closed.'},503);
  }
  if (url.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) {
    return json({error:'Use the secure website.'},403);
  }
  const isAdmin = path !== route;
  try {
    if (isAdmin) {
      let secret=env.SUGGESTIONS_ADMIN_TOKEN;
      if (typeof secret!=='string' || secret.length<32 || secret.length>500) {
        if (!/^Bearer [a-f0-9]{64}$/.test(request.headers.get('Authorization') || '')) {
          return json({error:'Sign in to review suggestions.'},401);
        }
        // Only the account owner can read this key in D1 Studio. No public query selects this table.
        const row=await env.SUGGESTIONS_DB.prepare('SELECT access_key FROM suggestion_moderator WHERE id=1').bind().first();
        secret=row?.access_key;
        if (typeof secret!=='string' || !/^[a-f0-9]{64}$/.test(secret)) return json({error:'Review suggestions in your Cloudflare dashboard.'},503);
      }
      if (!await authorized(request,secret)) return json({error:'Sign in to review suggestions.'},401);
    }
    if (request.method === 'GET' && !adminId) return await listing(url,env.SUGGESTIONS_DB,isAdmin);
    if (!(request.method === 'POST' && path === route || request.method === 'PUT' && adminId)) {
      return json({error:'Method unavailable.'},405);
    }
    if (request.headers.get('Origin') !== url.origin) return json({error:'Open the form on this website.'},403);
    const data = await bodyJSON(request);
    const now = new Date().toISOString();
    if (!isAdmin) {
      const original = shortText(data.suggestion,1200);
      if (!original) return json({error:'Enter a suggestion of up to 1,200 characters.'},400);
      const submissionKey = data.submissionKey ?? null;
      if (submissionKey !== null && (typeof submissionKey !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionKey))) {
        return json({error:'Refresh the form and try again.'},400);
      }
      // A single atomic admission check bounds retained submissions per day, even across isolates.
      const result = await env.SUGGESTIONS_DB.prepare(
        'INSERT INTO suggestions (created_at,original,submission_key) SELECT ?,?,? WHERE (SELECT count(*) FROM suggestions WHERE created_at >= ?) < 250 ON CONFLICT(submission_key) DO NOTHING'
      ).bind(now,original,submissionKey,now.slice(0,10)).run();
      if (!result.meta.changes) {
        const previous = submissionKey && await env.SUGGESTIONS_DB.prepare(
          'SELECT 1 AS received FROM suggestions WHERE submission_key = ? AND original = ?'
        ).bind(submissionKey,original).all();
        if (previous?.results?.length) return json({received:true},201);
        return json({error:'The suggestion desk is full today. Please try again tomorrow.'},429);
      }
      return json({received:true},201);
    }
    if (typeof data.approved !== 'boolean') return json({error:'Choose whether to approve the suggestion.'},400);
    const question = shortText(data.question,1000);
    const response = shortText(data.response,2000);
    if (data.approved && (!question || !response)) return json({error:'Add a public question and your reply before approving.'},400);
    const result = await env.SUGGESTIONS_DB.prepare(
      'UPDATE suggestions SET approved=?, public_question=?, response=?, reviewed_at=? WHERE id=?'
    ).bind(Number(data.approved),question,response,now,Number(adminId)).run();
    return result.meta.changes ? json({saved:true}) : json({error:'Suggestion unavailable.'},404);
  } catch (error) {
    if (error instanceof Response) return json({error:'The submitted form could not be read.'},error.status);
    return json({error:'The suggestion desk is temporarily unavailable. Please try again later.'},503);
  }
}
