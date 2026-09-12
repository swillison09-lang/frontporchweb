
import * as THREE from '../assets/three.module.js';
import { enhanceEnvironment } from './environment.js';
// Reduced motion — Front Porch Web house rule: ambient decorative motion (lamp
// flicker, firefly drift, swing sway, foliage gust, handheld camera drift) is
// deliberately EXEMPT from prefers-reduced-motion and keeps running. Scroll is
// reader-driven so it is unaffected either way. To honour the OS setting again,
// change the line below to:  const reducedMotion = prefersReducedMotion;
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const reducedMotion = false;

/* ════════════════════════════════════════════════════════════
   FRONT PORCH — AN EVENING VISIT
   A scroll-driven walk up the path to the porch. Native page
   scroll is the timeline; the camera and captions follow it.
   Palette is locked to the site: pine night, cream, amber.
   Lighting is golden hour: low warm sun behind the house, amber horizon,
   olive dusk haze, porch lamp and path lanterns doing the rest.
   ════════════════════════════════════════════════════════════ */

// the visit always begins at the start of the path
history.scrollRestoration = 'manual';
scrollTo(0, 0);

const CFG = {
  chapters: [
    { label: 'Arrive',  at: 0.02 },
    { label: 'About',   at: 0.19 },
    { label: 'Trust',   at: 0.34 },
    { label: 'Our Work', at: 0.49 },
    { label: 'Process', at: 0.63 },
    { label: 'Pricing', at: 0.75 },
    { label: 'Hosting', at: 0.875 },
    { label: 'Begin',   at: 0.99 },
  ],
};

const canvas = document.getElementById('scene');
// Lighter render settings on phones/tablets: MSAA off and a lower pixel-ratio
// cap cut the per-frame GPU work that makes the walk feel choppy on mobile.
const isMobile = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: !isMobile, preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
} catch (e) {
  document.getElementById('fallback').classList.add('show');
  document.getElementById('loader').classList.add('done');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2b2f1e, 30, 120);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 300);

// Portrait phones see a narrow horizontal slice at a fixed vertical FOV, which
// crops the scenery. Widen the field of view as the screen gets taller so the
// house and treeline stay in frame. Capped to avoid a fisheye look.
function applyFov() {
  const a = innerWidth / innerHeight;
  const t = Math.min(1, Math.max(0, (1.4 - a) / (1.4 - 0.45)));
  camera.fov = 42 + t * 22;            // 42 on wide desktop → ~64 on tall phones
  camera.aspect = a;
  camera.updateProjectionMatrix();
}
applyFov();

/* ---------- dusk sky dome (green-black up top, amber at the horizon) ---------- */
function makeSky() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  // stop 0.0 is the zenith, 0.5 is the horizon, 1.0 is under the ground
  grad.addColorStop(0.00, '#070f0c');   // night, straight up
  grad.addColorStop(0.22, '#14231a');
  grad.addColorStop(0.34, '#2f4a38');   // pine
  grad.addColorStop(0.42, '#6b6a34');   // olive
  grad.addColorStop(0.47, '#c8862e');
  grad.addColorStop(0.50, '#f6c889');   // amber-soft — brightest right at the horizon
  grad.addColorStop(0.53, '#e9973e');   // amber, fading under the treeline
  grad.addColorStop(0.58, '#7a4e1e');
  grad.addColorStop(0.66, '#2a1c0c');
  grad.addColorStop(1.00, '#120c05');
  g.fillStyle = grad; g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(140, 24, 18),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  scene.add(dome);
}
makeSky();

/* ---------- lights (warm family only, no blues) ---------- */
scene.add(new THREE.HemisphereLight(0x8c7a52, 0x25301f, 1.7));
const moon = new THREE.DirectionalLight(0xffb86a, 2.8);   // low sun, golden hour
moon.position.set(-34, 14, -30);
moon.castShadow = !isMobile;
moon.shadow.mapSize.set(2048,2048);
Object.assign(moon.shadow.camera,{left:-30,right:30,top:40,bottom:-40,near:1,far:110});
moon.shadow.normalBias=.035;
moon.shadow.bias=-.0003;
scene.add(moon);

