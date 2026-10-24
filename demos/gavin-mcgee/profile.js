// Gavin McGee profile v2: interactive velocity chart, pitch speed bands, small reveals.
(function () {
  var data = JSON.parse(document.getElementById('data').textContent);
  var NS = 'http://www.w3.org/2000/svg';
  var el = function (tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  var fmtDate = function (iso) { var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

  /* ---------- velocity chart ---------- */
  var svg = document.getElementById('velo-chart'), tip = document.getElementById('tip');
  var W = 900, H = 400, L = 52, R = 26, T = 28, B = 46, lo = 64, hi = 96;
  var ev = data.events, t0 = new Date(ev[0].d).getTime(), t1 = new Date(ev[ev.length - 1].d).getTime();
  var X = function (iso) { return L + (new Date(iso).getTime() - t0) / (t1 - t0) * (W - L - R); };
  var Y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
  for (var v = 68; v <= 96; v += 4) {
    el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), 'class': 'g' }, svg);
    el('text', { x: L - 10, y: Y(v) + 4, 'class': 'ax', 'text-anchor': 'end' }, svg).textContent = v;
  }
  [2024, 2025, 2026].forEach(function (y) {
    var x = X(y + '-01-01');
    el('line', { x1: x, x2: x, y1: T, y2: H - B, 'class': 'g yr' }, svg);
    el('text', { x: x, y: H - 16, 'class': 'ax', 'text-anchor': 'middle' }, svg).textContent = y;
  });
  // Trackman fastball range: one shaded bar per event that has it
  var gRng = el('g', { 'data-layer': 'rng' }, svg);
  ev.forEach(function (e) { if (e.tm) el('rect', { x: X(e.d) - 6, y: Y(e.tm[1]), width: 12, height: Y(e.tm[0]) - Y(e.tm[1]), rx: 6, 'class': 'band' }, gRng); });
  var path = function (pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L'); };
  var fbPts = ev.map(function (e) { return [X(e.d), Y(e.max)]; });
  var cbPts = ev.filter(function (e) { return e.cb; }).map(function (e) { return [X(e.d), Y(e.cb)]; });
  var gCb = el('g', { 'data-layer': 'cb' }, svg); gCb.style.display = 'none';
  var cbLine = el('path', { d: path(cbPts), 'class': 'ln cb draw' }, gCb);
  cbPts.forEach(function (p) { el('circle', { cx: p[0], cy: p[1], r: 4, 'class': 'pt cb' }, gCb); });
  var gFb = el('g', { 'data-layer': 'fb' }, svg);
  var fbLine = el('path', { d: path(fbPts), 'class': 'ln fb draw' }, gFb);
  var dots = fbPts.map(function (p, i) { return el('circle', { cx: p[0], cy: p[1], r: i === fbPts.length - 1 ? 7 : 4.5, 'class': 'pt' + (i === fbPts.length - 1 ? ' sel' : '') }, gFb); });
  var last = fbPts[fbPts.length - 1];
  el('text', { x: last[0] - 12, y: last[1] - 14, 'class': 'lab', 'text-anchor': 'end' }, svg).textContent = '94 mph · Jul 2026';
  [fbLine, cbLine].forEach(function (p) { p.style.setProperty('--len', Math.ceil(p.getTotalLength())); });

  // big invisible hit areas so a thumb can pick an event
  function show(i) {
    var e = ev[i];
    dots.forEach(function (d, k) { d.setAttribute('class', 'pt' + (k === i ? ' sel' : '')); d.setAttribute('r', k === i ? 7 : 4.5); });
    var bits = [e.max + ' mph max'];
    if (e.tm) bits.push('Trackman ' + e.tm[0] + '–' + e.tm[1]);
    if (e.cb) bits.push('curveball ' + e.cb);
    tip.innerHTML = '<b>' + fmtDate(e.d) + ' · ' + e.n + '</b><span>' + bits.join(' · ') + '</span>';
  }
  ev.forEach(function (e, i) {
    var prev = i ? X(ev[i - 1].d) : L, next = i < ev.length - 1 ? X(ev[i + 1].d) : W - R, x = X(e.d);
    var r = el('rect', { x: (prev + x) / 2, y: T, width: (x + next) / 2 - (prev + x) / 2, height: H - T - B, 'class': 'hit', tabindex: 0, role: 'button', 'aria-label': fmtDate(e.d) + ', ' + e.n + ', ' + e.max + ' mph' }, svg);
    r.addEventListener('pointerenter', function () { show(i); });
    r.addEventListener('click', function () { show(i); });
    r.addEventListener('focus', function () { show(i); });
  });
  document.querySelectorAll('.tgl').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
      svg.querySelector('[data-layer="' + b.dataset.line + '"]').style.display = on ? '' : 'none';
    });
  });
  // phones: the chart scrolls sideways; start at the 94 end
  var wrap = document.querySelector('.chart-wrap'); if (wrap && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = wrap.scrollWidth;

  /* ---------- pitch speed bands ---------- */
  var bands = document.getElementById('bands'), bl = 76, bh = 96, pct = function (v) { return (v - bl) / (bh - bl) * 100; };
  var html = data.pitches.map(function (p, i) {
    return '<div class="brow"><b>' + p.n + '</b><div class="btrack">' +
      '<span class="bfill" style="left:' + pct(p.lo) + '%;width:' + Math.max(2, pct(p.hi) - pct(p.lo)) + '%;transition-delay:' + (i * 0.08) + 's;background:' + (i === 0 ? 'var(--navy)' : 'var(--blue)') + '"></span>' +
      '<span class="bmax" style="left:' + pct(p.max) + '%"></span>' +
      '<span class="bval" style="left:' + pct(p.max) + '%">' + p.max + '</span></div></div>';
  }).join('');
  var ticks = ''; for (var t = 76; t <= 96; t += 4) ticks += '<span style="left:' + pct(t) + '%">' + t + '</span>';
  bands.innerHTML = html + '<div class="baxis"><span></span><div>' + ticks + '</div></div>';

  /* ---------- reveals ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
  }, { threshold: 0.25 }) : null;
  [svg, bands].forEach(function (n) { if (io) io.observe(n); else n.classList.add('in'); });

  // hero number counts up once
  var big = document.querySelector('[data-count]');
  if (big) { var target = +big.dataset.count, s0 = performance.now(); big.textContent = '0';
    (function step(now) { var k = Math.min(1, (now - s0) / 1200), v = Math.round(target * (1 - Math.pow(1 - k, 3))); big.textContent = v; if (k < 1) requestAnimationFrame(step); })(s0); }
})();
