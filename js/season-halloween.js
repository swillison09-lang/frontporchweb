/* ════════════════════════════════════════════════════════════
   HALLOWEEN SKIN for the Front Porch homepage scene.
   Loaded by scene.js only when index.html sets window.__season = 'halloween'.
   It restyles the existing scene (sky, fog, lights, glow colours) and adds
   seasonal props; it never replaces scene.js, so the homepage underneath
   stays the current one. Turn it off by deleting that one line in index.html.
   ════════════════════════════════════════════════════════════ */
export default function halloween(ctx) {
  const { THREE, scene, M, lamp, bulb, halo, doorLight, doorHalo, dusk, skyDome,
          firefliesA, firefliesB, house, makeGlowSprite, isMobile } = ctx;

  // deterministic randomness so every visit looks the same
  let seed = 31;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  /* ---------- sky: violet night, a pumpkin-orange band at the horizon ---------- */
  skyDome.material.map = canvasTex(16, 512, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.00, '#05030a');
    grad.addColorStop(0.22, '#0d0817');
    grad.addColorStop(0.36, '#1f1031');
    grad.addColorStop(0.44, '#3b1838');
    grad.addColorStop(0.48, '#83301d');
    grad.addColorStop(0.50, '#e3661d');
    grad.addColorStop(0.53, '#a9411a');
    grad.addColorStop(0.58, '#3d1611');
    grad.addColorStop(0.66, '#190a08');
    grad.addColorStop(1.00, '#0a0505');
    g.fillStyle = grad; g.fillRect(0, 0, 16, 512);
  });
  skyDome.material.needsUpdate = true;
  scene.fog.color.set(0x1b1224);
  scene.fog.near = 20; scene.fog.far = 100;
  document.body.style.background = '#0d0814';

  /* ---------- light: cold moonlight, orange candlelight ---------- */
  scene.traverse(o => {
    if (o.isHemisphereLight) { o.color.set(0x4a3a6c); o.groundColor.set(0x140c12); o.intensity = 1.3; }
    if (o.isDirectionalLight) { o.color.set(0xa8b6ff); o.intensity = 1.55; }
    if (o.isPointLight && o !== lamp && o !== doorLight) o.color.set(0xff7a22); // the path lanterns
    if (o.isSprite && o.material.map && o !== dusk) o.material.color.set(0xff9a50);
  });
  lamp.color.set(0xff8a2e);
  doorLight.color.set(0xff7424);
  halo.material.color.set(0xff9850);
  doorHalo.material.color.set(0xff8a40);
  dusk.material.color.set(0xe0501c);
  dusk.material.opacity = 0.32;
  M.glow.color.set(0xff8f3a);          // windows: candle-lit
  M.glowWarm.color.set(0xffa24a);
  M.door.color.set(0x3a2045);          // aubergine door for the night
  firefliesA.material.color.set(0xff8a2a);   // drifting embers
  firefliesB.material.color.set(0x9dff8a);   // will-o'-the-wisps

  /* ---------- the moon, low and huge, with a cold halo ---------- */
  const moonTex = canvasTex(256, 256, (g) => {
    const r = g.createRadialGradient(118, 112, 10, 128, 128, 124);
    r.addColorStop(0, '#fffbea'); r.addColorStop(.75, '#efe6c9'); r.addColorStop(.97, '#d9cfae'); r.addColorStop(1, 'rgba(217,207,174,0)');
    g.fillStyle = r; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.globalAlpha = .18; g.fillStyle = '#8f8670';
    [[90, 96, 22], [160, 80, 14], [150, 150, 26], [96, 168, 12], [178, 124, 9], [118, 132, 8]]
      .forEach(([x, y, rr]) => { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); });
  });
  const moonPos = new THREE.Vector3(-22, 31, -82);
  const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, transparent: true, depthWrite: false }));
  moonDisc.scale.setScalar(13);
  moonDisc.position.copy(moonPos);
  const moonGlow = makeGlowSprite(52, '#c8d2ff', 0.32);
  moonGlow.material.fog = false;
  moonGlow.position.copy(moonPos).add(new THREE.Vector3(0, 0, -1));
  scene.add(moonGlow, moonDisc);

  /* ---------- bats: silhouettes that flap by squashing ---------- */
  const batTex = canvasTex(128, 64, (g) => {
    g.fillStyle = '#07050a';
    g.beginPath(); g.moveTo(64, 30);
    g.quadraticCurveTo(40, 6, 3, 13); g.quadraticCurveTo(14, 21, 11, 31);
    g.quadraticCurveTo(22, 25, 28, 35); g.quadraticCurveTo(36, 27, 44, 39);
    g.quadraticCurveTo(52, 32, 64, 46);
    g.quadraticCurveTo(76, 32, 84, 39); g.quadraticCurveTo(92, 27, 100, 35);
    g.quadraticCurveTo(106, 25, 117, 31); g.quadraticCurveTo(114, 21, 125, 13);
    g.quadraticCurveTo(88, 6, 64, 30); g.fill();
    g.beginPath(); g.ellipse(64, 33, 6, 10, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(58, 26); g.lineTo(60, 17); g.lineTo(63, 25); g.moveTo(65, 25); g.lineTo(68, 17); g.lineTo(70, 26); g.fill();
  });
  const bats = [];
  const batMat = new THREE.SpriteMaterial({ map: batTex, transparent: true, depthWrite: false });
  const nBats = isMobile ? 9 : 14;
  for (let i = 0; i < nBats; i++) {
    const far = i < 5;                         // the first few wheel around the moon
    const s = new THREE.Sprite(batMat);
    const size = far ? 1.8 + rnd() * 1.2 : 0.55 + rnd() * 0.35;
    s.userData = {
      far, size, phase: rnd() * 6.28, speed: (far ? .12 : .32) + rnd() * .18,
      r: far ? 8 + rnd() * 9 : 5 + rnd() * 6, y: far ? moonPos.y + (rnd() - .5) * 10 : 4.2 + rnd() * 4,
      flap: 11 + rnd() * 6, dir: rnd() < .5 ? 1 : -1,
    };
    bats.push(s); scene.add(s);
  }

  /* ---------- jack-o'-lanterns ---------- */
  const skinTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#d9621b'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) { g.fillStyle = `rgba(120,40,0,${0.08 + 0.1 * Math.abs(Math.sin(x / w * Math.PI * 10))})`; g.fillRect(x, 0, 4, h); }
  });
  // the face sits at u = 0.25, which is the +z side of a three.js sphere
  const faceTex = (variant) => canvasTex(512, 256, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#fff';
    const cx = 128;
    const tri = (x1, y1, x2, y2, x3, y3) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill(); };
    tri(cx - 50, 122, cx - 30, 88, cx - 12, 122);          // eyes
    tri(cx + 12, 122, cx + 30, 88, cx + 50, 122);
    tri(cx - 8, 140, cx, 126, cx + 8, 140);                // nose
    g.beginPath();                                          // grin, with teeth
    g.moveTo(cx - 62, 146);
    if (variant === 0) {
      g.quadraticCurveTo(cx, 200, cx + 62, 146);
      g.lineTo(cx + 40, 160); g.lineTo(cx + 30, 150); g.lineTo(cx + 14, 166); g.lineTo(cx, 156);
      g.lineTo(cx - 14, 166); g.lineTo(cx - 30, 150); g.lineTo(cx - 40, 160);
    } else {
      g.lineTo(cx - 40, 156); g.lineTo(cx - 26, 146); g.lineTo(cx - 10, 160); g.lineTo(cx + 6, 146);
      g.lineTo(cx + 22, 160); g.lineTo(cx + 38, 146); g.lineTo(cx + 62, 150);
      g.quadraticCurveTo(cx, 206, cx - 62, 146);
    }
    g.closePath(); g.fill();
  }, false);
  const faces = [faceTex(0), faceTex(1)];
  const pumpkinGeo = (() => {
    const geo = new THREE.SphereGeometry(1, 40, 24);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const lon = Math.atan2(z, x), rib = 1 - 0.07 * (1 - Math.abs(Math.cos(lon * 5)));
      x *= rib; z *= rib; y *= 0.76;
      y -= Math.sign(y) * 0.14 * Math.exp(-(x * x + z * z) * 6);   // dimple top and bottom
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  })();
  const stemGeo = new THREE.CylinderGeometry(0.07, 0.12, 0.32, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4d5a22, roughness: 0.9 });
  const pumpkins = [];
  function addPumpkin(x, z, size, faceY, variant, groundY = 0) {
    const mat = new THREE.MeshStandardMaterial({
      map: skinTex, emissiveMap: faces[variant], emissive: 0xffa040, emissiveIntensity: 2.2, roughness: 0.55,
    });
    const g = new THREE.Group();
    const body = new THREE.Mesh(pumpkinGeo, mat);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.82; stem.rotation.z = 0.25;
    g.add(body, stem);
    g.scale.setScalar(size);
    g.position.set(x, groundY + size * 0.72, z);
    g.rotation.y = faceY;
    g.traverse(o => { if (o.isMesh) { o.castShadow = !isMobile; } });
    scene.add(g);
    pumpkins.push({ mat, phase: rnd() * 10 });
  }
  // on the porch, either side of the steps, facing the path
  addPumpkin(-1.55, 3.45, 0.36, 0.15, 0, 0.51);
  addPumpkin(1.6, 3.4, 0.3, -0.2, 1, 0.51);
  addPumpkin(-2.25, 3.3, 0.22, 0.4, 1, 0.51);
  // beside each path lantern
  const pathX = z => Math.sin(z * 0.24) * 1.15 + Math.sin(z * 0.07) * 0.7;
  [10, 20, 31, 43].forEach((z, i) => {
    const side = i % 2 ? 1 : -1, x = pathX(z) + side * 1.45;
    addPumpkin(x - side * 0.55, z + 0.4, 0.34 + (i % 2) * 0.06, -side * 0.35, i % 2);
  });
  const porchCandle = new THREE.PointLight(0xff7a22, 6, 5, 2);
  porchCandle.position.set(0, 1.0, 3.6);
  scene.add(porchCandle);

  /* ---------- ghosts: sheet ghosts drifting through the yard ---------- */
  const ghostGeo = (() => {
    const pts = [[0.56, 0], [0.5, 0.3], [0.43, 0.8], [0.41, 1.1], [0.37, 1.35], [0.27, 1.55], [0.13, 1.67], [0.0, 1.71]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(pts, 36);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.05) {
      const lon = Math.atan2(p.getZ(i), p.getX(i));
      p.setY(i, p.getY(i) + 0.09 * Math.sin(lon * 7));          // ragged hem
    }
    geo.computeVertexNormals();
    return geo;
  })();
  const ghostMat = new THREE.MeshStandardMaterial({ color: 0xeef2ff, emissive: 0x7d8cc0, emissiveIntensity: 0.55, roughness: 0.6,
    transparent: true, opacity: 0.66, side: THREE.DoubleSide, depthWrite: false });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x07050a });
  const ghosts = [[-11.5, 7, 1.2], [6.8, -0.5, 1.0], [8.2, 19, 0.95]].map(([x, z, s], i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(ghostGeo, ghostMat));
    const eye = new THREE.SphereGeometry(0.055, 10, 8);
    [-0.11, 0.11].forEach(ex => { const e = new THREE.Mesh(eye, eyeMat); e.scale.set(1, 1.5, .6); e.position.set(ex, 1.38, 0.35); g.add(e); });
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeMat); mouth.scale.set(1, 1.3, .5); mouth.position.set(0, 1.2, 0.38); g.add(mouth);
    g.scale.setScalar(s);
    scene.add(g);
    return { g, x, z, phase: i * 2.1 };
  });

  /* ---------- a little graveyard under the trees ---------- */
  {
    const sh = new THREE.Shape();
    sh.moveTo(-0.38, 0); sh.lineTo(0.38, 0); sh.lineTo(0.38, 0.7); sh.absarc(0, 0.7, 0.38, 0, Math.PI, false); sh.lineTo(-0.38, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 12 });
    const mat = new THREE.MeshStandardMaterial({ color: 0x6f6a75, roughness: 1 });
    [[-7.2, 9.5], [-8.6, 11.2], [-6.6, 12.6], [-9.4, 8.6], [7.6, 13.5], [8.8, 11.8]].forEach(([x, z], i) => {
      const m = new THREE.Mesh(geo, mat);
      const s = 0.85 + rnd() * 0.4;
      m.scale.setScalar(s);
      m.position.set(x, -0.05, z);
      m.rotation.set(-0.08 + rnd() * 0.16, 0.5 * (x < 0 ? 1 : -1) + (rnd() - .5) * .5, (rnd() - .5) * 0.22);
      m.castShadow = !isMobile;
      scene.add(m);
    });
  }

  /* ---------- spider web in the porch corner, and its spider ---------- */
  {
    const cx = 2.77, cy = 3.02, z = 3.56, pts = [];
    const spokes = 7, R = 0.75;
    const ang = k => Math.PI + (k / (spokes - 1)) * (Math.PI / 2);     // fan between the post and the beam
    for (let k = 0; k < spokes; k++) pts.push(cx, cy, z, cx + Math.cos(ang(k)) * R, cy + Math.sin(ang(k)) * R, z);
    for (let ring = 1; ring <= 5; ring++) {
      const r = ring / 5 * R * 0.95;
      for (let k = 0; k < spokes - 1; k++) {
        const sag = 0.92;
        pts.push(cx + Math.cos(ang(k)) * r, cy + Math.sin(ang(k)) * r, z,
                 cx + Math.cos(ang(k + 1)) * r * sag, cy + Math.sin(ang(k + 1)) * r * sag, z);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xdedcf0, transparent: true, opacity: 0.5 })));
  }
  const spider = new THREE.Group();
  {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0b080d, roughness: 0.5 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bodyMat);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), bodyMat); h.position.y = -0.065;
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 4), new THREE.MeshBasicMaterial({ color: 0xdedcf0, transparent: true, opacity: .5 }));
    thread.position.y = 0.5;
    spider.add(b, h, thread);
    spider.position.set(-2.3, 2.4, 3.65);
    scene.add(spider);
  }

  /* ---------- low mist banks rolling over the lawn ---------- */
  const mist = [];
  for (let i = 0; i < (isMobile ? 6 : 10); i++) {
    const s = makeGlowSprite(16 + rnd() * 10, '#6c5a8e', 0.13);
    s.material.blending = THREE.NormalBlending;
    const x = (rnd() - .5) * 30, z = 6 + rnd() * 34;
    s.position.set(x, 0.7, z);
    scene.add(s);
    mist.push({ s, x, z, ph: rnd() * 6 });
  }

  /* ---------- per-frame ---------- */
  const flick = (t, ph) => 0.82 + 0.12 * Math.sin(t * 9.1 + ph) * Math.sin(t * 5.3 + ph * 2) + 0.06 * Math.sin(t * 23 + ph);
  return {
    update(t) {
      // candles inside everything
      pumpkins.forEach(p => { p.mat.emissiveIntensity = 2.3 * flick(t, p.phase); });
      M.glow.color.setRGB(1.0, 0.52, 0.2).multiplyScalar(0.9 * flick(t, 1.3));
      porchCandle.intensity = 6 * flick(t, 4.2);
      // scene.js resets the porch bulb colour each frame; keep its flicker, swap the hue
      const on = bulb.material.color.getHex() === 0xffd98f;
      M.glowWarm.color.setHex(on ? 0xffa24a : 0x5a2a12);
      // bats
      bats.forEach(b => {
        const u = b.userData, a = t * u.speed * u.dir + u.phase;
        if (u.far) b.position.set(moonPos.x + Math.cos(a) * u.r, u.y + Math.sin(a * 2.3) * 1.5, moonPos.z + 6 + Math.sin(a) * 4);
        else b.position.set(Math.cos(a) * u.r, u.y + Math.sin(a * 3.1) * 0.6, -0.5 + Math.sin(a) * u.r * 0.8);
        const f = Math.abs(Math.sin(t * u.flap + u.phase));
        b.scale.set(u.size * (0.75 + 0.25 * f), u.size * 0.5 * (0.35 + 0.65 * f), 1);
      });
      // ghosts drift, bob and sway
      ghosts.forEach((gh, i) => {
        const a = t * 0.18 + gh.phase;
        gh.g.position.set(gh.x + Math.sin(a) * 1.6, 0.35 + Math.sin(t * 1.3 + gh.phase) * 0.22, gh.z + Math.cos(a * 0.7) * 1.2);
        gh.g.rotation.z = Math.sin(t * 1.1 + gh.phase) * 0.08;
        gh.g.rotation.y = Math.sin(a) * 0.4 + (i === 1 ? -0.6 : 0.3);
      });
      // spider dangles
      spider.position.y = 2.35 + Math.sin(t * 0.7) * 0.18;
      spider.children[2].scale.y = 3.06 - spider.position.y;
      spider.children[2].position.y = (3.06 - spider.position.y) / 2;
      // mist rolls
      mist.forEach(m => { m.s.position.x = m.x + Math.sin(t * 0.06 + m.ph) * 2.2; m.s.position.z = m.z + Math.cos(t * 0.05 + m.ph) * 1.2; });
    },
  };
}
