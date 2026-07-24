import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const BG = 0x071125, INK = 0x9db2cc, RED = 0x6fd2ff, FAINT = 0x122a44;

function boxUnit(w, h, d, line = INK) {
  const g = new THREE.BoxGeometry(w, h, d);
  const grp = new THREE.Group();
  const solid = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: BG, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: line }));
  grp.add(solid, edges);
  return grp;
}

function cylUnit(rt, rb, h, seg = 16, line = INK) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  const grp = new THREE.Group();
  const solid = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: BG, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), new THREE.LineBasicMaterial({ color: line }));
  grp.add(solid, edges);
  return grp;
}

function wheel(x, y, z, r = 0.55, w = 0.42) {
  const grp = new THREE.Group();
  const tire = cylUnit(r, r, w, 18);
  // hub cap + spoke lines so rotation reads
  const hub = cylUnit(r * 0.42, r * 0.42, w + 0.04, 10);
  grp.add(tire, hub);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const spoke = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a) * r * 0.85, (w / 2) + 0.021, Math.sin(a) * r * 0.85),
        new THREE.Vector3(-Math.cos(a) * r * 0.85, (w / 2) + 0.021, -Math.sin(a) * r * 0.85)]),
      new THREE.LineBasicMaterial({ color: INK }));
    const spoke2 = spoke.clone(); spoke2.position.y = -(w) - 0.042;
    grp.add(spoke, spoke2);
  }
  grp.rotation.z = Math.PI / 2;
  grp.position.set(x, y, z);
  grp.userData.isWheel = true;
  return grp;
}