const lamp = new THREE.PointLight(0xffb15c, 0, 13, 2);
lamp.position.set(1.35, 2.62, 2.55);
scene.add(lamp);

const doorLight = new THREE.PointLight(0xffc46b, 0, 10, 2);
doorLight.position.set(0, 1.7, 1.0);
scene.add(doorLight);

/* ---------- materials ---------- */
const M = {
  ground: new THREE.MeshStandardMaterial({ color: 0x69745d, roughness: 1 }),
  path:   new THREE.MeshStandardMaterial({ color: 0x9a8a6c, roughness: 0.9, emissive: 0x201408, emissiveIntensity: 0.03 }),
  wall:   new THREE.MeshStandardMaterial({ color: 0xb0b5a5, roughness: 0.9 }),
  roof:   new THREE.MeshStandardMaterial({ color: 0x1a2419, roughness: 0.95 }),
  wood:   new THREE.MeshStandardMaterial({ color: 0x84715b, roughness: 0.9 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x2c2013, roughness: 0.95 }),
  door:   new THREE.MeshStandardMaterial({ color: 0x2F4A38, roughness: 0.7 }),
  pine:   new THREE.MeshStandardMaterial({ color: 0x142019, roughness: 1 }),
  trunk:  new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 1 }),
  glow:   new THREE.MeshBasicMaterial({ color: 0xf6c889 }),
  glowWarm: new THREE.MeshBasicMaterial({ color: 0xffd98f }),
};

/* ---------- ground + winding path ---------- */
{
  const ground = new THREE.Mesh(new THREE.CircleGeometry(140, 40), M.ground);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
}

// path made of flat stones marching toward the porch
{
  const stone = new THREE.CylinderGeometry(0.42, 0.42, 0.05, 7);
  const stones = new THREE.InstancedMesh(stone, M.path, 60);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    const z = 4.6 + i * 0.95;
    const x = Math.sin(z * 0.24) * 1.15 + Math.sin(z * 0.07) * 0.7;
    const s = 0.8 + ((i * 7919) % 13) / 13 * 0.5;
    m4.makeRotationY(((i * 2654435) % 628) / 100);
    m4.setPosition(x + (i % 2 ? 0.28 : -0.28), 0.03, z);
    m4.scale(new THREE.Vector3(s, 1, s));
    stones.setMatrixAt(i, m4);
  }
  scene.add(stones);
}

// warm lanterns lining the walk — light the path to the porch and cast soft pools
{
  const pathX = z => Math.sin(z * 0.24) * 1.15 + Math.sin(z * 0.07) * 0.7;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2c2013, roughness: 1 });
  [10, 20, 31, 43].forEach((z, i) => {
    const side = i % 2 ? 1 : -1;                 // alternate sides of the walk
    const x = pathX(z) + side * 1.45;
    // low warm light pooling on the ground beside the path
    const glow = new THREE.PointLight(0xffb76d, 13, 9, 2);
    glow.position.set(x, 0.7, z);
    scene.add(glow);
    // little lantern: post + glowing bulb + soft halo sprite
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), postMat);
    post.position.set(x, 0.45, z);
    scene.add(post);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), M.glowWarm);
    bulb.position.set(x, 0.95, z);
    scene.add(bulb);
    const halo = makeGlowSprite(1.5, '#ffbf6e', 0.6);
    halo.position.set(x, 0.95, z);
    scene.add(halo);
  });
}

