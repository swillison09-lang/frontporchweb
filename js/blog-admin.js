/*
  Front Porch Web — blog editor
  ─────────────────────────────────────────────────────────────────────
  Who can use this page is decided by the database, not by this file.
  Row Level Security (see blog-schema.sql) means an editor can only read
  and write posts for sites listed for their email in `site_editors`.
  Sean's owner emails bypass that and see every site. Nothing here is a
  security boundary — it only shapes the UI around what the DB permits.

  Posts are stored twice on purpose:
    body_md    what the writer typed, reloaded for editing
    body_html  rendered once here on save, so client sites render posts
               instantly with no markdown library of their own
  Raw HTML in a post is escaped before rendering, so a post can never
  inject script into a client's live website.
*/

const OWNER_EMAILS = [
  'swillison09@gmail.com',
  'swillison@motoringlabs.com',
  'frontporchwebllc@gmail.com',
];

const $ = (id) => document.getElementById(id);

let me       = null;   // { email }
let isOwner  = false;
let sites    = [];     // [{ site_slug, site_name }]
let current  = null;   // post being edited (null = list view)
let dirty    = false;

// ── helpers ────────────────────────────────────────────────────────────────

function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('err', !!isErr);
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), isErr ? 5200 : 2600);
}

function slugify(s) {
  return String(s || '')
    // Split accented letters into base + mark, then drop the marks, so
    // "Ünïcode" becomes "unicode" rather than losing the letters entirely.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

// Escape first, then render. marked no longer sanitizes, and these posts are
// injected into client websites — a stray <script> must never survive.
function renderMarkdown(md) {
  const escaped = String(md || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return marked.parse(escaped, { breaks: true, gfm: true });
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function setStatus(msg) { $('status').textContent = msg || ''; }

// ── auth ───────────────────────────────────────────────────────────────────

async function refreshAuth() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session?.user) {
    me = null;
    $('gate').classList.remove('hidden');
    $('app').classList.add('hidden');
    $('bar').classList.add('hidden');
    $('signOut').classList.add('hidden');
    $('who').textContent = '';
    return;
  }
  me = { email: (session.user.email || '').toLowerCase() };
  isOwner = OWNER_EMAILS.includes(me.email);
  $('who').textContent = me.email + (isOwner ? ' · owner' : '');
  $('gate').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('signOut').classList.remove('hidden');
  await loadSites();
}

$('googleBtn').addEventListener('click', async () => {
  const { error } = await sbClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href.split('#')[0] },
  });
  if (error) $('gateMsg').textContent = error.message;
});

$('magicBtn').addEventListener('click', async () => {
  const email = $('magicEmail').value.trim();
  if (!email) { $('gateMsg').textContent = 'Enter your email address first.'; return; }
  $('magicBtn').disabled = true;
  const { error } = await sbClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split('#')[0] },
  });
  $('magicBtn').disabled = false;
  $('gateMsg').textContent = error
    ? error.message
    : 'Check your email for a sign-in link.';
});