function buildTruck() {
  const t = new THREE.Group();
  // ---- trailer (heading -z: cab at negative z end) ----
  const trailer = boxUnit(2.6, 2.9, 12.5);
  trailer.position.set(0, 2.75, 1.5);
  t.add(trailer);
  // rear doors: vertical split + hinges + door bar
  const doorSplit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.32, 7.76), new THREE.Vector3(0, 4.18, 7.76)]),
    new THREE.LineBasicMaterial({ color: INK }));
  t.add(doorSplit);
  [[-0.65], [0.65]].forEach(([x]) => {
    const bar = boxUnit(0.08, 2.6, 0.08); bar.position.set(x, 2.75, 7.8); t.add(bar);
  });
  // side rub rails on trailer
  [-1.31, 1.31].forEach(x => {
    const rr = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 1.75, -4.7), new THREE.Vector3(x, 1.75, 7.7)]),
      new THREE.LineBasicMaterial({ color: INK }));
    t.add(rr);
  });
  // trailer chassis rail + rear underride guard
  const rail = boxUnit(1.0, 0.28, 12.0);
  rail.position.set(0, 1.18, 1.6);
  t.add(rail);
  const guard = boxUnit(2.3, 0.14, 0.14); guard.position.set(0, 0.62, 7.6); t.add(guard);
  [[-1.0], [1.0]].forEach(([x]) => { const leg = boxUnit(0.12, 0.55, 0.12); leg.position.set(x, 0.9, 7.6); t.add(leg); });
  // landing gear (retracted legs behind kingpin)
  [[-0.85], [0.85]].forEach(([x]) => { const lg = boxUnit(0.16, 0.9, 0.16); lg.position.set(x, 0.85, -3.4); t.add(lg); });
  // trailer bogie (axle box under rear wheels)
  const bogie = boxUnit(2.0, 0.5, 2.6); bogie.position.set(0, 0.85, 5.35); t.add(bogie);
  // mudflaps
  [[-1.05], [1.05]].forEach(([x]) => { const mf = boxUnit(0.5, 0.7, 0.05); mf.position.set(x, 0.45, 7.0); t.add(mf); });

  // ---- tractor ----
  // cab: taller sleeper box + roof fairing sloping up to trailer height
  const cab = boxUnit(2.45, 2.25, 2.4);
  cab.position.set(0, 2.15, -6.55);
  t.add(cab);
  // roof fairing (tapered)
  const fairGeo = new THREE.CylinderGeometry(0.001, 1.1, 1.35, 4, 1);
  const fair = new THREE.Group();
  const fairSolid = new THREE.Mesh(fairGeo, new THREE.MeshBasicMaterial({ color: BG, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const fairEdges = new THREE.LineSegments(new THREE.EdgesGeometry(fairGeo, 5), new THREE.LineBasicMaterial({ color: INK }));
  fair.add(fairSolid, fairEdges);
  fair.scale.set(1.55, 1, 1.05);
  fair.rotation.y = Math.PI / 4;
  fair.rotation.x = -0.42;
  fair.position.set(0, 3.75, -6.05);
  t.add(fair);
  // hood: sloped nose
  const hood = boxUnit(2.15, 1.05, 1.9);
  hood.position.set(0, 1.62, -8.5);
  hood.rotation.x = 0.045;
  t.add(hood);
  // grille + bumper
  const grille = boxUnit(1.7, 0.8, 0.08); grille.position.set(0, 1.45, -9.48); t.add(grille);
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.8, 1.2 + i * 0.25, -9.53), new THREE.Vector3(0.8, 1.2 + i * 0.25, -9.53)]),
      new THREE.LineBasicMaterial({ color: INK }));
    t.add(slat);
  }
  const bumper = boxUnit(2.5, 0.42, 0.22); bumper.position.set(0, 0.72, -9.6); t.add(bumper);
  // windshield + side window frames
  const ws = boxUnit(2.1, 0.75, 0.06); ws.position.set(0, 2.68, -7.72); ws.rotation.x = 0.12; t.add(ws);
  [[-1.26], [1.26]].forEach(([x]) => { const sw = boxUnit(0.05, 0.6, 0.85); sw.position.set(x, 2.6, -7.3); t.add(sw); });
  // mirrors
  [[-1.5], [1.5]].forEach(([x]) => {
    const arm = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x * 0.82, 2.85, -7.7), new THREE.Vector3(x, 2.85, -7.9)]),
      new THREE.LineBasicMaterial({ color: INK }));
    const mir = boxUnit(0.08, 0.55, 0.3); mir.position.set(x, 2.55, -7.9);
    t.add(arm, mir);
  });
  // exhaust stacks
  [[-1.28], [1.28]].forEach(([x]) => {
    const st = cylUnit(0.11, 0.11, 2.6, 10);
    st.position.set(x, 2.7, -5.25);
    t.add(st);
  });
  // fuel tanks
  [[-1.25], [1.25]].forEach(([x]) => {
    const tank = cylUnit(0.42, 0.42, 1.5, 14);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(x, 0.95, -5.0);
    t.add(tank);
  });
  // tractor frame + fifth wheel
  const tframe = boxUnit(0.95, 0.26, 4.2); tframe.position.set(0, 1.05, -5.6); t.add(tframe);
  const fifth = cylUnit(0.55, 0.55, 0.12, 14); fifth.position.set(0, 1.28, -4.15); t.add(fifth);
  // cab side steps
  [[-1.28], [1.28]].forEach(([x]) => { const step = boxUnit(0.35, 0.08, 0.7); step.position.set(x, 0.75, -7.0); t.add(step); });

  // ---- wheels: steer axle + tandem drive + tandem trailer (duals as wider tires) ----
  [[-1.12, -8.35, 0.55, 0.42], [1.12, -8.35, 0.55, 0.42],
   [-1.05, -5.75, 0.55, 0.72], [1.05, -5.75, 0.55, 0.72],
   [-1.05, -4.55, 0.55, 0.72], [1.05, -4.55, 0.55, 0.72],
   [-1.05, 4.75, 0.55, 0.72], [1.05, 4.75, 0.55, 0.72],
   [-1.05, 5.95, 0.55, 0.72], [1.05, 5.95, 0.55, 0.72]]
    .forEach(([x, z, r, w]) => t.add(wheel(x, 0.55, z, r, w)));
  // red detection callouts on trailer
  const callouts = new THREE.Group();
  const pts = [[-1.32, 3.6, -1.2], [1.32, 2.6, 3.4], [0, 4.25, 0.5], [-1.32, 2.0, 5.2], [1.32, 3.9, -3.2], [0, 4.25, 5.8]];
  pts.forEach(([x, y, z]) => {
    const c = new THREE.Group();
    const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide }));
    const stemLen = 1.1;
    const dir = x === 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(Math.sign(x), 0.35, 0).normalize();
    const end = new THREE.Vector3(x, y, z).addScaledVector(dir, stemLen);
    sq.position.copy(end);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), end]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: RED }));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: RED }));
    dot.position.set(x, y, z);
    c.add(sq, line, dot);
    c.userData.sq = sq;
    callouts.add(c);
  });
  callouts.visible = false;
  t.add(callouts);
  t.userData.callouts = callouts;
  return t;
}

function buildGate() {
  const g = new THREE.Group();
  const postL = boxUnit(0.5, 6.2, 0.5, INK); postL.position.set(-3.6, 3.1, 0);
  const postR = boxUnit(0.5, 6.2, 0.5, INK); postR.position.set(3.6, 3.1, 0);
  const beam = boxUnit(7.7, 0.5, 0.5, INK); beam.position.set(0, 6.45, 0);
  g.add(postL, postR, beam);
  // camera units: housing + lens barrel + glowing lens + tilt bracket, aimed at the lane
  [[-3.6, 5.6], [3.6, 5.6], [-3.6, 2.2], [3.6, 2.2], [0, 6.45]].forEach(([x, y]) => {
    const cam = new THREE.Group();
    const body = boxUnit(0.34, 0.3, 0.5, INK);
    cam.add(body);
    const hoodGeo = new THREE.BoxGeometry(0.4, 0.06, 0.56);
    const hood = new THREE.Mesh(hoodGeo, new THREE.MeshBasicMaterial({ color: BG, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const hoodE = new THREE.LineSegments(new THREE.EdgesGeometry(hoodGeo), new THREE.LineBasicMaterial({ color: INK }));
    hood.position.set(0, 0.18, 0.05); hoodE.position.copy(hood.position);
    cam.add(hood, hoodE);
    const barrel = cylUnit(0.1, 0.13, 0.18, 12);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 0.33);
    cam.add(barrel);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 12), new THREE.MeshBasicMaterial({ color: RED }));
    lens.position.set(0, 0, 0.425);
    cam.add(lens);
    const bracket = boxUnit(0.08, 0.22, 0.08, INK);
    bracket.position.set(0, y === 6.45 ? 0.26 : 0, y === 6.45 ? 0 : -0.3);
    cam.add(bracket);
    cam.position.set(x, y, 0.55);
    cam.lookAt(new THREE.Vector3(x * 0.15, 2.6, 3.5));
    g.add(cam);
  });
  // scan curtain
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(6.7, 5.9), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
  curtain.position.set(0, 3.1, 0);
  g.add(curtain);
  g.userData.curtain = curtain;
  return g;
}