/* ---------- the house ---------- */
const house = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.4, 5), M.wall);
  body.position.set(0, 1.7, -1);
  house.add(body);

  // gable roof: extruded triangle
  const tri = new THREE.Shape();
  tri.moveTo(-3.6, 0); tri.lineTo(3.6, 0); tri.lineTo(0, 2.1); tri.closePath();
  const roof = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tri, { depth: 5.8, bevelEnabled: false }), M.roof);
  roof.position.set(0, 3.38, -3.9);
  house.add(roof);

  // porch platform + steps
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.34, 2.3), M.wood);
  deck.position.set(0, 0.34, 2.6);
  house.add(deck);
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.4), M.woodDark);
    st.position.set(0, 0.36 - i * 0.14, 3.75 + i * 0.38);
    house.add(st);
  }

  // porch roof + posts
  const proof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.18, 2.7), M.roof);
  proof.position.set(0, 3.15, 2.6);
  proof.rotation.x = 0.06;
  house.add(proof);
  [[-2.85, 3.6], [2.85, 3.6], [-2.85, 1.7], [2.85, 1.7]].forEach(([x, z]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.7, 0.16), M.wood);
    post.position.set(x, 1.85, z);
    house.add(post);
  });
  // railings
  [-1, 1].forEach(side => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.07), M.wood);
    rail.position.set(side * 2.0, 1.15, 3.6);
    house.add(rail);
  });

  // windows either side of the door, softly lit
  [-1.9, 1.9].forEach(x => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.05), M.woodDark);
    frame.position.set(x, 1.85, 1.5);
    house.add(frame);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.05), M.glow);
    w.position.set(x, 1.85, 1.56);
    house.add(w);
  });
}
scene.add(house);

/* ---------- the door (opens at the end, hinged on the left) ---------- */
const doorPivot = new THREE.Group();
doorPivot.position.set(-0.58, 0, 1.53);
const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.16, 2.3, 0.09), M.door);
doorMesh.position.set(0.58, 1.32, 0);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10),
  new THREE.MeshStandardMaterial({ color: 0xB98C4A, roughness: 0.35, metalness: 0.7 }));
knob.position.set(1.02, 1.28, 0.07);
doorPivot.add(doorMesh, knob);
scene.add(doorPivot);
// warm interior glimpsed through the opening door
const interior = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), M.glowWarm);
interior.position.set(0, 1.35, 1.45);
scene.add(interior);

/* ---------- porch lamp + swing ---------- */
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), M.glowWarm);
bulb.position.copy(lamp.position);
scene.add(bulb);
{
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5), M.woodDark);
  cord.position.set(1.35, 2.9, 2.55);
  scene.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 12, 1, true), M.woodDark);
  shade.position.set(1.35, 2.74, 2.55);
  scene.add(shade);
}
function makeGlowSprite(size, color, opacity) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color + 'ff');
  grad.addColorStop(0.35, color + '55');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(size);
  return s;
}
const halo = makeGlowSprite(2.6, '#ffb15c', 0.55);
halo.position.copy(lamp.position);
scene.add(halo);
const doorHalo = makeGlowSprite(3.4, '#ffc46b', 0.0);
doorHalo.position.set(0, 1.5, 1.8);
scene.add(doorHalo);
// last of the sunset, glowing low behind the house
const dusk = makeGlowSprite(110, '#e9973e', 0.5);
dusk.material.fog = false;
dusk.position.set(-26, 22, -70);   // where the key light comes from, high enough to clear the treeline
scene.add(dusk);

const swing = new THREE.Group();
{
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.5), M.wood);
  seat.position.set(0, -1.75, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.06), M.wood);
  back.position.set(0, -1.5, -0.24);
  const chainL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.75), M.woodDark);
  chainL.position.set(-0.68, -0.87, 0);
  const chainR = chainL.clone(); chainR.position.x = 0.68;
  swing.add(seat, back, chainL, chainR);
}
swing.position.set(-1.75, 3.05, 2.45);
scene.add(swing);