$('signOut').addEventListener('click', async () => {
  if (dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
  await sbClient.auth.signOut();
  location.reload();
});

// ── sites ──────────────────────────────────────────────────────────────────

async function loadSites() {
  const { data, error } = await sbClient
    .from('site_editors')
    .select('site_slug, site_name')
    .order('site_name', { ascending: true });

  if (error) {
    toast('Could not load your websites: ' + error.message, true);
    return;
  }

  // Owner sees each site once even if several people can edit it.
  const seen = new Set();
  sites = (data || []).filter(r => {
    if (seen.has(r.site_slug)) return false;
    seen.add(r.site_slug);
    return true;
  });

  if (!sites.length) {
    $('listCard').classList.add('hidden');
    $('noAccess').classList.remove('hidden');
    $('noAccessMsg').textContent = isOwner
      ? 'No websites have blogs set up yet. A site appears here once it is added to site_editors.'
      : `You are signed in as ${me.email}, but no blog has been shared with this address yet. If this is unexpected, contact Front Porch Web — and check you used the same email your access was granted to.`;
    return;
  }

  $('noAccess').classList.add('hidden');
  $('listCard').classList.remove('hidden');
  const sel = $('siteSel');
  sel.innerHTML = '';
  sites.forEach(s => {
    const o = document.createElement('option');
    o.value = s.site_slug;
    o.textContent = s.site_name || s.site_slug;
    sel.append(o);
  });
  await loadPosts();
}

$('siteSel').addEventListener('change', loadPosts);

// ── post list ──────────────────────────────────────────────────────────────

async function loadPosts() {
  const slug = $('siteSel').value;
  if (!slug) return;
  const box = $('posts');
  box.innerHTML = '<p class="muted">Loading…</p>';

  const { data, error } = await sbClient
    .from('posts')
    .select('id, title, slug, status, published_at, updated_at')
    .eq('site_slug', slug)
    .order('updated_at', { ascending: false });

  if (error) { box.innerHTML = `<p class="muted">Could not load posts: ${error.message}</p>`; return; }

  if (!data.length) {
    box.innerHTML = '<p class="muted">No posts yet. Click “New post” to write the first one.</p>';
    return;
  }

  box.innerHTML = '';
  data.forEach(p => {
    const row = document.createElement('div');
    row.className = 'post-row';

    const t = document.createElement('div');
    t.className = 't';
    t.innerHTML = `${p.title || '(untitled)'}<small>${
      p.status === 'published'
        ? 'Published ' + fmtDate(p.published_at)
        : 'Edited ' + fmtDate(p.updated_at)
    }</small>`;

    const pill = document.createElement('span');
    pill.className = 'pill ' + p.status;
    pill.textContent = p.status;

    const edit = document.createElement('button');
    edit.className = 'btn btn-quiet';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openPost(p.id));

    row.append(t, pill, edit);
    box.append(row);
  });
}

// ── editor ─────────────────────────────────────────────────────────────────

function showList() {
  current = null;
  dirty = false;
  $('editCard').classList.add('hidden');
  $('bar').classList.add('hidden');
  $('listCard').classList.remove('hidden');
  loadPosts();
}

function showEditor() {
  $('listCard').classList.add('hidden');
  $('editCard').classList.remove('hidden');
  $('bar').classList.remove('hidden');
  $('editFor').textContent = 'On ' + ($('siteSel').selectedOptions[0]?.textContent || '');
  updatePreview();
}

function blankPost() {
  return {
    id: null, site_slug: $('siteSel').value, title: '', slug: '', excerpt: '',
    body_md: '', cover_image: null, author_name: '', status: 'draft', published_at: null,
  };
}

function fillForm(p) {
  $('title').value   = p.title || '';
  $('slug').value    = p.slug || '';
  $('excerpt').value = p.excerpt || '';
  $('author').value  = p.author_name || '';
  $('body').value    = p.body_md || '';
  setCover(p.cover_image);
  $('editTitle').textContent = p.id ? 'Edit post' : 'New post';
  $('deleteBtn').classList.toggle('hidden', !p.id);
  $('publishBtn').textContent = p.status === 'published' ? 'Update published post' : 'Publish';
  setStatus(p.id ? (p.status === 'published' ? 'Published ' + fmtDate(p.published_at) : 'Draft') : '');
  dirty = false;
}

function readForm() {
  const title = $('title').value.trim();
  return {
    ...current,
    site_slug:   $('siteSel').value,
    title,
    slug:        slugify($('slug').value || title),
    excerpt:     $('excerpt').value.trim() || null,
    author_name: $('author').value.trim() || null,
    body_md:     $('body').value,
    body_html:   renderMarkdown($('body').value),
  };
}

$('newBtn').addEventListener('click', () => { current = blankPost(); fillForm(current); showEditor(); });
$('backBtn').addEventListener('click', () => {
  if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
  showList();
});

async function openPost(id) {
  const { data, error } = await sbClient.from('posts').select('*').eq('id', id).single();
  if (error) { toast('Could not open that post: ' + error.message, true); return; }
  current = data;
  fillForm(data);
  showEditor();
}

// live preview + auto-slug
['title','body','excerpt','author','slug'].forEach(id => {
  $(id).addEventListener('input', () => {
    dirty = true;
    if (id === 'title' && (!current?.id || !$('slug').value)) {
      $('slug').value = slugify($('title').value);
    }
    if (id === 'title' || id === 'body') updatePreview();
  });
});

