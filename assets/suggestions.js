(() => {
  const get = id => document.getElementById(id);
  const endpoint = '/api/suggestions';
  const online = ['http:', 'https:'].includes(location.protocol);
  const composer = get('submission-form');
  const feedback = get('submission-status');
  const adminPanel = get('moderator-panel');
  const adminStatus = get('moderator-status');
  const inbox = get('private-inbox');
  let key = '';
  let session = 0;
  let nextReview = null;
  let pendingSubmission = null;

  const element = (tag, text, className) => {
    const item = document.createElement(tag);
    if (text) item.textContent = text;
    if (className) item.className = className;
    return item;
  };

  async function request(path, method = 'GET', data, moderator = false) {
    const headers = {Accept:'application/json'};
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    if (moderator) headers.Authorization = 'Bearer ' + key;
    const result = await fetch(path, {method, headers, credentials:'omit', cache:'no-store', redirect:'error',
      body:data === undefined ? undefined : JSON.stringify(data)});
    if (!result.headers.get('Content-Type')?.includes('application/json')) throw new Error('The suggestion desk is currently closed.');
    const response = await result.json();
    if (!result.ok) throw new Error(response.error || 'Please try again later.');
    return response;
  }

  function showReply(item) {
    const article = element('article', '', 'desk-reply');
    article.append(element('h3', item.public_question), element('p', item.response));
    get('public-replies').append(article);
  }

  async function loadPublic() {
    const status = get('public-status');
    if (!online) {
      feedback.textContent = 'Suggestions can be sent from the online edition.';
      get('online-suggestions').hidden = false;
      status.textContent = 'Open the online edition to read published replies.';
      return;
    }
    let cursor = null;
    try {
      do {
        const data = await request(endpoint + (cursor ? '?before=' + cursor : ''));
        if (!Array.isArray(data.items)) throw new Error();
        if (!cursor) {
          get('public-replies').replaceChildren();
          feedback.textContent = '';
          composer.hidden = false;
          get('published-replies').hidden = data.items.length === 0;
          status.textContent = '';
        }
        data.items.forEach(showReply);
        cursor = data.next;
      } while (cursor);
    } catch {
      if (!cursor) {
        feedback.replaceChildren(document.createTextNode('The form is temporarily unavailable. '));
        const contact = element('a','Contact Daniel');
        contact.href = 'contact.html';
        feedback.append(contact);
        status.textContent = 'Published replies are currently unavailable.';
      } else status.textContent = 'Some earlier replies could not be loaded. Refresh to try again.';
    }
  }

  composer.addEventListener('submit', async event => {
    event.preventDefault();
    const button = composer.querySelector('button');
    if (button.disabled) return;
    button.disabled = true;
    feedback.textContent = 'Sending…';
    try {
      const suggestion = get('suggestion-text').value;
      if (pendingSubmission?.suggestion !== suggestion) {
        pendingSubmission = {suggestion,submissionKey:crypto.randomUUID()};
      }
      await request(endpoint, 'POST', pendingSubmission);
      pendingSubmission = null;
      composer.reset();
      feedback.textContent = 'Received. Daniel will review your suggestion privately.';
    } catch (error) {
      feedback.textContent = error.message || 'Your message could not be sent. Please try again.';
    } finally { button.disabled = false; }
  });

  function syncModerator() {
    const requested = online && location.hash === '#moderate';
    adminPanel.hidden = !requested;
    if (!requested && key) closeInbox();
  }

  function closeInbox() {
    session++;
    key = '';
    nextReview = null;
    inbox.replaceChildren();
    get('moderator-login').hidden = false;
    get('moderator-login').reset();
    get('moderator-signout').hidden = true;
    adminStatus.textContent = '';
  }

  function reviewRow(item) {
    const article = element('article','','desk-review');
    const heading = element('h3', 'Message from ' + new Intl.DateTimeFormat('en-CA',
      {month:'short',day:'numeric',year:'numeric',timeZone:'America/Toronto'}).format(new Date(item.created_at)));
    article.append(heading, element('p', item.original));
    const form = document.createElement('form');
    function field(text, value, max, part) {
      const label = element('label',text);
      const input = element('textarea');
      input.id = 'review-' + item.id + '-' + part;
      label.htmlFor = input.id;
      input.value = value;
      input.maxLength = max;
      input.rows = 3;
      form.append(label,input);
      return input;
    }
    const q = field('Public question',item.public_question,1000,'question');
    const reply = field('Daniel’s reply',item.response,2000,'reply');
    const label = element('label');
    const check = element('input');
    check.type = 'checkbox';
    check.checked = Boolean(item.approved);
    label.append(check, document.createTextNode('Approve the edited question and reply for publication'));
    const button = element('button','Save review','desk-button');
    button.type = 'submit';
    const status = element('p',item.approved ? 'Published' : 'Private');
    status.setAttribute('role','status');
    form.append(label,button,status);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const current = session;
      button.disabled = true;
      try {
        const approved = check.checked;
        await request(endpoint + '/admin/' + item.id,'PUT',{approved,question:q.value,response:reply.value},true);
        if (current !== session) return;
        status.textContent = approved ? 'Published with your reply.' : 'Saved privately.';
        await loadPublic();
      } catch (error) { if (current === session) status.textContent = error.message || 'Please try again.'; }
      finally { button.disabled = false; }
    });
    article.append(form);
    return article;
  }

  async function loadPrivate(append) {
    const current = session;
    const data = await request(endpoint + '/admin' + (append ? '?before=' + nextReview : ''),'GET',undefined,true);
    if (current !== session) return;
    if (!append) inbox.replaceChildren();
    inbox.querySelector('.older-questions')?.remove();
    for (const item of data.items) inbox.append(reviewRow(item));
    nextReview = data.next;
    if (nextReview) {
      const older = element('button','Earlier suggestions','desk-link older-questions');
      older.type = 'button';
      older.addEventListener('click', async () => {
        older.disabled = true;
        try { await loadPrivate(true); } catch (error) { adminStatus.textContent = error.message; older.disabled = false; }
      });
      inbox.append(older);
    }
    get('moderator-login').hidden = true;
    get('moderator-signout').hidden = false;
    adminStatus.textContent = inbox.childElementCount ? '' : 'Your inbox is empty.';
  }

  get('moderator-login').addEventListener('submit', async event => {
    event.preventDefault();
    session++;
    key = get('moderator-key').value;
    get('moderator-key').value = '';
    const loginSession = session;
    try { await loadPrivate(false); }
    catch (error) {
      if (loginSession !== session) return;
      closeInbox();
      adminStatus.textContent = error.message || 'Could not open the inbox.';
    }
  });
  get('moderator-signout').addEventListener('click',closeInbox);
  window.addEventListener('pagehide',closeInbox);
  window.addEventListener('hashchange',syncModerator);
  syncModerator();
  loadPublic();
})();