const environment = enhanceEnvironment({ THREE, scene, house, materials: M, renderer, mobile: isMobile });
/* ---------- fireflies + stars ---------- */
function makePoints(n, spread, sizePx, color, opacity) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * spread[0];
    pos[i * 3 + 1] = Math.random() * spread[1] + spread[2];
    pos[i * 3 + 2] = Math.random() * spread[3] + spread[4];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, color); grad.addColorStop(1, 'transparent');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const mat = new THREE.PointsMaterial({
    size: sizePx, map: new THREE.CanvasTexture(c), transparent: true,
    opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    color: new THREE.Color(color), sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}
const firefliesA = makePoints(60, [44, 2.4, 0.3, 52, 0], 0.065, '#ffd98f', 0.9);
const firefliesB = makePoints(50, [30, 2.0, 0.4, 30, 0], 0.05, '#f6c889', 0.7);
scene.add(firefliesA, firefliesB);
const stars = makePoints(260, [220, 60, 34, 220, -110], 0.12, '#fdf3dd', 0.55);
scene.add(stars);
const ffBaseA = firefliesA.geometry.attributes.position.array.slice();
const ffBaseB = firefliesB.geometry.attributes.position.array.slice();

/* ---------- the walk: camera + gaze curves ---------- */
const camPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3( 5.2, 3.1, 38),
  new THREE.Vector3(-3.2, 2.6, 32),
  new THREE.Vector3( 2.6, 2.0, 29),
  new THREE.Vector3(-2.2, 1.9, 19),
  new THREE.Vector3( 0.6, 1.9, 12),
  new THREE.Vector3( 1.3, 1.9, 8.2),
  new THREE.Vector3( 0.0, 1.72, 5.2),
], false, 'centripetal', 0.4);

const gazePath = new THREE.CatmullRomCurve3([
  new THREE.Vector3( 0.0, 2.8, 0),
  new THREE.Vector3( 0.0, 2.5, 0),
  new THREE.Vector3( 0.0, 2.2, 0.6),
  new THREE.Vector3(-1.2, 2.0, 1.6),
  new THREE.Vector3( 1.35, 2.3, 2.4),
  new THREE.Vector3( 0.0, 1.7, 1.5),
  new THREE.Vector3( 0.0, 1.5, 1.55),
], false, 'centripetal', 0.4);

/* ---------- scroll plumbing (native scroll, lerped) ---------- */
let target = 0, progress = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  target = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  // The scroll hint's only job is to prompt the FIRST scroll. Past that it
  // just collides with content (pricing fine print, footer), so hide it as
  // soon as the reader has moved a meaningful amount, and bring it back if
  // they return to the top.
  const hint = document.getElementById('hint');
  if (hint && hint.classList.contains('show') && scrollY > innerHeight * 0.4) {
    hint.classList.remove('show');
    hint.dataset.dismissed = '1';
  } else if (hint && hint.dataset.dismissed && scrollY < 40) {
    hint.classList.add('show');
    delete hint.dataset.dismissed;
  }
}
addEventListener('scroll', readScroll, { passive: true });
readScroll();

// debug/test hook: snap directly to a progress value
window.__snap = p => {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollTo(0, p * max);
  target = progress = p;
};

/* ---------- scroll-snap to sections ----------
   Each scroll advances to the NEXT section in the direction you scrolled, and
   settles there — so you never come to rest in the empty space between
   chapters, and a scroll never yanks you backward. Because the runway is long,
   snapping by direction (not nearest) is what makes it feel responsive. */
const SNAPS = CFG.chapters.map(c => c.at);
let snapping = false, snapIdle = 0, snapDone = 0, interacted = false, curIdx = 0;
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev =>
  addEventListener(ev, () => { interacted = true; }, { passive: true }));

// Jump the scroll instantly to the section; the camera + captions are already
// eased by the progress lerp in the render loop, so the visual transition stays
// smooth. (A custom or native *animated* scroll gets fought by the render loop
// here; an instant set is reliable.)
function animateScrollTo(y) {
  snapping = true;
  clearTimeout(snapDone);
  scrollTo(0, y);
  snapDone = setTimeout(() => { snapping = false; }, 200);
}

