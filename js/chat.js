// "Ask a question" bubble. Talks to /api/chat (functions/api/chat.js), which
// streams back plain text. The conversation lives in sessionStorage only, so
// it survives moving between pages but nothing is stored anywhere else.
(function () {
  if (window.__fpwChat) return;
  window.__fpwChat = true;

  var CONTACT = 'frontporchwebllc@gmail.com';
  var KEY = 'fpw-chat-v1';
  var GREETING = "Hi! I'm the Front Porch Web assistant (an AI). Ask me about prices, how it works, or the monthly plans.";
  var CHIPS = ['How much does a website cost?', 'How fast can you build it?', "What's in the Care Package?", 'What do I need to get started?'];

  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/css/chat.css?v=1';
  document.head.appendChild(css);

  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  var root = document.createElement('div');
  root.className = 'fpwc';
  if (document.querySelector('.chapter-meter')) root.classList.add('lift');
  root.innerHTML =
    '<button class="fpwc-launch" type="button" aria-expanded="false" aria-controls="fpwc-panel">' + ICON_CHAT +
      '<span class="label">Ask a question</span><span class="dot" aria-hidden="true"></span></button>' +
    '<section class="fpwc-panel" id="fpwc-panel" role="dialog" aria-modal="false" aria-labelledby="fpwc-title">' +
      '<header class="fpwc-head"><div><h2 id="fpwc-title">Ask Front Porch Web</h2>' +
        '<p>AI assistant · answers come from our published prices and terms</p></div>' +
        '<button class="fpwc-close" type="button" aria-label="Close chat">' + ICON_X + '</button></header>' +
      '<div class="fpwc-log" role="log" aria-live="polite" aria-label="Conversation"></div>' +
      '<div class="fpwc-chips" aria-label="Suggested questions"></div>' +
      '<form class="fpwc-form"><label class="fpwc-sr" for="fpwc-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Your question</label>' +
        '<textarea id="fpwc-input" rows="1" maxlength="600" placeholder="Type your question…" autocomplete="off"></textarea>' +
        '<button class="fpwc-send" type="submit" aria-label="Send">' + ICON_SEND + '</button></form>' +
      '<p class="fpwc-foot">AI can make mistakes. Sean answers personally at <a href="mailto:' + CONTACT + '">' + CONTACT + '</a>.</p>' +
    '</section>';
  document.body.appendChild(root);

  var launch = root.querySelector('.fpwc-launch');
  var closeBtn = root.querySelector('.fpwc-close');
  var log = root.querySelector('.fpwc-log');
  var chips = root.querySelector('.fpwc-chips');
  var form = root.querySelector('.fpwc-form');
  var input = root.querySelector('textarea');
  var send = root.querySelector('.fpwc-send');

  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(KEY) || '[]') || []; } catch (e) { history = []; }
  var busy = false;

  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-24))); } catch (e) {} }

  function esc(s) { return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Escape first, then turn emails, full URLs and bare frontporchwebllc.com links into anchors.
  function render(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\b([\w.+-]+@[\w-]+\.[\w.-]+\w)/g, '<a href="mailto:$1">$1</a>')
      .replace(/(^|[\s(])((?:https?:\/\/)?(?:www\.)?frontporchwebllc\.com(?:\/[\w\-./#?=]*)?)/g, function (m, pre, url) {
        var clean = url.replace(/[.,]+$/, ''), tail = url.slice(clean.length);
        var href = /^https?:/.test(clean) ? clean : 'https://' + clean;
        return pre + '<a href="' + href + '">' + clean + '</a>' + tail;
      })
      .replace(/\n/g, '<br>');
  }

  function bubble(role, text) {
    var el = document.createElement('div');
    el.className = 'fpwc-msg ' + (role === 'user' ? 'you' : 'bot');
    el.innerHTML = render(text);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function drawChips() {
    chips.innerHTML = '';
    if (history.length) return;
    CHIPS.forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', function () { ask(q); });
      chips.appendChild(b);
    });
  }

  function drawAll() {
    log.innerHTML = '';
    bubble('assistant', GREETING);
    history.forEach(function (m) { bubble(m.role, m.content); });
    drawChips();
  }

  function setOpen(open) {
    root.classList.toggle('open', open);
    launch.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('fpwc-lock', open);
    if (open) {
      if (!log.childElementCount) drawAll();
      setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
    } else {
      launch.focus({ preventScroll: true });
    }
  }

  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }

  async function ask(q) {
    q = (q || '').trim();
    if (!q || busy) return;
    busy = true;
    send.disabled = true;
    input.value = '';
    grow();
    history.push({ role: 'user', content: q.slice(0, 600) });
    save();
    chips.innerHTML = '';
    bubble('user', q);
    var out = bubble('assistant', '');
    out.classList.add('wait');
    log.setAttribute('aria-busy', 'true');

    var text = '';
    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12) }),
      });
      if (!res.ok || !res.body) {
        text = res.status === 429 || res.status === 503 ? await res.text()
          : 'Sorry, I could not answer that just now. You can email ' + CONTACT + '.';
      } else {
        var reader = res.body.getReader(), dec = new TextDecoder();
        for (;;) {
          var chunk = await reader.read();
          if (chunk.done) break;
          text += dec.decode(chunk.value, { stream: true });
          out.classList.remove('wait');
          out.innerHTML = render(text);
          log.scrollTop = log.scrollHeight;
        }
      }
    } catch (e) {
      text = text || 'Sorry, I lost the connection. You can email ' + CONTACT + '.';
    }
    text = text.trim() || 'Sorry, I could not answer that just now. You can email ' + CONTACT + '.';
    out.classList.remove('wait');
    out.innerHTML = render(text);
    log.scrollTop = log.scrollHeight;
    history.push({ role: 'assistant', content: text });
    save();
    log.removeAttribute('aria-busy');
    busy = false;
    send.disabled = false;
  }

  launch.addEventListener('click', function () { setOpen(true); });
  closeBtn.addEventListener('click', function () { setOpen(false); });
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) setOpen(false); });
  form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
  input.addEventListener('input', grow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
  });
})();
