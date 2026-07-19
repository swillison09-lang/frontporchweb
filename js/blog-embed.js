/*
  Front Porch Web — client-site blog
  ─────────────────────────────────────────────────────────────────────
  Drop-in blog for a Premium client site. Reads published posts straight
  from Supabase at page load, so the client publishes in the editor and
  the post appears immediately — the site is never rebuilt or redeployed.

  HOW TO ADD IT TO A CLIENT SITE
    1. Put an empty container where the blog should appear:
         <div id="fpw-blog" data-site="their-site-slug"></div>
    2. Before </body>:
         <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
         <script src="https://frontporchwebllc.com/js/blog-embed.js"></script>
    3. Style it with the site's own palette by overriding the .fpwb-*
       classes, or pass data-accent / data-font to nudge the defaults.

  The site slug must match `site_slug` in the posts table.

  SAFETY
    body_html is rendered and escaped in the editor before it is stored
    (see js/blog-admin.js) — raw HTML in a post is neutralised there, so
    nothing a writer types can inject script into this page.

  Only rows with status = 'published' are readable by the public key, and
  that is enforced by database policy, not by this file.
*/
(function () {
  'use strict';

  var SUPABASE_URL = 'https://hxxtsthfqwyvkyuwnnsu.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_PfXE01_bSpA1CnTKg7nbHA_5w7_iJJR';
  var PAGE_SIZE    = 10;

  var mount = document.getElementById('fpw-blog');
  if (!mount) return;

  var siteSlug = mount.getAttribute('data-site');
  if (!siteSlug) {
    console.warn('[fpw-blog] Missing data-site attribute — nothing to load.');
    return;
  }

  var heading  = mount.getAttribute('data-heading') || 'News & Updates';
  var accent   = mount.getAttribute('data-accent')  || 'currentColor';
  var emptyMsg = mount.getAttribute('data-empty')   || '';

  // ── styles (scoped, and deliberately inheriting the host site's fonts
  //    and colours so the blog looks native to whatever site it sits in) ──
  var css = ''
    + '.fpwb{max-width:760px;margin:0 auto}'
    + '.fpwb-h{font-family:inherit;margin:0 0 22px}'
    + '.fpwb-list{display:grid;gap:22px;list-style:none;margin:0;padding:0}'
    + '.fpwb-card{display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:start;'
    +   'border:1px solid rgba(128,128,128,.22);border-radius:14px;overflow:hidden;'
    +   'background:rgba(255,255,255,.35);cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}'
    + '.fpwb-card:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,0,0,.09)}'
    + '.fpwb-card.nocover{grid-template-columns:1fr}'
    + '.fpwb-thumb{width:100%;height:100%;min-height:112px;object-fit:cover;display:block}'
    + '.fpwb-body{padding:16px 18px 18px}'
    + '.fpwb-card.nocover .fpwb-body{padding:18px}'
    + '.fpwb-t{font-family:inherit;font-size:1.15em;font-weight:600;margin:0 0 5px;line-height:1.25}'
    + '.fpwb-meta{font-size:.8em;opacity:.7;margin:0 0 8px}'
    + '.fpwb-ex{margin:0;opacity:.85;font-size:.95em}'
    + '.fpwb-empty{opacity:.7;font-style:italic}'
    + '.fpwb-more{margin-top:20px;text-align:center}'
    + '.fpwb-btn{font:inherit;cursor:pointer;background:none;border:1px solid rgba(128,128,128,.4);'
    +   'padding:9px 20px;border-radius:999px;color:inherit}'
    + '.fpwb-btn:hover{border-color:' + accent + '}'
    /* single post view */
    + '.fpwb-post{max-width:720px;margin:0 auto}'
    + '.fpwb-back{font:inherit;cursor:pointer;background:none;border:none;padding:0;'
    +   'color:' + accent + ';margin-bottom:16px;opacity:.9}'
    + '.fpwb-back:hover{opacity:1;text-decoration:underline}'
    + '.fpwb-cover{width:100%;border-radius:14px;margin:0 0 18px;display:block}'
    + '.fpwb-content{line-height:1.7}'
    + '.fpwb-content h1,.fpwb-content h2,.fpwb-content h3{font-family:inherit;line-height:1.25;margin:1.3em 0 .4em}'
    + '.fpwb-content p{margin:0 0 1em}'
    + '.fpwb-content ul,.fpwb-content ol{margin:0 0 1em 1.3em}'
    + '.fpwb-content li{margin:.25em 0}'
    + '.fpwb-content img{max-width:100%;border-radius:10px;margin:.6em 0}'
    + '.fpwb-content blockquote{border-left:3px solid ' + accent + ';padding-left:14px;margin:0 0 1em;opacity:.85}'
    + '.fpwb-content a{color:' + accent + '}'
    + '.fpwb-content code{background:rgba(128,128,128,.15);padding:1px 5px;border-radius:4px;font-size:.9em}'
    + '.fpwb-content pre{background:rgba(128,128,128,.13);padding:12px 14px;border-radius:10px;overflow-x:auto}'
    + '@media(max-width:560px){.fpwb-card{grid-template-columns:1fr}.fpwb-thumb{max-height:170px}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── data ────────────────────────────────────────────────────────────────
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('[fpw-blog] supabase-js did not load — blog not shown.');
    return;
  }
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  var posts = [];
  var shown = PAGE_SIZE;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined,
        { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function byline(p) {
    var d = fmtDate(p.published_at);
    return p.author_name ? (d ? d + ' · ' + p.author_name : p.author_name) : d;
  }

  // ── views ───────────────────────────────────────────────────────────────

  function renderList() {
    if (!posts.length) {
      mount.innerHTML = '<div class="fpwb">'
        + '<h2 class="fpwb-h">' + esc(heading) + '</h2>'
        + (emptyMsg ? '<p class="fpwb-empty">' + esc(emptyMsg) + '</p>' : '')
        + '</div>';
      // Nothing published yet: stay quiet rather than showing an empty shell.
      if (!emptyMsg) mount.style.display = 'none';
      return;
    }
    mount.style.display = '';

    var visible = posts.slice(0, shown);
    var html = '<div class="fpwb"><h2 class="fpwb-h">' + esc(heading) + '</h2><ul class="fpwb-list">';

    visible.forEach(function (p) {
      var cover = p.cover_image
        ? '<img class="fpwb-thumb" src="' + esc(p.cover_image) + '" alt="" loading="lazy">'
        : '';
      html += '<li class="fpwb-card' + (cover ? '' : ' nocover') + '" data-slug="' + esc(p.slug) + '" '
           +  'tabindex="0" role="link" aria-label="Read: ' + esc(p.title) + '">'
           +  cover
           +  '<div class="fpwb-body">'
           +    '<h3 class="fpwb-t">' + esc(p.title) + '</h3>'
           +    '<p class="fpwb-meta">' + esc(byline(p)) + '</p>'
           +    (p.excerpt ? '<p class="fpwb-ex">' + esc(p.excerpt) + '</p>' : '')
           +  '</div></li>';
    });

    html += '</ul>';
    if (posts.length > shown) {
      html += '<div class="fpwb-more"><button class="fpwb-btn" id="fpwb-more">Show older posts</button></div>';
    }
    html += '</div>';
    mount.innerHTML = html;

    Array.prototype.forEach.call(mount.querySelectorAll('.fpwb-card'), function (el) {
      var go = function () { location.hash = 'post/' + el.getAttribute('data-slug'); };
      el.addEventListener('click', go);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });

    var more = document.getElementById('fpwb-more');
    if (more) more.addEventListener('click', function () { shown += PAGE_SIZE; renderList(); });
  }

  function renderPost(slug) {
    var p = posts.filter(function (x) { return x.slug === slug; })[0];
    if (!p) { location.hash = ''; return; }

    document.title = p.title + ' — ' + document.title.split(' — ').pop();

    mount.style.display = '';
    mount.innerHTML = '<div class="fpwb-post">'
      + '<button class="fpwb-back" id="fpwb-back">&larr; All posts</button>'
      + (p.cover_image ? '<img class="fpwb-cover" src="' + esc(p.cover_image) + '" alt="">' : '')
      + '<h2 class="fpwb-h" style="margin-bottom:6px">' + esc(p.title) + '</h2>'
      + '<p class="fpwb-meta">' + esc(byline(p)) + '</p>'
      // body_html was escaped and rendered in the editor before storage.
      + '<div class="fpwb-content">' + (p.body_html || '') + '</div>'
      + '</div>';

    document.getElementById('fpwb-back').addEventListener('click', function () {
      location.hash = '';
    });
    mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function route() {
    var m = /^#post\/(.+)$/.exec(location.hash || '');
    if (m) renderPost(decodeURIComponent(m[1]));
    else renderList();
  }

  // ── load ────────────────────────────────────────────────────────────────
  sb.from('posts')
    .select('title, slug, excerpt, body_html, cover_image, author_name, published_at')
    .eq('site_slug', siteSlug)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .then(function (res) {
      if (res.error) {
        console.warn('[fpw-blog] Could not load posts:', res.error.message);
        mount.style.display = 'none';
        return;
      }
      posts = res.data || [];
      route();
      window.addEventListener('hashchange', route);
    });
})();