// Ease to a specific section index and remember it as the current one.
function goToIndex(i) {
  curIdx = Math.max(0, Math.min(SNAPS.length - 1, i));
  const max = document.documentElement.scrollHeight - innerHeight;
  if (max > 0) animateScrollTo(SNAPS[curIdx] * max);
}

// Let long chapters scroll fully before the next gesture advances the camera.
// This also handles fixed text overlays, where native scroll chaining varies.
let wheelUntil = 0;
function panelCanScroll(panel, delta) {
  return panel && panel.scrollHeight > panel.clientHeight + 2 &&
    (delta > 0 ? panel.scrollTop + panel.clientHeight < panel.scrollHeight - 3 : panel.scrollTop > 3);
}
addEventListener('wheel', e => {
  if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
  const panel = e.target instanceof Element ? e.target.closest('.chapter .inner') : null;
  if (panelCanScroll(panel, e.deltaY)) return;
  e.preventDefault();
  if (performance.now() < wheelUntil || Math.abs(e.deltaY) < 3) return;
  interacted = true;
  clearTimeout(snapIdle);
  goToIndex(curIdx + (e.deltaY > 0 ? 1 : -1));
  wheelUntil = performance.now() + 750;
}, {passive:false});
let touchGesture = null;
addEventListener('touchstart', e => {
  if(e.touches.length!==1)return;
  const panel=e.target instanceof Element?e.target.closest('.chapter .inner'):null;
  touchGesture={y:e.touches[0].clientY,index:curIdx,panel,top:panel?.scrollTop||0};
}, {passive:true});
addEventListener('touchend', e => {
  if(!touchGesture||!e.changedTouches.length)return;
  const delta=touchGesture.y-e.changedTouches[0].clientY;
  const panel=touchGesture.panel;
  const scrolledPanel=panel&&Math.abs(panel.scrollTop-touchGesture.top)>3;
  if(Math.abs(delta)>55&&curIdx===touchGesture.index&&!scrolledPanel&&!panelCanScroll(panel,delta)) {
    interacted=true;clearTimeout(snapIdle);goToIndex(curIdx+(delta>0?1:-1));
  }
  touchGesture=null;
}, {passive:true});

addEventListener('scroll', () => {
  if (snapping || !interacted) return;
  clearTimeout(snapIdle);
  snapIdle = setTimeout(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max <= 0) return;
    const p = scrollY / max;
    const cur = SNAPS[curIdx];
    const TH = 34 / max;                         // ~34px: a gentle swipe advances
    let target = curIdx;
    if (p > cur + TH) {                          // scrolled down → go forward
      target = curIdx + 1;
      // if they scrolled far, keep going to the section they actually reached
      while (target < SNAPS.length - 1 && p >= (SNAPS[target] + SNAPS[target + 1]) / 2) target++;
    } else if (p < cur - TH) {                   // scrolled up → go back
      target = curIdx - 1;
      while (target > 0 && p <= (SNAPS[target] + SNAPS[target - 1]) / 2) target--;
    }
    target = Math.max(0, Math.min(SNAPS.length - 1, target));
    // Didn't cross into a new section (a small scroll, or at an edge): leave it
    // where it is rather than yanking it back — that back-snap is the "hesitation".
    if (target === curIdx) return;
    goToIndex(target);
  }, 110);
}, { passive: true });

