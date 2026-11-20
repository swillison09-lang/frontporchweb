/* ════════════════════════════════════════════════════════════
   THANKSGIVING SKIN for the Front Porch homepage scene.
   Loaded by scene.js only when index.html sets window.__season = 'thanksgiving'.
   It restyles the existing scene and adds seasonal props; it never replaces
   scene.js, so the homepage underneath stays the current one. Turn it off by
   deleting that one line in index.html.
   The idea: the last hour of a late-November day, leaves coming down, and a
   long table set out in the yard with the lights already on. Everyone's invited.
   ════════════════════════════════════════════════════════════ */
export default function thanksgiving(ctx) {
  const { THREE, scene, camera, M, dusk, skyDome, firefliesA, firefliesB, stars,
          makeGlowSprite, isMobile } = ctx;

  // deterministic randomness so every visit looks the same
  let seed = 47;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // same terrain as environment.js, so props sit on the ground
  const heightAt = (x, z) => {
    const edge = Math.min(1, Math.max(0, (Math.abs(x) - 3.8) / 9));
    return edge * (Math.sin(x * .13 + z * .04) * .9 + Math.cos(z * .17) * .4 + .8);
  };
  const pathX = z => Math.sin(z * 0.24) * 1.15 + Math.sin(z * 0.07) * 0.7;

  /* ---------- sky: dusky plum overhead, rose then gold at the horizon ---------- */
  skyDome.material.map = canvasTex(16, 512, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.00, '#141526');
    grad.addColorStop(0.20, '#262238');
    grad.addColorStop(0.33, '#4a2f45');
    grad.addColorStop(0.42, '#8a4438');
    grad.addColorStop(0.47, '#d9772f');
    grad.addColorStop(0.50, '#f7bb5f');
    grad.addColorStop(0.53, '#d58a35');
    grad.addColorStop(0.58, '#6d3f18');
    grad.addColorStop(0.66, '#2f1c0c');
    grad.addColorStop(1.00, '#140c05');
    g.fillStyle = grad; g.fillRect(0, 0, 16, 512);
  });
  skyDome.material.needsUpdate = true;
  scene.fog.color.set(0x5a3a26);
  scene.fog.near = 24; scene.fog.far = 118;
  document.body.style.background = '#1a100b';

  /* ---------- light: low gold sun, warm bounce off the leaves ---------- */
  scene.traverse(o => {
    if (o.isHemisphereLight) { o.color.set(0xffc99a); o.groundColor.set(0x3a2312); o.intensity = 1.5; }
    if (o.isDirectionalLight) { o.color.set(0xffb26a); o.intensity = 2.1; }
  });
  dusk.material.color.set(0xff9a3c);
  dusk.material.opacity = 0.42;
  const sunGlow = makeGlowSprite(78, '#ffb45e', 0.5);
  sunGlow.material.fog = false;
  sunGlow.position.set(-30, 13, -92);
  scene.add(sunGlow);
  M.ground.color.set(0xa88b58);
  M.door.color.set(0x5e1f1a);          // cranberry door for the season
  firefliesA.material.color.set(0xffd9a0);   // no fireflies in November: gold dust in the light
  firefliesB.material.color.set(0xffb868);

  /* ---------- the trees turn ---------- */
  // Colour comes in slow patches across the yard rather than per leaf, so a tree
  // reads as one maple or one oak, and a few stay evergreen.
  {
    const autumn = [0x6e2414, 0x8a3518, 0xa04d1c, 0xb06a22, 0xb98a2a, 0xb39a38].map(h => new THREE.Color(h));
    const straw = new THREE.Color(0x8d7a45);
    const c = new THREE.Color(), mtx = new THREE.Matrix4(), pos = new THREE.Vector3();
    scene.traverse(o => {
      if (!o.isInstancedMesh || !o.instanceColor || o.material.side !== THREE.DoubleSide) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, mtx); pos.setFromMatrixPosition(mtx);
        if (pos.y - heightAt(pos.x, pos.z) > 1.1) {
          const n = 0.5 + 0.28 * Math.sin(pos.x * .23 + 1.3) + 0.22 * Math.sin(pos.z * .19 + pos.x * .07);
          if (Math.sin(pos.x * .41 + 2.1) * Math.sin(pos.z * .37) > 0.72) continue;   // evergreens
          const f = Math.min(.999, Math.max(0, n + (rnd() - .5) * .22)) * (autumn.length - 1);
          const k = Math.floor(f);
          c.copy(autumn[k]).lerp(autumn[k + 1], f - k).multiplyScalar(0.58 + rnd() * .34);
        } else {
          o.getColorAt(i, c); c.lerp(straw, .62);       // the grass has gone to straw
        }
        o.setColorAt(i, c);
      }
      o.instanceColor.needsUpdate = true;
    });
  }

  /* ---------- leaves: one shape, tinted per instance ---------- */
  const leafTex = canvasTex(64, 64, (g) => {
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(32, 2);
    g.quadraticCurveTo(41, 9, 40, 16); g.quadraticCurveTo(49, 11, 52, 17); g.quadraticCurveTo(50, 24, 46, 27);
    g.quadraticCurveTo(56, 26, 57, 33); g.quadraticCurveTo(50, 41, 41, 41); g.quadraticCurveTo(39, 48, 33.5, 50);
    g.lineTo(33.5, 62); g.lineTo(30.5, 62); g.lineTo(30.5, 50);
    g.quadraticCurveTo(25, 48, 23, 41); g.quadraticCurveTo(14, 41, 7, 33); g.quadraticCurveTo(8, 26, 18, 27);
    g.quadraticCurveTo(14, 24, 12, 17); g.quadraticCurveTo(15, 11, 24, 16); g.quadraticCurveTo(23, 9, 32, 2);
    g.closePath(); g.fill();
  });
  const leafMat = new THREE.MeshLambertMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide });
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  const leafColors = [0xa83516, 0xc4531a, 0xd97a22, 0xdda02c, 0x8a2a14].map(h => new THREE.Color(h));
  const dummy = new THREE.Object3D();

  // fallen on the lawn, thicker along the walk and on the porch
  {
    const n = isMobile ? 280 : 720;
    const litter = new THREE.InstancedMesh(leafGeo, leafMat, n);
    for (let i = 0; i < n; i++) {
      let x, y, z;
      const r = rnd();
      if (r < .07) { x = (rnd() - .5) * 5.8; z = 1.9 + rnd() * 1.75; y = 0.525; }
      else if (r < .5) { z = 4.8 + rnd() * 42; x = pathX(z) + (rnd() - .5) * 4.6; y = heightAt(x, z) + 0.075; }
      else { z = 2 + rnd() * 48; x = (rnd() - .5) * 34; y = heightAt(x, z) + 0.05; }
      dummy.position.set(x, y, z);
      dummy.rotation.set(-Math.PI / 2 + (rnd() - .5) * .3, (rnd() - .5) * .3, rnd() * 6.28);
      dummy.scale.setScalar(.16 + rnd() * .16);
      dummy.updateMatrix();
      litter.setMatrixAt(i, dummy.matrix);
      litter.setColorAt(i, leafColors[Math.floor(rnd() * leafColors.length)]);
    }
    scene.add(litter);
  }

  // coming down
  const nFall = isMobile ? 48 : 130;
  const falling = new THREE.InstancedMesh(leafGeo, leafMat, nFall);
  falling.frustumCulled = false;
  const fallers = [];
  for (let i = 0; i < nFall; i++) {
    fallers.push({ x: (rnd() - .5) * 22, z: 2 + rnd() * 40, ph: rnd(), sp: .035 + rnd() * .04,
      sway: .5 + rnd() * .9, sf: .7 + rnd() * .8, rx: .6 + rnd() * 1.4, ry: .4 + rnd(), s: .15 + rnd() * .13 });
    falling.setColorAt(i, leafColors[Math.floor(rnd() * leafColors.length)]);
  }
  scene.add(falling);

  /* ---------- geese heading south ---------- */
  const gooseTex = canvasTex(64, 32, (g) => {
    g.strokeStyle = '#1c1420'; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(3, 11); g.quadraticCurveTo(20, 9, 32, 19); g.quadraticCurveTo(44, 9, 61, 11); g.stroke();
    g.fillStyle = '#1c1420'; g.beginPath(); g.ellipse(32, 19, 3, 5, 0, 0, Math.PI * 2); g.fill();
  });
  const gooseMat = new THREE.SpriteMaterial({ map: gooseTex, transparent: true, depthWrite: false, fog: false });
  const geese = [];
  [[0, 0], [-1, 1], [1, 1], [-2, 2], [2, 2], [-3, 3], [3, 3], [-4, 4], [2.9, 4.2]].forEach(([side, back], i) => {
    const s = new THREE.Sprite(gooseMat);
    s.userData = { dx: -back * 3.1, dy: side * 1.25, ph: i * .7 };
    geese.push(s); scene.add(s);
  });

  /* ---------- pumpkins and gourds, whole this time ---------- */
  const pumpkinGeo = (() => {
    const geo = new THREE.SphereGeometry(1, 28, 18);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const lon = Math.atan2(z, x), rib = 1 - 0.07 * (1 - Math.abs(Math.cos(lon * 5)));
      x *= rib; z *= rib; y *= 0.76;
      y -= Math.sign(y) * 0.14 * Math.exp(-(x * x + z * z) * 6);
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  })();
  const stemGeo = new THREE.CylinderGeometry(0.07, 0.12, 0.32, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a5a24, roughness: 0.9 });
  const pumpkinMats = [0xc9651c, 0xd9862a, 0xe6dcc0, 0xb9531a].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  function addPumpkin(x, y, z, size, tone = 0) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.82; stem.rotation.z = 0.25;
    g.add(new THREE.Mesh(pumpkinGeo, pumpkinMats[tone]), stem);
    g.scale.setScalar(size);
    g.position.set(x, y + size * 0.72, z);
    g.rotation.y = rnd() * 6;
    g.traverse(o => { if (o.isMesh) o.castShadow = !isMobile; });
    scene.add(g);
  }

  /* ---------- hay bales and mums either side of the steps ---------- */
  {
    const strawTex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#b8964e'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.strokeStyle = ['#d9bc72', '#8f7236', '#e6cf8c', '#a5853f'][i % 4];
        g.lineWidth = 1; const x = rnd() * w, y = rnd() * h, a = (rnd() - .5) * .9;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); g.stroke();
      }
      g.fillStyle = '#6e5526'; g.fillRect(70, 0, 5, h); g.fillRect(180, 0, 5, h);   // twine
    });
    const baleMat = new THREE.MeshStandardMaterial({ map: strawTex, roughness: 1 });
    const baleGeo = new THREE.BoxGeometry(1.15, 0.5, 0.62);
    [[-1.82, 0.25, 4.34, .05], [1.84, 0.25, 4.36, -.08], [-1.82, 0.75, 4.32, -.1]].forEach(([x, y, z, ry]) => {
      const b = new THREE.Mesh(baleGeo, baleMat);
      b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = !isMobile;
      scene.add(b);
    });
    addPumpkin(-1.95, 1.0, 4.34, 0.2, 0);
    addPumpkin(-1.6, 1.0, 4.4, 0.13, 2);
    addPumpkin(1.68, 0.5, 4.38, 0.24, 1);
    addPumpkin(2.1, 0.5, 4.4, 0.15, 3);
    addPumpkin(-1.32, 0, 5.08, 0.19, 1);
    // on the deck, well back from the spindles at z = 3.6
    addPumpkin(-2.35, 0.51, 3.0, 0.22, 0);
    addPumpkin(2.38, 0.51, 2.98, 0.19, 2);

    // potted mums on the ground in front of the bales, clear of the railing
    const potGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.26, 12);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x7a4a2c, roughness: .9 });
    const bloomTex = canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#5c2a18'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 520; i++) {
        g.fillStyle = ['#c9551e', '#e08a2a', '#a62c1a', '#efb23c'][i % 4];
        g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 2, 0, 6.3); g.fill();
      }
    });
    const bloomMat = new THREE.MeshStandardMaterial({ map: bloomTex, roughness: 1 });
    const bloomGeo = new THREE.IcosahedronGeometry(0.31, 2);
    [-2.3, 2.34].forEach(x => {
      const pot = new THREE.Mesh(potGeo, potMat); pot.position.set(x, 0.13, 5.06);
      const bloom = new THREE.Mesh(bloomGeo, bloomMat); bloom.position.set(x, 0.41, 5.06); bloom.scale.y = .8;
      scene.add(pot, bloom);
    });
  }

  /* ---------- corn shocks standing on the ground off the porch corners ---------- */
  {
    const perShock = 15, stalkGeo = new THREE.CylinderGeometry(0.012, 0.024, 1, 5);
    stalkGeo.translate(0, 0.5, 0);
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const stalks = new THREE.InstancedMesh(stalkGeo, stalkMat, perShock * 2 * 2);
    const c = new THREE.Color(), from = new THREE.Vector3(), to = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    const seg = (a, b) => {
      dummy.position.copy(a);
      dummy.quaternion.setFromUnitVectors(up, to.copy(b).sub(a).normalize());
      dummy.scale.set(1, a.distanceTo(b), 1);
      dummy.updateMatrix();
      stalks.setMatrixAt(n, dummy.matrix);
      stalks.setColorAt(n, c.setHSL(.11 + rnd() * .03, .38, .38 + rnd() * .16));
      n++;
    };
    [[-3.08, 4.32], [3.08, 4.32]].forEach(([cx, cz]) => {
      const baseY = 0, tieY = 1.02;
      for (let i = 0; i < perShock; i++) {
        const a = (i / perShock) * 6.28 + rnd() * .3;
        const tie = new THREE.Vector3(cx + Math.cos(a) * .1, tieY, cz + Math.sin(a) * .1);
        from.set(cx + Math.cos(a) * (.24 + rnd() * .1), baseY, cz + Math.sin(a) * (.24 + rnd() * .1));
        seg(from.clone(), tie);
        seg(tie, new THREE.Vector3(cx + Math.cos(a) * (.2 + rnd() * .2), 1.85 + rnd() * .6, cz + Math.sin(a) * (.2 + rnd() * .2)));
      }
      const band = new THREE.Mesh(new THREE.TorusGeometry(.125, .018, 6, 14),
        new THREE.MeshStandardMaterial({ color: 0x6e2a1c, roughness: .9 }));
      band.rotation.x = Math.PI / 2; band.position.set(cx, tieY, cz);
      scene.add(band);
    });
    stalks.castShadow = !isMobile;
    scene.add(stalks);
  }

  /* ---------- a leaf wreath, on the door so it swings open with it ---------- */
  {
    let doorMesh = null;
    scene.traverse(o => { if (o.isMesh && o.material === M.door) doorMesh = o; });
    if (doorMesh) {
      const wreath = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.2, .035, 8, 28),
        new THREE.MeshStandardMaterial({ color: 0x5c3f20, roughness: 1 }));
      const n = 54, ringLeaves = new THREE.InstancedMesh(leafGeo, leafMat, n);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28, r = .2 + (rnd() - .5) * .08;
        dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, .03 + rnd() * .03);
        dummy.rotation.set((rnd() - .5) * .5, (rnd() - .5) * .5, a + rnd());
        dummy.scale.setScalar(.12 + rnd() * .06);
        dummy.updateMatrix();
        ringLeaves.setMatrixAt(i, dummy.matrix);
        ringLeaves.setColorAt(i, leafColors[Math.floor(rnd() * leafColors.length)]);
      }
      wreath.add(ring, ringLeaves);
      wreath.position.set(0, .42, .06);
      doorMesh.add(wreath);
    }
  }

  /* ---------- the long table in the yard ---------- */
  const TX = 4.7, TZ = 14.6, TL = 4.2, ground = heightAt(TX, TZ);
  const candles = [];
  {
    const table = new THREE.Group();
    table.position.set(TX, ground, TZ);
    table.rotation.y = 0.1;
    const oak = new THREE.MeshStandardMaterial({ color: 0x7a5533, roughness: .8 });
    const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = !isMobile; table.add(m); return m; };
    box(1.04, .06, TL, 0, .8, 0, oak);
    [[-.42, -1.9], [.42, -1.9], [-.42, 1.9], [.42, 1.9], [-.42, 0], [.42, 0]].forEach(([x, z]) => box(.08, .78, .08, x, .39, z, oak));
    [-.86, .86].forEach(x => {                                                     // benches
      box(.32, .05, TL - .3, x, .46, 0, oak);
      [-1.6, 0, 1.6].forEach(z => box(.06, .44, .24, x, .22, z, oak));
    });
    box(.46, .008, TL + .06, 0, .835, 0, new THREE.MeshStandardMaterial({ color: 0xe9dfc6, roughness: 1 }));   // runner
    const plateGeo = new THREE.CylinderGeometry(.125, .105, .018, 18);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xf1ebdc, roughness: .5 });
    const cupGeo = new THREE.CylinderGeometry(.034, .028, .1, 10);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xa8421e, roughness: .3 });
    for (let i = 0; i < 6; i++) {
      const z = -1.75 + i * .7;
      [-.37, .37].forEach(x => {
        const p = new THREE.Mesh(plateGeo, plateMat); p.position.set(x, .84, z); table.add(p);
        const cup = new THREE.Mesh(cupGeo, cupMat); cup.position.set(x * .78, .88, z + .18); table.add(cup);
      });
    }
    // candles down the middle, with squash and pies between them
    const waxGeo = new THREE.CylinderGeometry(.03, .03, .2, 10);
    const waxMat = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: .6 });
    const flameGeo = new THREE.SphereGeometry(.026, 8, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd488, toneMapped: false });
    [-1.7, -.85, 0, .85, 1.7].forEach(z => {
      const wax = new THREE.Mesh(waxGeo, waxMat); wax.position.set(0, .94, z); table.add(wax);
      const flame = new THREE.Mesh(flameGeo, flameMat); flame.position.set(0, 1.07, z); flame.scale.y = 1.7; table.add(flame);
      const glow = makeGlowSprite(.8, '#ffc27a', 0.75); glow.position.set(0, 1.07, z); table.add(glow);
      candles.push({ glow, ph: z * 3 + 9 });
    });
    const crustMat = new THREE.MeshStandardMaterial({ color: 0xc08a45, roughness: .75 });
    const fillMat = new THREE.MeshStandardMaterial({ color: 0x9c4f1c, roughness: .55 });
    [-.42, 1.27].forEach(z => {
      const crust = new THREE.Mesh(new THREE.CylinderGeometry(.14, .11, .05, 18), crustMat); crust.position.set(.02, .865, z);
      const fill = new THREE.Mesh(new THREE.CylinderGeometry(.118, .118, .012, 18), fillMat); fill.position.set(.02, .888, z);
      table.add(crust, fill);
    });
    scene.add(table);
    const wx = (lx, lz) => TX + lx * Math.cos(.1) + lz * Math.sin(.1);
    const wz = (lx, lz) => TZ - lx * Math.sin(.1) + lz * Math.cos(.1);
    addPumpkin(wx(-.04, .42), ground + .84, wz(-.04, .42), .09, 0);
    addPumpkin(wx(.05, -1.27), ground + .84, wz(.05, -1.27), .08, 2);
  }
  const tableLight = new THREE.PointLight(0xffb868, 11, 9, 2);
  tableLight.position.set(TX, ground + 1.9, TZ);
  scene.add(tableLight);

  /* ---------- string lights: porch front, then out to the table ---------- */
  {
    const poleGeo = new THREE.CylinderGeometry(.045, .055, 3.3, 7);
    const pole1 = new THREE.Vector3(TX + .95, ground + 3.25, TZ - 2.5);
    const pole2 = new THREE.Vector3(TX + .7, ground + 3.25, TZ + 2.7);
    const pole3 = new THREE.Vector3(TX - 1.05, ground + 3.2, TZ + 2.5);
    const pole4 = new THREE.Vector3(TX - .85, ground + 3.2, TZ - 2.7);
    [pole1, pole2, pole3, pole4].forEach(p => {
      const m = new THREE.Mesh(poleGeo, M.wood); m.position.set(p.x, p.y - 1.65, p.z); m.castShadow = !isMobile; scene.add(m);
    });
    const porchL = new THREE.Vector3(-2.85, 2.92, 3.62), porchR = new THREE.Vector3(2.85, 2.92, 3.62);
    const runs = [[porchL, porchR, .34, 15], [porchR, pole4, .9, 13], [pole4, pole2, .55, 11], [pole1, pole3, .55, 11], [pole4, pole1, .3, 4], [pole3, pole2, .3, 4]];
    const bulbs = runs.reduce((a, r) => a + r[3], 0);
    const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.048, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe6b8, fog: false, toneMapped: false }), bulbs);
    const wire = [];
    const v = new THREE.Vector3();
    let n = 0;
    runs.forEach(([a, b, sag, count]) => {
      const at = (u, out) => out.copy(a).lerp(b, u).setY(a.y + (b.y - a.y) * u - sag * 4 * u * (1 - u));
      let px = a.x, py = a.y, pz = a.z;
      for (let i = 1; i <= 24; i++) {
        at(i / 24, v); wire.push(px, py, pz, v.x, v.y, v.z); px = v.x; py = v.y; pz = v.z;
      }
      for (let i = 0; i < count; i++) {
        at((i + .5) / count, v);
        dummy.position.set(v.x, v.y - .07, v.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
        bulbMesh.setMatrixAt(n++, dummy.matrix);
        if (!isMobile || i % 3 === 0) {
          const h = makeGlowSprite(.62, '#ffcf8f', 0.62);
          h.position.set(v.x, v.y - .07, v.z); scene.add(h);
        }
      }
    });
    scene.add(bulbMesh);
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    scene.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x1c140c })));
  }

  /* ---------- somebody's cooking: a chimney with woodsmoke ---------- */
  const smoke = [];
  {
    const brick = new THREE.MeshStandardMaterial({ color: 0x7a3f2c, roughness: 1 });
    const stack = new THREE.Mesh(new THREE.BoxGeometry(.62, 1.9, .62), brick);
    stack.position.set(1.65, 5.15, -1.6);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.76, .1, .76), M.woodDark);
    cap.position.set(1.65, 6.12, -1.6);
    scene.add(stack, cap);
    for (let i = 0; i < 12; i++) {
      const s = makeGlowSprite(2, '#d9c7b4', 0.2);
      s.material.blending = THREE.NormalBlending;
      smoke.push({ s, ph: i / 12 });
      scene.add(s);
    }
  }

  /* ---------- per-frame ---------- */
  const flick = (t, ph) => 0.85 + 0.1 * Math.sin(t * 9.1 + ph) * Math.sin(t * 5.3 + ph * 2) + 0.05 * Math.sin(t * 23 + ph);
  return {
    update(t) {
      // scene.js sets these every frame, so scale them down after it
      stars.material.opacity *= 0.45;
      firefliesA.material.opacity *= 0.7;
      firefliesB.material.opacity *= 0.45;

      fallers.forEach((f, i) => {
        const u = (f.ph + t * f.sp) % 1;
        const top = 10, y = top - u * top;
        dummy.position.set(f.x + Math.sin(t * f.sf + f.ph * 9) * f.sway + u * 2.4,
          y + heightAt(f.x, f.z) + .08, f.z + Math.cos(t * f.sf * .7 + f.ph * 7) * f.sway * .6);
        dummy.rotation.set(t * f.rx + f.ph * 6, t * f.ry, Math.sin(t * f.sf) * .9);
        const near = Math.min(1, Math.max(0, (dummy.position.distanceTo(camera.position) - 3.5) / 3.5));
        dummy.scale.setScalar(u > .985 ? 0 : f.s * near);
        dummy.updateMatrix();
        falling.setMatrixAt(i, dummy.matrix);
      });
      falling.instanceMatrix.needsUpdate = true;

      const lead = -80 + ((t * 2.1) % 170);
      geese.forEach(g => {
        const u = g.userData, f = Math.abs(Math.sin(t * 3.2 + u.ph));
        g.position.set(lead + u.dx, 37 + u.dy + Math.sin(t * .4 + u.ph) * .25, -78);
        g.scale.set(2.6, 1.3 * (.55 + .45 * f), 1);
      });

      smoke.forEach(k => {
        const u = (k.ph + t * .045) % 1;
        k.s.position.set(1.65 + u * u * 3.4 + Math.sin(t * .5 + k.ph * 9) * .22 * u, 6.2 + u * 5.2, -1.6 - u * .8);
        k.s.scale.setScalar(.8 + u * 3.6);
        k.s.material.opacity = .24 * Math.sin(Math.min(1, u * 1.15) * Math.PI);
      });

      candles.forEach(c => { c.glow.material.opacity = .75 * flick(t, c.ph); });
      tableLight.intensity = 11 * flick(t, 2.2);
    },
  };
}