function updatePreview() {
  const title = $('title').value.trim();
  $('preview').innerHTML =
    (title ? `<h1>${title.replace(/</g,'&lt;')}</h1>` : '') +
    renderMarkdown($('body').value);
}

// ── cover photo (reuses the existing R2 upload worker) ─────────────────────

function setCover(url) {
  const img = $('coverImg');
  if (url) {
    img.src = url;
    img.classList.remove('hidden');
    $('coverClear').classList.remove('hidden');
  } else {
    img.removeAttribute('src');
    img.classList.add('hidden');
    $('coverClear').classList.add('hidden');
  }
  if (current) current.cover_image = url || null;
}

$('coverBtn').addEventListener('click', () => $('coverFile').click());
$('coverClear').addEventListener('click', () => { setCover(null); dirty = true; });

$('coverFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('That file is not an image.', true); return; }
  if (file.size > 10 * 1024 * 1024) { toast('Please choose an image under 10 MB.', true); return; }

  const token = await r2GetAccessToken();
  if (!token) { toast('Your session expired — sign in again.', true); return; }

  // The upload worker requires an id of 8-80 chars [A-Za-z0-9_-]; prefixing
  // with "blog-" keeps short site slugs valid.
  const uploadId = ('blog-' + $('siteSel').value).slice(0, 80);
  $('coverMsg').textContent = 'Uploading…';
  try {
    const { key } = await uploadFileToR2(file, {
      submissionId: uploadId,
      category: 'blog',
      token,
      onProgress: (p) => { $('coverMsg').textContent = `Uploading… ${Math.round(p * 100)}%`; },
    });
    setCover('https://images.frontporchwebllc.com/' + key);
    $('coverMsg').textContent = '';
    dirty = true;
    toast('Photo added.');
  } catch (err) {
    $('coverMsg').textContent = '';
    toast('Upload failed: ' + err.message, true);
  }
});

// ── save / publish / delete ────────────────────────────────────────────────

async function save(publish) {
  const p = readForm();

  if (!p.title) { toast('Give the post a title first.', true); return; }
  if (!p.slug)  { toast('The web address cannot be empty.', true); return; }
  if (publish && !p.body_md.trim()) { toast('Write something before publishing.', true); return; }

  if (publish) {
    p.status = 'published';
    p.published_at = current?.published_at || new Date().toISOString();
  } else if (!current?.id) {
    p.status = 'draft';
  }

  const row = {
    site_slug: p.site_slug, title: p.title, slug: p.slug, excerpt: p.excerpt,
    body_md: p.body_md, body_html: p.body_html, cover_image: p.cover_image,
    author_name: p.author_name, status: p.status, published_at: p.published_at,
  };

  $('saveBtn').disabled = $('publishBtn').disabled = true;
  setStatus('Saving…');

  let res;
  if (current?.id) {
    res = await sbClient.from('posts').update(row).eq('id', current.id).select().single();
  } else {
    res = await sbClient.from('posts').insert(row).select().single();
  }

  $('saveBtn').disabled = $('publishBtn').disabled = false;

  if (res.error) {
    setStatus('');
    const msg = res.error.code === '23505'
      ? 'Another post on this website already uses that web address. Change it and try again.'
      : res.error.message;
    toast('Could not save: ' + msg, true);
    return;
  }

  current = res.data;
  dirty = false;
  fillForm(current);
  toast(publish ? 'Published — it is live on the website now.' : 'Draft saved.');
}

$('saveBtn').addEventListener('click', () => save(false));
$('publishBtn').addEventListener('click', () => save(true));

$('deleteBtn').addEventListener('click', async () => {
  if (!current?.id) return;
  if (!confirm(`Delete “${current.title}”? This cannot be undone.`)) return;
  const { error } = await sbClient.from('posts').delete().eq('id', current.id);
  if (error) { toast('Could not delete: ' + error.message, true); return; }
  toast('Post deleted.');
  showList();
});

window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

// ── boot ───────────────────────────────────────────────────────────────────

sbClient.auth.onAuthStateChange(() => refreshAuth());
refreshAuth();
