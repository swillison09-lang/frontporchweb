// Animated feed renderers shared by the handset previews and the commandeered screens.
window.Feeds = (() => {
  const CYAN = '232,121,249';

  // Wireframe humanoid built from line segments (x, y, z), roughly 2 units tall.
  const J = {
    head: [0, 1.75, 0], neck: [0, 1.5, 0], chest: [0, 1.3, 0], hip: [0, .9, 0],
    lsh: [-.32, 1.45, 0], rsh: [.32, 1.45, 0], lel: [-.45, 1.1, .05], rel: [.45, 1.1, .05],
    lha: [-.5, .8, .12], rha: [.5, .8, .12], lhp: [-.16, .88, 0], rhp: [.16, .88, 0],
    lkn: [-.18, .45, .04], rkn: [.18, .45, .04], lft: [-.2, 0, .08], rft: [.2, 0, .08],
  };
  const BONES = [
    ['head', 'neck'], ['neck', 'chest'], ['chest', 'hip'], ['neck', 'lsh'], ['neck', 'rsh'],
    ['lsh', 'lel'], ['lel', 'lha'], ['rsh', 'rel'], ['rel', 'rha'], ['hip', 'lhp'], ['hip', 'rhp'],
    ['lhp', 'lkn'], ['lkn', 'lft'], ['rhp', 'rkn'], ['rkn', 'rft'], ['lsh', 'chest'], ['rsh', 'chest'],
    ['lsh', 'lhp'], ['rsh', 'rhp'],
  ];
  // Panels: closed outlines (x, y, z) that rotate with the skeleton.
  const PLATES = [
    [[-.34, 1.5, .1], [.34, 1.5, .1], [.26, 1.0, .14], [-.26, 1.0, .14]],           // chest
    [[-.14, 1.95, .02], [.14, 1.95, .02], [.16, 1.62, .04], [-.16, 1.62, .04]],     // helmet
    [[-.48, 1.5, .02], [-.3, 1.5, .02], [-.36, 1.25, .06], [-.52, 1.25, .06]],      // L shoulder
    [[.48, 1.5, .02], [.3, 1.5, .02], [.36, 1.25, .06], [.52, 1.25, .06]],          // R shoulder
    [[-.3, .9, .08], [-.08, .9, .08], [-.1, .4, .1], [-.28, .4, .1]],               // L thigh
    [[.3, .9, .08], [.08, .9, .08], [.1, .4, .1], [.28, .4, .1]],                   // R thigh
  ];

  function intel(ctx, w, h, t, big) {
    ctx.fillStyle = '#0c0410'; ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, big ? 40 : 14);
    const a = t * .6, s = h * .38, cx = w * .5, cy = h * .9;
    const proj = ([x, y, z]) => {
      const rx = x * Math.cos(a) - z * Math.sin(a), rz = x * Math.sin(a) + z * Math.cos(a);
      const p = 3 / (3 + rz);
      return [cx + rx * s * p, cy - y * s * p, rz];
    };
    ctx.lineWidth = big ? 2 : 1;
    ctx.shadowColor = `rgb(${CYAN})`; ctx.shadowBlur = big ? 12 : 4;
    // plates first, dimmer when they face away
    for (const plate of PLATES) {
      const pts = plate.map(proj), depth = pts.reduce((m, p) => m + p[2], 0) / pts.length;
      ctx.strokeStyle = `rgba(${CYAN},${depth > 0 ? .3 : .75})`;
      ctx.fillStyle = `rgba(${CYAN},${depth > 0 ? .03 : .08})`;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${CYAN},.9)`;
    ctx.beginPath();
    for (const [a1, b1] of BONES) { const p = proj(J[a1]), q = proj(J[b1]); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
    ctx.stroke();
    const hp = proj(J.head); ctx.beginPath(); ctx.arc(hp[0], hp[1], s * .12, 0, 7); ctx.stroke();
    const cp = proj(J.chest); ctx.beginPath(); ctx.arc(cp[0], cp[1], s * .05, 0, 7);
    ctx.fillStyle = `rgba(${CYAN},${.6 + .4 * Math.sin(t * 6)})`; ctx.fill();
    ctx.shadowBlur = 0;
    // scan line
    const sy = (t * .35 % 1) * h;
    ctx.fillStyle = `rgba(${CYAN},.12)`; ctx.fillRect(0, sy, w, big ? 4 : 2);
    if (big) {
      label(ctx, 40, 95, 'MODEL 01 · STRUCTURAL SCAN', 22);
      label(ctx, 40, 125, `SOURCE: HANDSET · MATCH ${(87 + Math.sin(t) * 3).toFixed(1)}%`, 16, .7);
      // readouts down the right side, each with a tiny bar that breathes
      const stats = [['POWER', .62 + .05 * Math.sin(t * 1.3)], ['LOAD', .18], ['SIGNAL', .81 + .04 * Math.sin(t * 2.1)], ['STABILITY', .44 + .1 * Math.abs(Math.sin(t * 3))]];
      stats.forEach(([name, v], i) => {
        const y = h * .3 + i * 42, x = w - 260;
        label(ctx, x, y, name, 14, .7);
        ctx.strokeStyle = `rgba(${CYAN},.35)`; ctx.strokeRect(x + 100, y - 12, 120, 12);
        ctx.fillStyle = v < .2 ? 'rgba(255,184,77,.8)' : `rgba(${CYAN},.7)`; ctx.fillRect(x + 100, y - 12, 120 * v, 12);
      });
      label(ctx, 40, h - 75, `ROT ${(a * 57.3 % 360).toFixed(0).padStart(3, '0')}°   STATUS: NOMINAL   ALL SYSTEMS GO`, 16, .7);
    }
  }

  const blips = Array.from({ length: 7 }, () => ({ a: Math.random() * 6.28, r: .2 + Math.random() * .75 }));
  function radar(ctx, w, h, t, big) {
    ctx.fillStyle = '#0c0410'; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .44, sweep = t * 1.4 % 6.283;
    ctx.strokeStyle = `rgba(${CYAN},.35)`; ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, 7); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    const g = ctx.createConicGradient ? ctx.createConicGradient(sweep - .9, cx, cy) : null;
    if (g) {
      g.addColorStop(0, `rgba(${CYAN},0)`); g.addColorStop(.143, `rgba(${CYAN},.45)`); g.addColorStop(.144, `rgba(${CYAN},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    }
    for (const b of blips) {
      let d = (sweep - b.a + 6.283) % 6.283;
      const alpha = Math.max(0, 1 - d / 3);
      const x = cx + Math.cos(b.a) * b.r * R, y = cy + Math.sin(b.a) * b.r * R;
      ctx.fillStyle = `rgba(255,184,77,${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, big ? 6 : 2.5, 0, 7); ctx.fill();
      if (big && alpha > .2) label(ctx, x + 10, y - 8, `TGT-${Math.floor(b.a * 100)}`, 13, alpha);
    }
    if (big) {
      label(ctx, 40, 95, 'PROXIMITY SCAN', 22);
      label(ctx, 40, 125, '7 CONTACTS · ALL TRACKED', 16, .7);
    }
  }

  // Rotating wireframe globe with node pings and arcs back to home base.
  const SITES = [[38.9, -77], [55.7, 37.6], [39.9, 116.4], [35.7, 51.4], [39, 125.7], [-23.5, -46.6], [51.5, -.1]];
  const HOME = [34, -118.4]; // home base
  function globe(ctx, w, h, t, big) {
    ctx.fillStyle = '#0c0410'; ctx.fillRect(0, 0, w, h);
    if (big) grid(ctx, w, h, 40);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .4, spin = t * .25, tilt = .35;
    const toXYZ = (lat, lon) => {
      const la = lat * Math.PI / 180, lo = lon * Math.PI / 180 + spin;
      let x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      return [cx + x * R, cy - y2 * R, z2];
    };
    const path = (pts, alphaFront, alphaBack) => {
      // split the polyline where it crosses the horizon so the back half can be dimmer
      for (const front of [false, true]) {
        ctx.strokeStyle = `rgba(${CYAN},${front ? alphaFront : alphaBack})`;
        ctx.beginPath(); let pen = false;
        for (const p of pts) {
          const vis = p[2] >= 0;
          if (vis === front) { pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); pen = true; } else pen = false;
        }
        ctx.stroke();
      }
    };
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) path(Array.from({ length: 73 }, (_, i) => toXYZ(lat, i * 5)), .4, .08);
    for (let lon = 0; lon < 180; lon += 30) path(Array.from({ length: 73 }, (_, i) => toXYZ(i * 2.5 - 90, lon)), .4, .08);
    ctx.strokeStyle = `rgba(${CYAN},.6)`; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    // arcs from each site to home, drawn as a lifted great-circle-ish curve
    const home = toXYZ(...HOME);
    SITES.forEach(([la, lo], i) => {
      const p = toXYZ(la, lo);
      const phase = (t * .5 + i * .37) % 1;
      if (p[2] >= 0 && home[2] >= 0) {
        const mx = (p[0] + home[0]) / 2, my = (p[1] + home[1]) / 2 - R * .35;
        ctx.strokeStyle = `rgba(${CYAN},.35)`; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(mx, my, home[0], home[1]); ctx.stroke();
        const u = phase, qx = (1 - u) ** 2 * p[0] + 2 * (1 - u) * u * mx + u * u * home[0], qy = (1 - u) ** 2 * p[1] + 2 * (1 - u) * u * my + u * u * home[1];
        ctx.fillStyle = `rgba(${CYAN},.9)`; ctx.beginPath(); ctx.arc(qx, qy, big ? 3 : 1.5, 0, 7); ctx.fill();
      }
      if (p[2] >= 0) {
        const ring = (t * 1.2 + i * .5) % 1;
        ctx.strokeStyle = `rgba(255,184,77,${1 - ring})`; ctx.beginPath(); ctx.arc(p[0], p[1], (big ? 4 : 2) + ring * (big ? 26 : 8), 0, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(255,184,77,.9)'; ctx.beginPath(); ctx.arc(p[0], p[1], big ? 4 : 2, 0, 7); ctx.fill();
        if (big) label(ctx, p[0] + 10, p[1] - 8, `NODE-${String(i + 1).padStart(2, '0')}`, 13, .8);
      }
    });
    if (home[2] >= 0) {
      ctx.shadowColor = `rgb(${CYAN})`; ctx.shadowBlur = 16;
      ctx.fillStyle = `rgba(${CYAN},1)`; ctx.beginPath(); ctx.arc(home[0], home[1], big ? 6 : 3, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      if (big) label(ctx, home[0] + 12, home[1] + 5, 'HOME BASE', 14);
    }
    if (big) {
      label(ctx, 40, 95, 'GLOBAL NETWORK', 22);
      label(ctx, 40, 125, `${SITES.length} ACTIVE SIGNALS · ALL LINKS SECURE`, 16, .7);
      label(ctx, 40, h - 75, `LONG ${((spin * 57.3) % 360).toFixed(1).padStart(5, '0')}°   SATELLITES: 4   LINK: NOMINAL`, 16, .7);
    }
  }

  function grid(ctx, w, h, step) {
    ctx.strokeStyle = `rgba(${CYAN},.07)`; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }
  function label(ctx, x, y, text, size, alpha = 1) {
    ctx.font = `${size}px "Share Tech Mono", monospace`;
    ctx.fillStyle = `rgba(${CYAN},${alpha})`; ctx.fillText(text, x, y);
  }

  const renderers = { intel, radar, globe };

  // Run a renderer on a canvas, resizing with its element. Returns a stop() function.
  function attach(canvas, name, big = false) {
    const ctx = canvas.getContext('2d');
    let raf, stopped = false;
    const frame = now => {
      if (stopped) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      (renderers[name] || intel)(ctx, w, h, now / 1000, big);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }

  return { attach, renderers };
})();