/* ---------- captions ---------- */
const chapters = [...document.querySelectorAll('.chapter')].map(el => ({
  el,
  start: parseFloat(el.dataset.start),
  end: parseFloat(el.dataset.end),
  subs: [...el.querySelectorAll('[data-sub]')],
}));
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function updateCaptions(p) {
  for (const ch of chapters) {
    const f = Math.min(0.05, (ch.end - ch.start) * 0.3);
    const fadeIn = ch.start <= 0 ? 1 : smooth(ch.start, ch.start + f, p);
    const a = fadeIn * (1 - smooth(ch.end - f, ch.end, p));
    ch.el.style.opacity = a.toFixed(3);
    ch.el.style.transform = `translateY(${(1 - a) * 26}px)`;
    ch.el.style.pointerEvents = a > 0.6 ? 'auto' : 'none';
    ch.el.inert = a < 0.6;
    ch.el.setAttribute('aria-hidden', a < 0.6 ? 'true' : 'false');
    ch.subs.forEach((s, i) => {
      const span = ch.end - ch.start;
      // reveal all staggered items early, so every one is solidly full well
      // before the section's snap point (last finishes at ~26% of the section,
      // leaving margin for the eased camera to still be settling on landing)
      const s0 = ch.start + span * (0.06 + i * 0.07);
      const sa = smooth(s0, s0 + span * 0.06, p);
      s.style.opacity = sa.toFixed(3);
      s.style.transform = `translateX(${(1 - sa) * 26}px)`;
    });
  }
  railBtns.forEach((b, i) => {
    const next = CFG.chapters[i + 1] ? CFG.chapters[i + 1].at : 2;
    const active = p >= CFG.chapters[i].at - 0.06 && p < next - 0.06;
    b.classList.toggle('on', active);
    if(active){b.setAttribute('aria-current','step');document.getElementById('chapter-number').textContent=String(i+1).padStart(2,'0')+' / 08';document.getElementById('chapter-name').textContent=CFG.chapters[i].label.toUpperCase();}else b.removeAttribute('aria-current');
  });
}

/* ---------- rail ---------- */
const rail = document.getElementById('rail');
const railBtns = CFG.chapters.map((c, i) => {
  const b = document.createElement('button');
  b.title = c.label; b.innerHTML='<span>'+c.label+'</span>';
  b.setAttribute('aria-label', c.label);
  b.addEventListener('click', () => { interacted = true; goToIndex(i); });
  rail.appendChild(b);
  return b;
});

/* ---------- nav + hero jump links ---------- */
const nearestSnapIndex = at => {
  let best = 0;
  for (let i = 0; i < SNAPS.length; i++)
    if (Math.abs(SNAPS[i] - at) < Math.abs(SNAPS[best] - at)) best = i;
  return best;
};
document.querySelectorAll('.nav-scroll').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    interacted = true;
    goToIndex(nearestSnapIndex(parseFloat(a.dataset.at)));
  });
});
document.querySelector('.brand').addEventListener('click', e => {
  e.preventDefault();
  interacted = true;
  goToIndex(0);
});

/* ---------- gentle mouse drift (desktop) ---------- */
const mouse = { x: 0, y: 0 };
addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') {
    mouse.x = (e.clientX / innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / innerHeight - 0.5) * 2;
  }
});

/* ---------- flicker table for the porch lamp (two stutters per cycle) ---------- */
function lampLevel(t) {
  const cyc = (t % 9) / 9;
  let v = 0.88 + 0.09 * Math.sin(t * 0.7);
  const dip = (c, w, d) => { if (Math.abs(cyc - c) < w) v *= d; };
  dip(0.41, 0.006, 0.45); dip(0.425, 0.005, 0.55); dip(0.74, 0.006, 0.55);
  return v;
}

/* ---------- main loop ---------- */
const V = new THREE.Vector3(), G = new THREE.Vector3();
const clock = new THREE.Clock();
let firstFrame = false;
let prevT = 0, lastCaptionP = -1, frameCount = 0;

