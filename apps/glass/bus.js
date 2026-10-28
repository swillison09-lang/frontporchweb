// Message bus between the handset and the screens. It picks one of three transports:
//   relay    — served by server.py: SSE down, POST up, across your Wi-Fi.
//   supabase — config.js has Supabase keys (the Netlify version): Realtime broadcast,
//              so phone and screens can be on any network.
//   local    — anything else: BroadcastChannel, tabs in the same browser only.
// Online, devices meet in a private room whose code lives in the link (#room=…).
window.Bus = function Bus(role) {
  const id = Math.random().toString(36).slice(2, 10);
  const handlers = [], openHandlers = [], authHandlers = [];
  // Where a sign-in sends you back to: this page, minus the #hash (the room comes from storage).
  const returnUrl = () => location.href.split('#')[0];
  // channel: BroadcastChannel (local mode). rt: the Supabase realtime channel (online mode).
  let mode = 'local', channel = null, rt = null, sb = null, framesInflight = 0, lastFrame = 0, queue = Promise.resolve();

  const deliver = msg => handlers.forEach(h => h(msg));
  const room = joinRoom();

  const ready = (async () => {
    try {
      const r = await fetch('relay/info', { cache: 'no-store' });
      if (!r.ok) throw 0;
      const info = await r.json();
      mode = 'relay';
      bus.urls = info.urls;
      const es = new EventSource(`relay/events?id=${id}&role=${role}`);
      es.onmessage = e => { const m = JSON.parse(e.data); if (m.from !== id) deliver(m); };
      es.onopen = () => openHandlers.forEach(h => h()); // fires again after auto-reconnect
      es.onerror = () => bus.onstatus?.('reconnecting');
      await new Promise(res => es.addEventListener('open', res, { once: true }));
      return mode;
    } catch {}

    const cfg = window.GLASS_CONFIG || {};
    if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase?.createClient) {
      try {
        // Online from here on, even while the first connection is still being made:
        // a slow or failed first attempt (phone locked, tab in the background, weak
        // signal) is retried by supabase-js, never a reason to drop to one-browser mode.
        mode = 'supabase';
        await joinSupabase(cfg);
        return mode;
      } catch (err) {
        console.warn('Supabase could not start, falling back to this browser only:', err);
      }
    }

    mode = 'local';
    channel = new BroadcastChannel('glass-terminal');
    channel.onmessage = e => deliver(e.data);
    setTimeout(() => openHandlers.forEach(h => h()));
    return mode;
  })();

  async function joinSupabase(cfg) {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 40 } },
    });
    // Coming back from a sign-in, the login details are in the #hash; getSession() waits
    // until supabase-js has read (and cleared) them, then the room code goes back in.
    await sb.auth.getSession();
    if (!/room=/.test(location.hash)) history.replaceState(null, '', `${location.pathname}${location.search}#room=${room}`);
    sb.auth.onAuthStateChange((_event, session) => authHandlers.forEach(h => h(session)));
    rt = sb.channel(`glass:${room}`, { config: { broadcast: { self: false }, presence: { key: id } } });
    rt.on('broadcast', { event: 'msg' }, ({ payload }) => deliver(payload));
    // Presence tells the handset when a screen goes away (closed tab, TV off, lost Wi-Fi).
    rt.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const p of leftPresences) if (p.role === 'screen') deliver({ type: 'bye', id: p.id });
    });
    // Resolves on the first successful join, or after 8 s regardless so the app can carry
    // on ("connecting…") while supabase-js keeps retrying in the background.
    await new Promise(resolve => {
      const giveUpWaiting = setTimeout(resolve, 8000);
      rt.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          bus.connected = true;
          rt.track({ id, role });
          openHandlers.forEach(h => h()); // also after a reconnect
          clearTimeout(giveUpWaiting); resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          bus.connected = false;
          if (status !== 'CLOSED') console.warn('Glass: realtime', status, err || '', '(retrying)');
          bus.onstatus?.('reconnecting');
        }
      });
    });
  }

  const bus = {
    id, role, ready, room, urls: [], connected: false,
    get mode() { return mode; },
    on(h) { handlers.push(h); },
    onopen(h) { openHandlers.push(h); },
    // Online uploads need a signed-in owner account (Google or an emailed link).
    onauth(h) { authHandlers.push(h); },
    async session() { return sb ? (await sb.auth.getSession()).data.session : null; },
    signInGoogle() {
      return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl() } });
    },
    signInEmail(email) {
      return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: returnUrl(), shouldCreateUser: false } });
    },
    signOut() { return sb.auth.signOut(); },
    // The link that puts another device in this room.
    linkFor(page) {
      const base = mode === 'relay' && bus.urls[0] ? bus.urls[0] + '/' : location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
      return `${base}${page}${mode === 'supabase' ? `#room=${room}` : ''}`;
    },
    // Ordinary messages go one after another so they arrive in order (ink segments, fast
    // NEXT taps, takeover-then-media). `lossy` messages (camera frames) skip the line but
    // are dropped while the previous frame is still uploading, so a slow link lowers the
    // frame rate instead of building a backlog.
    post(msg, { lossy = false } = {}) {
      if (mode === 'local') { channel?.postMessage(msg); return; }
      if (mode === 'supabase') {
        // Free tier: keep the camera to ~5 fps so a demo stays well inside the message quota.
        if (lossy) {
          const now = Date.now();
          if (framesInflight > 0 || now - lastFrame < 200) return;
          lastFrame = now; framesInflight++;
        }
        const p = rt ? rt.send({ type: 'broadcast', event: 'msg', payload: { ...msg, from: id } }).catch(() => {}) : Promise.resolve();
        if (lossy) p.finally(() => framesInflight--);
        return; // one websocket, so order is already preserved
      }
      const send = () => fetch('relay/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...msg, from: id }), keepalive: !lossy,
      }).catch(() => {});
      if (lossy) {
        if (framesInflight > 0) return;
        framesInflight++;
        send().finally(() => framesInflight--);
      } else if (msg.type === 'release' || msg.type === 'bye') {
        send(); // sent while the page is closing: can't wait behind the queue
      } else {
        queue = queue.then(send);
      }
    },
    // Make a photo/video reachable by the screens: the relay, Supabase Storage, or a blob:
    // URL, which other same-origin tabs in this browser can open while this page stays alive.
    async upload(file) {
      if (mode === 'supabase') {
        if (!(await bus.session())) throw new Error('sign in to upload (Media tab)');
        const limit = (window.GLASS_CONFIG.maxUploadMB || 50) * 1024 * 1024;
        if (file.size > limit) throw new Error(`file too large (${limit / 1048576} MB max on the free plan)`);
        const ext = (file.name.match(/\.[a-z0-9]{1,5}$/i) || [''])[0].toLowerCase();
        const path = `${room}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const bucket = sb.storage.from(window.GLASS_CONFIG.bucket || 'glass');
        const { error } = await bucket.upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) {
          // Storage answers "row-level security" when the signed-in account isn't an owner.
          throw new Error(/row-level security|unauthorized|403/i.test(error.message)
            ? 'this account can\'t upload; sign in with a Front Porch owner email' : 'upload failed: ' + error.message);
        }
        return bucket.getPublicUrl(path).data.publicUrl;
      }
      if (mode !== 'relay') return URL.createObjectURL(file);
      const r = await fetch('relay/upload', {
        method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
      });
      if (!r.ok) throw new Error(r.status === 413 ? 'file too large (500 MB max)' : 'upload failed: ' + r.status);
      return (await r.json()).url;
    },
  };
  return bus;

  // Room code: from the link (#room=…) if present, else the one this device used last,
  // else a fresh random one. It is written back into the address bar so the link you
  // bookmark or add to your home screen keeps it.
  function joinRoom() {
    const fromLink = (location.hash.match(/room=([a-z0-9]{6,32})/i) || [])[1];
    let code = fromLink;
    try { code = code || localStorage.getItem('glass-room'); } catch {}
    if (!code) code = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    code = code.toLowerCase();
    try { localStorage.setItem('glass-room', code); } catch {}
    // Leave a sign-in callback (#access_token=… / #error=…) alone: supabase-js reads it first.
    const authCallback = /access_token=|error_description=|error=/.test(location.hash);
    if (!fromLink && !authCallback) history.replaceState(null, '', `${location.pathname}${location.search}#room=${code}`);
    // Opening another room's link in this same tab only changes the #hash, which doesn't
    // reload the page: reload so every connection moves to the new room.
    addEventListener('hashchange', () => {
      const next = (location.hash.match(/room=([a-z0-9]{6,32})/i) || [])[1];
      if (next && next.toLowerCase() !== code) {
        try { localStorage.setItem('glass-room', next.toLowerCase()); } catch {}
        location.reload();
      }
    });
    return code;
  }
};