const KEYS = [
  { p: [15, 4.0, 30], t: [0, 2.6, 14] },   // hero: three-quarter, truck approaching
  { p: [7.5, 2.4, 12], t: [0, 3.2, 0] },   // evidence: near the gate
  { p: [0.01, 17, 4], t: [0, 1, -1] },     // why: overhead
  { p: [-11, 3.2, -7], t: [0, 2.8, 0.5] }, // how: past the gate looking back
  { p: [-19, 8, -22], t: [0, 2, -5] },     // enterprise: wide
  { p: [-3, 2.2, -30], t: [0, 2.6, -12] }, // cta: truck departing
];

const ease = x => x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;

function start() {
  let canvas = document.getElementById('ml-gl');
  if (!canvas) { requestAnimationFrame(start); return; }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    console.error('[scene] renderer failed on existing canvas, retrying with fresh canvas', e);
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh);
    canvas = fresh;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e2) {
      console.error('[scene] WebGL unavailable', e2);
      window.dispatchEvent(new Event('ml:ready'));
      return;
    }
  }
  console.log('[scene] init ok');
  window.__mlDebug = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 45, 115);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300);

  const grid = new THREE.GridHelper(300, 100, 0x122a44, 0x0b1a33);
  grid.position.y = 0;
  scene.add(grid);
  // red lane line along z
  const lane = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.01, -150), new THREE.Vector3(0, 0.01, 150)]),
    new THREE.LineBasicMaterial({ color: RED })
  );
  scene.add(lane);

  const truck = buildTruck();
  scene.add(truck);
  const gate = buildGate();
  scene.add(gate);

  let target = 0, prog = 0, mx = 0, my = 0;
  const readScroll = () => {
    const d = document.documentElement;
    const max = Math.max(1, d.scrollHeight - window.innerHeight);
    target = Math.min(1, Math.max(0, window.scrollY / max));
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('pointermove', e => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize(); readScroll();

  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  let first = true, tPrev = performance.now();

  function frame(now) {
    // if a live template update replaced the canvas node, swap our rendering canvas back in
    const domC = document.getElementById('ml-gl');
    if (domC && domC !== renderer.domElement) { domC.replaceWith(renderer.domElement); resize(); }
    const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now;
    prog += (target - prog) * Math.min(1, dt * 4.5);

    // truck travel: z 30 -> -40
    const tz = lerp(30, -40, ease(prog));
    truck.position.z = tz;

    // wheels roll
    truck.children.forEach(ch => { if (ch.userData.isWheel) ch.rotation.x = -tz * 1.6; });

    // scan curtain: bright while truck straddles gate
    const front = tz - 9.2, back = tz + 7.8;
    const inGate = front < 0 && back > 0;
    const cur = gate.userData.curtain;
    cur.material.opacity += (((inGate ? 0.32 : 0.07) + Math.sin(now * 0.004) * 0.02) - cur.material.opacity) * 0.1;

    // callouts appear mid-journey
    const co = truck.userData.callouts;
    const show = prog > 0.24 && prog < 0.78;
    co.visible = prog > 0.2 && prog < 0.82;
    co.children.forEach((c, i) => {
      const k = c.userData.k = lerp(c.userData.k ?? 0, show ? 1 : 0, 0.08);
      c.scale.setScalar(Math.max(0.001, k));
      c.userData.sq.lookAt(camera.position);
    });

    // camera through keyframes
    const seg = prog * (KEYS.length - 1);
    const i = Math.min(KEYS.length - 2, Math.floor(seg));
    const k = ease(seg - i);
    A.fromArray(KEYS[i].p); B.fromArray(KEYS[i + 1].p); camPos.lerpVectors(A, B, k);
    A.fromArray(KEYS[i].t); B.fromArray(KEYS[i + 1].t); camTgt.lerpVectors(A, B, k);
    camera.position.set(camPos.x + mx * 1.1, camPos.y - my * 0.7, camPos.z);
    camera.lookAt(camTgt);

    renderer.render(scene, camera);
    if (first) { first = false; window.dispatchEvent(new Event('ml:ready')); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
start();