function frame() {
  const t = clock.getElapsedTime();
  const dt = Math.min(0.05, t - prevT); prevT = t;
  frameCount++;
  // Frame-rate-independent easing: quicker catch-up so the scroll feels
  // responsive rather than heavy, and consistent when a phone dips below 60fps.
  progress += (target - progress) * (1 - Math.pow(0.90, dt * 60));
  const p = Math.min(1, Math.max(0, progress));

  // camera along the walk, with a whisper of handheld drift
  camPath.getPointAt(p, V);
  gazePath.getPointAt(p, G);
  if (!isMobile) G.x -= 3.2 * (1 - smooth(0.55, 0.9, p));
  V.x += reducedMotion ? 0 : mouse.x * 0.15 + Math.sin(t * 0.5) * 0.025;
  V.y += reducedMotion ? 0 : -mouse.y * 0.08 + Math.sin(t * 0.83) * 0.018;
  camera.position.copy(V);
  camera.lookAt(G.x + mouse.x * 0.3, G.y - mouse.y * 0.2, G.z);

  // lamp warms up as you approach, lit well before the porch chapters
  const approach = smooth(0.18, 0.42, p);
  const lv = reducedMotion ? 1 : lampLevel(t);
  lamp.intensity = (8 + 16 * approach) * lv;
  halo.material.opacity = 0.62 * approach * lv;
  bulb.material.color.setHex(lv > 0.7 ? 0xffd98f : 0x8a6a3a);

  // door opens at the very end and warm light floods out
  const open = smooth(0.905, 1.0, p);
  doorPivot.rotation.y = -open * 1.85;
  doorLight.intensity = open * 28;
  doorHalo.material.opacity = open * 0.85;

  // swing sway + fireflies + star twinkle
  swing.rotation.x = reducedMotion ? 0 : Math.sin(t * 0.8) * 0.025;
  // Firefly buffers re-upload to the GPU each time; on mobile update every other
  // frame (they drift slowly enough that ~30fps is imperceptible) to halve the cost.
  if (!isMobile || (frameCount & 1)) {
    const posA = firefliesA.geometry.attributes.position;
    for (let i = 0; i < posA.count; i++) {
      posA.array[i * 3]     = ffBaseA[i * 3]     + Math.sin(t * 0.5 + i * 1.7) * 0.7;
      posA.array[i * 3 + 1] = ffBaseA[i * 3 + 1] + Math.sin(t * 0.8 + i * 2.3) * 0.35;
      posA.array[i * 3 + 2] = ffBaseA[i * 3 + 2] + Math.cos(t * 0.4 + i * 1.1) * 0.7;
    }
    posA.needsUpdate = true;
    const posB = firefliesB.geometry.attributes.position;
    for (let i = 0; i < posB.count; i++) {
      posB.array[i * 3]     = ffBaseB[i * 3]     + Math.cos(t * 0.6 + i * 2.1) * 0.55;
      posB.array[i * 3 + 1] = ffBaseB[i * 3 + 1] + Math.sin(t * 0.7 + i * 1.3) * 0.3;
    }
    posB.needsUpdate = true;
  }
  firefliesA.material.opacity = 0.55 + 0.4 * Math.sin(t * 1.9);
  firefliesB.material.opacity = 0.5 + 0.4 * Math.sin(t * 2.3 + 2);
  stars.material.opacity = 0.42 + 0.14 * Math.sin(t * 0.9);

  // Skip the per-frame caption style writes once the scroll has settled: when p
  // is essentially unchanged there's nothing to repaint, which frees the main
  // thread (a big cause of scroll jank alongside the inline-style thrash).
  if (Math.abs(p - lastCaptionP) > 0.0004) { updateCaptions(p); lastCaptionP = p; }
  environment.update(reducedMotion ? 0 : t);
  renderer.render(scene, camera);
  if (!firstFrame) { firstFrame = true; beginReveal(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- loader reveal ---------- */
function beginReveal() {
  const count = document.getElementById('loadCount');
  const bar = document.getElementById('loadBar');
  const t0 = performance.now(), dur = reducedMotion ? 0 : 650;
  (function tick(now) {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1;
    const eased = 1 - Math.pow(1 - k, 3);
    count.textContent = Math.round(eased * 100);
    bar.style.width = (eased * 100) + '%';
    if (k < 1) requestAnimationFrame(tick);
    else {
      document.getElementById('loader').classList.add('done');
      document.getElementById('hint').classList.add('show');
    }
  })(t0);
}

/* ---------- resize ---------- */
addEventListener('resize', () => {
  applyFov();
  renderer.setSize(innerWidth, innerHeight);
  readScroll();
});
