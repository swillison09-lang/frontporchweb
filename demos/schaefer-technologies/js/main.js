/* ═══════════════════════════════════════════════════════
   SCHAEFER TECHNOLOGIES — TOOL ROOM ENGINE
   One scroll-aware WebGL scene behind the hero: two die
   rolls forming a stream of softgels, background gears,
   and a machined shaft being measured by an automated
   gage whose reading shows in the page's HUD.
   Precision, not spectacle.

   All page copy is loaded from data/content.json via
   content.js — see that file to change what's on the page.
   ═══════════════════════════════════════════════════════ */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { initContent, setNewsCardHandler } from "./content.js?v=4";

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
const isMobile = window.innerWidth < 760;

gsap.registerPlugin(ScrollTrigger);

// Front Porch Web house rule: the ambient scene (rolls turning, softgels
// falling, the gage scanning) is decorative motion and keeps running under
// prefers-reduced-motion. Scroll-tied reveals and page transitions honour it.
if (prefersReduced) document.documentElement.classList.add("no-anim");

/* ════════════════ SMOOTH SCROLL (Lenis) ════════════════ */
// touch devices already have good native momentum scrolling — layering Lenis'
// own smoothing on top of it is what caused the overshoot / hard-to-control
// feel on phones, so it's desktop (wheel-scroll) only.
let lenis = null;
if (!prefersReduced && !isTouch && typeof Lenis !== "undefined") {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.05 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ════════════════ RENDERER / SCENE ════════════════ */
const BG = 0x0b0f14;
const canvas = document.getElementById("webgl");
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, 0.042);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 11);

// Opaque canvas: the bloom pass composites onto whatever the renderer cleared
// to, and with an alpha canvas that composite goes black. The page background
// is the same graphite as BG, so nothing is lost by clearing to it.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(BG, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// studio environment → realistic metal reflections
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* ── Lighting: white key, warm amber shop light, cool steel rim ──
   The amber point light sits low in front like a bench lamp; it is what
   makes the softgels glow and gives the steel its warm edge. */
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(4, 6, 8);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xcfe0ee, 1.5);
rimLight.position.set(-6, -2, -4);
scene.add(rimLight);

const shopLight = new THREE.PointLight(0xf2a541, 30, 32, 1.6);
shopLight.position.set(0.6, -2.2, 4.2);
scene.add(shopLight);

scene.add(new THREE.AmbientLight(0x2a3440, 1.2));

/* ════════════════ THE MACHINE ════════════════ */
const steel = new THREE.MeshStandardMaterial({
  color: 0x6a7684,
  metalness: 0.96,
  roughness: 0.36,
  envMapIntensity: 0.85,
});
const steelDark = new THREE.MeshStandardMaterial({
  color: 0x4a545f,
  metalness: 0.9,
  roughness: 0.46,
  envMapIntensity: 0.9,
});
const steelBright = new THREE.MeshStandardMaterial({
  color: 0x9fadba,
  metalness: 0.96,
  roughness: 0.22,
  envMapIntensity: 1.0,
});

const rig = new THREE.Group();
scene.add(rig);

/* die roll — cylinder with helix rows of pocket dimples */
function makeRoll(x) {
  const roll = new THREE.Group();
  const R = 3.4;
  const LEN = 9;
  roll.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, LEN, 72, 1), steel));
  roll.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.35, R * 0.35, LEN + 0.8, 32), steelDark));

  const pocketMat = new THREE.MeshStandardMaterial({ color: 0x2b323b, metalness: 0.8, roughness: 0.5 });
  const pocketGeo = new THREE.SphereGeometry(0.22, 10, 8);
  const RINGS = isMobile ? 5 : 8;
  const PER_RING = isMobile ? 14 : 20;
  for (let ri = 0; ri < RINGS; ri++) {
    const y = -LEN / 2 + 1 + (ri * (LEN - 2)) / (RINGS - 1);
    for (let pi = 0; pi < PER_RING; pi++) {
      const a = (pi / PER_RING) * Math.PI * 2 + ri * 0.3;
      const p = new THREE.Mesh(pocketGeo, pocketMat);
      p.scale.set(1, 0.45, 1);
      p.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
      p.lookAt(0, y, 0);
      p.rotateX(Math.PI / 2);
      roll.add(p);
    }
  }
  const holder = new THREE.Group();
  holder.add(roll);
  holder.position.set(x, -1.2, -2.5);
  holder.rotation.z = Math.PI / 2 - 0.12 * Math.sign(x);
  holder.rotation.x = 0.32;
  holder.userData.roll = roll;
  return holder;
}

const rollL = makeRoll(isMobile ? -4.2 : -4.6);
const rollR = makeRoll(isMobile ? 4.2 : 4.6);
rig.add(rollL, rollR);
const rigBaseY = isMobile ? -1.6 : 0;
const rigBaseZ = isMobile ? -3.5 : 0;

/* background gears */
function makeGear(radius, teeth, z) {
  const gear = new THREE.Group();
  gear.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 10, 80), steelDark));
  const toothGeo = new THREE.BoxGeometry(0.55, 0.7, 0.28);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, steelDark);
    t.position.set(Math.cos(a) * (radius + 0.38), Math.sin(a) * (radius + 0.38), 0);
    t.rotation.z = a;
    gear.add(t);
  }
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.9, 0.22, 0.14), steelDark);
    s.rotation.z = (i / 4) * Math.PI;
    gear.add(s);
  }
  gear.position.set(0, 1.5, z);
  return gear;
}
const gear1 = makeGear(6.8, 26, -11);
const gear2 = makeGear(3.6, 16, -9);
gear2.position.set(-7.5, -3.5, -9);
rig.add(gear1, gear2);

/* ── the softgel stream ──
   This is what the die rolls are for. Gelatin capsules come off the nip
   between the rolls and fall, tumbling, into the shop light. Instanced so
   the whole stream is one draw call. */
const GEL_N = isMobile ? 18 : 48;
const gelGeo = new THREE.CapsuleGeometry(0.17, 0.26, 6, 14);
const gelMat = new THREE.MeshPhysicalMaterial({
  color: 0xf2a541,
  emissive: 0x8a4c0e,
  emissiveIntensity: 0.32,
  roughness: 0.2,
  metalness: 0,
  transmission: isMobile ? 0 : 0.5,
  thickness: 0.7,
  ior: 1.42,
  transparent: true,
  opacity: 0.96,
  envMapIntensity: 1.3,
});
const gels = new THREE.InstancedMesh(gelGeo, gelMat, GEL_N);
gels.frustumCulled = false;
const gelSeed = new Float32Array(GEL_N * 4);
for (let i = 0; i < GEL_N; i++) {
  gelSeed[i * 4] = Math.random(); // phase along the fall
  gelSeed[i * 4 + 1] = (Math.random() - 0.5) * 2.6; // spawn x
  gelSeed[i * 4 + 2] = Math.random() * Math.PI * 2; // tumble offset
  gelSeed[i * 4 + 3] = 0.75 + Math.random() * 0.5; // fall speed
}
const gelDummy = new THREE.Object3D();
const GEL_FALL = 7.6; // world units from nip to fade-out
rig.add(gels);

/* ── the measured part: stepped shaft + pinion under a scanning gage ──
   (automated post-process gaging is STI's crown jewel — gages since 1952) */
const partHolder = new THREE.Group();
const part = new THREE.Group();
partHolder.add(part);

// Each feature remembers its diameter so the HUD can read it out as the
// gage passes over. Model units are treated as inches for the readout.
const features = [];
const shaftSeg = (r, len, x) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40), steelBright);
  m.rotation.z = Math.PI / 2;
  m.position.x = x;
  part.add(m);
  features.push({ x, half: len / 2, dia: r * 2 });
};
shaftSeg(0.16, 1.3, -1.85);
shaftSeg(0.34, 1.5, -0.5);
shaftSeg(0.22, 1.0, 1.95);

const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 40), steelBright);
pinion.rotation.z = Math.PI / 2;
pinion.position.x = 0.9;
part.add(pinion);
features.push({ x: 0.9, half: 0.21, dia: 1.36, name: "PINION OD" });
const toothGeo = new THREE.BoxGeometry(0.4, 0.22, 0.17);
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2;
  const tooth = new THREE.Mesh(toothGeo, steelBright);
  tooth.position.set(0.9, Math.cos(a) * 0.68, Math.sin(a) * 0.68);
  tooth.rotation.x = a;
  part.add(tooth);
}

/* gage scanner: emissive ring + beam traveling along the part */
const scanner = new THREE.Group();
const scanMat = new THREE.MeshBasicMaterial({ color: 0x62e0a6, transparent: true, opacity: 0.9 });
const scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.02, 8, 64), scanMat);
scanRing.rotation.y = Math.PI / 2;
scanner.add(scanRing);
scanner.add(new THREE.Mesh(new THREE.BoxGeometry(0.014, 2.6, 0.014), scanMat.clone()));
const tickGeo = new THREE.BoxGeometry(0.05, 0.14, 0.02);
[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((a) => {
  const tk = new THREE.Mesh(tickGeo, scanMat.clone());
  tk.position.set(0, Math.cos(a) * 0.95, Math.sin(a) * 0.95);
  tk.rotation.x = a;
  scanner.add(tk);
});
partHolder.add(scanner);

partHolder.position.set(0, isMobile ? 1.1 : 0.75, 2.2);
partHolder.rotation.z = 0.05;
if (isMobile) partHolder.scale.setScalar(0.72);
rig.add(partHolder);

/* fine metal dust */
const P_COUNT = isMobile ? 160 : 380;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(P_COUNT * 3);
for (let i = 0; i < P_COUNT; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 34;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 24;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 22 - 4;
}
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({ color: 0x8b97a5, size: 0.03, transparent: true, opacity: 0.4 })
);
scene.add(particles);

/* ════════════════ POST: a little bloom on the gage and the gelatin ════════════════ */
// Desktop only — the bloom pass is the one thing in this scene that a
// mid-range phone would feel.
let composer = null;
if (!isMobile) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.65, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

/* ════════════════ DRIVERS ════════════════ */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener("pointermove", (e) => {
  mouse.tx = (e.clientX / innerWidth) * 2 - 1;
  mouse.ty = (e.clientY / innerHeight) * 2 - 1;
});

let scrollProgress = 0;
function updateScrollProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollProgress = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener("scroll", updateScrollProgress, { passive: true });

/* section accent → rim light + CSS accent variable */
const accentColor = new THREE.Color(0xf2a541);
document.querySelectorAll("[data-accent]").forEach((s) => {
  new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const hex = en.target.dataset.accent;
        const c = new THREE.Color(hex);
        gsap.to(accentColor, { r: c.r, g: c.g, b: c.b, duration: 1.2, ease: "power2.out" });
        document.documentElement.style.setProperty("--accent", hex);
        document.documentElement.style.setProperty("--accent-soft", hex + "24");
      });
    },
    // tall sections never reach high intersection ratios — trigger when any part crosses the viewport-center band
    { threshold: 0, rootMargin: "-45% 0% -45% 0%" }
  ).observe(s);
});

/* ════════════════ GAGE READOUT (DOM) ════════════════
   The ring in the scene is a post-process gage. This turns its position
   into a reading so the animation means something: pass over the pinion
   and the HUD reports the pinion's diameter, in tolerance. */
const gageRead = document.getElementById("gageRead");
const gageTol = document.getElementById("gageTol");
const gageEl = document.getElementById("gage");
let gageFrame = 0;
function updateGage() {
  if (!gageRead || !gageTol) return;
  if (++gageFrame % 6) return; // ~10 updates a second reads like an instrument, not a slot machine
  const sx = scanner.position.x;
  let hit = null;
  for (const f of features) {
    if (Math.abs(sx - f.x) <= f.half) { hit = f; break; }
  }
  if (hit) {
    const jitter = (Math.floor(Math.random() * 3) - 1) * 0.0001;
    gageRead.textContent = `Ø ${(hit.dia + jitter).toFixed(4)} in`;
    gageTol.textContent = `±0.0003 · ${hit.name || "SHAFT"} · PASS`;
    gageEl.classList.add("is-pass");
  } else {
    gageRead.textContent = `Ø ${(Math.abs(sx) * 0.37 + 0.3).toFixed(4)} in`;
    gageTol.textContent = "±0.0003 · SCANNING";
    gageEl.classList.remove("is-pass");
  }
}

/* ════════════════ RENDER LOOP ════════════════ */
const clock = new THREE.Clock();
let smoothScroll = 0;

function renderFrame(forcedT, force) {
  const t = forcedT !== undefined ? forcedT : clock.getElapsedTime();
  mouse.x += (mouse.tx - mouse.x) * 0.045;
  mouse.y += (mouse.ty - mouse.y) * 0.045;
  smoothScroll += (scrollProgress - smoothScroll) * 0.06;
  const p = smoothScroll;

  // the scene only shows behind the hero — skip GPU work once it's covered
  if (!force && p > 0.35) return;

  // handheld drift from the pointer, plus a slow rise as the reader scrolls
  // so the floor drops away beneath the rig
  camera.position.x = mouse.x * 0.8;
  camera.position.y = -mouse.y * 0.5 + p * 2.4;
  camera.position.z = 11;
  camera.lookAt(0, -p * 1.6, 0);

  rimLight.color.copy(accentColor);

  rollL.userData.roll.rotation.y = t * 0.35;
  rollR.userData.roll.rotation.y = -t * 0.35;
  gear1.rotation.z = t * 0.05;
  gear2.rotation.z = -t * 0.09;

  // measured part spins; the gage ring scans back and forth along it
  part.rotation.x = t * 0.9;
  scanner.position.x = Math.sin(t * 0.55) * 1.7;
  scanRing.material.opacity = 0.6 + 0.35 * Math.sin(t * 5);
  scanRing.scale.setScalar(1 + Math.sin(t * 5) * 0.02);

  // softgels: each instance runs its own loop from the nip down into the light,
  // popping in small, tumbling, and shrinking away before it would hit anything
  for (let i = 0; i < GEL_N; i++) {
    const phase = gelSeed[i * 4];
    const sx = gelSeed[i * 4 + 1];
    const tumble = gelSeed[i * 4 + 2];
    const speed = gelSeed[i * 4 + 3];
    const life = (t * 0.16 * speed + phase) % 1; // 0 = just formed, 1 = gone
    const y = 1.35 - life * GEL_FALL;
    const x = sx + Math.sin(t * 0.9 + tumble) * 0.18 + life * sx * 0.35;
    const z = 1.05 + Math.cos(t * 0.7 + tumble) * 0.25;
    const grow = Math.min(1, life * 9); // pop in
    const fade = 1 - Math.max(0, (life - 0.78) / 0.22); // shrink out
    const s = grow * fade;
    gelDummy.position.set(x, y, z);
    gelDummy.rotation.set(t * 1.3 + tumble, t * 0.8 + tumble * 0.7, tumble);
    gelDummy.scale.setScalar(s);
    gelDummy.updateMatrix();
    gels.setMatrixAt(i, gelDummy.matrix);
  }
  gels.instanceMatrix.needsUpdate = true;

  // the rig parts and recedes as content arrives
  rollL.position.x = (isMobile ? -4.2 : -4.6) - p * 3.2;
  rollR.position.x = (isMobile ? 4.2 : 4.6) + p * 3.2;
  rig.position.z = rigBaseZ - p * 5;
  rig.position.y = rigBaseY + p * 1.6;
  rig.rotation.y = mouse.x * 0.04;

  particles.rotation.y = t * 0.012;

  updateGage();

  if (composer) composer.render();
  else renderer.render(scene, camera);
}

function tick() {
  renderFrame();
  requestAnimationFrame(tick);
}
tick();

// debug/verification hook — drive frames manually (e.g. hidden-tab testing)
window.__stiRender = (t, scroll) => {
  if (scroll !== undefined) smoothScroll = scrollProgress = scroll;
  renderFrame(t, true);
};

// The fixed nav hangs below the concept ribbon, whose height depends on how
// the ribbon wraps at this width — measure it rather than guess.
const ribbon = document.querySelector(".concept");
function setRibbonHeight() {
  document.documentElement.style.setProperty("--ribbon-h", (ribbon ? ribbon.offsetHeight : 0) + "px");
}
setRibbonHeight();

window.addEventListener("resize", () => {
  setRibbonHeight();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  updateScrollProgress();
});

/* ════════════════ NAV BEHAVIOR (content-independent) ════════════════ */
const nav = document.getElementById("nav");
let lastY = 0;
window.addEventListener(
  "scroll",
  () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 60);
    nav.classList.toggle("is-hidden", y > 500 && y > lastY);
    lastY = y;
  },
  { passive: true }
);

const burger = document.getElementById("burger");
const mobileMenu = document.getElementById("mobileMenu");
burger.addEventListener("click", () => {
  const open = burger.classList.toggle("is-open");
  mobileMenu.classList.toggle("is-open", open);
  burger.setAttribute("aria-expanded", String(open));
});
mobileMenu.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    burger.classList.remove("is-open");
    mobileMenu.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  })
);

/* ════════════════ CONTACT FORM (content-independent) ════════════════ */
// Mirrors the fields of STI's real contact form (Name, Business name, State,
// Email, Phone, Service/Parts/Sales/Other, Message). Wire the submit to the
// company's form endpoint or email on deployment — STI publishes no public
// email address, only phone numbers.
window.__stiSubmit = function (e) {
  e.preventDefault();
  const note = document.getElementById("formNote");
  note.textContent =
    "Demo form — not yet connected. Call toll-free 800-435-7174 for sales, technical assistance and support.";
  return false;
};

/* ════════════════ NEWS DETAIL MODAL ════════════════ */
const newsModal = document.getElementById("newsModal");
const newsModalBackdrop = document.getElementById("newsModalBackdrop");
const newsModalClose = document.getElementById("newsModalClose");
let newsModalReturnFocus = null;

function openNewsModal(item) {
  document.getElementById("newsModalDate").textContent = item.date;
  document.getElementById("newsModalCategory").textContent = item.category;
  document.getElementById("newsModalTitle").textContent = item.title;

  const noteEl = document.getElementById("newsModalNote");
  const bodyEl = document.getElementById("newsModalBody");
  bodyEl.innerHTML = "";

  if (item.fullText && item.fullText.length) {
    noteEl.textContent = "";
    noteEl.hidden = true;
    item.fullText.forEach((para) => {
      const p = document.createElement("p");
      p.textContent = para;
      bodyEl.appendChild(p);
    });
  } else {
    noteEl.textContent = item.sourceNote || "";
    noteEl.hidden = !item.sourceNote;
    const p = document.createElement("p");
    p.textContent = item.synopsis;
    bodyEl.appendChild(p);
  }

  newsModalReturnFocus = document.activeElement;
  newsModal.classList.add("is-open");
  newsModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  newsModalClose.focus();
}
function closeNewsModal() {
  if (!newsModal.classList.contains("is-open")) return;
  newsModal.classList.remove("is-open");
  newsModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (newsModalReturnFocus && newsModalReturnFocus.focus) newsModalReturnFocus.focus();
}
setNewsCardHandler(openNewsModal);
newsModalBackdrop.addEventListener("click", closeNewsModal);
newsModalClose.addEventListener("click", closeNewsModal);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeNewsModal();
});

/* ════════════════ CONTENT-DEPENDENT WIRING ════════════════
   Everything below touches elements that content.js renders,
   so it waits for initContent() to finish populating the DOM. */
async function boot() {
  await initContent();

  /* hero intro */
  if (!prefersReduced) {
    gsap.to(document.querySelectorAll(".hero [data-reveal], .hero .reveal-line"), {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.1,
      ease: "power3.out",
    });

    /* scroll reveals for everything else */
    document.querySelectorAll("[data-reveal]").forEach((node) => {
      if (node.closest(".hero")) return;
      gsap.to(node, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: node, start: "top 88%" },
      });
    });

    /* animated counters */
    document.querySelectorAll("[data-count]").forEach((node) => {
      const target = +node.dataset.count;
      ScrollTrigger.create({
        trigger: node,
        start: "top 88%",
        once: true,
        onEnter: () => {
          gsap.fromTo(
            node,
            { innerText: 0 },
            { innerText: target, duration: 2, ease: "power2.out", snap: { innerText: 1 } }
          );
        },
      });
    });

    /* timeline progress bar */
    const tlProgress = document.getElementById("timelineProgress");
    if (tlProgress) {
      gsap.to(tlProgress, {
        width: "100%",
        ease: "none",
        scrollTrigger: { trigger: ".timeline", start: "top 80%", end: "bottom 55%", scrub: 0.6 },
      });
    }

    /* magnetic buttons */
    if (!isTouch) {
      document.querySelectorAll("[data-magnetic]").forEach((el) => {
        el.addEventListener("pointermove", (e) => {
          const r = el.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          gsap.to(el, { x: dx * 0.2, y: dy * 0.2, duration: 0.4, ease: "power2.out" });
        });
        el.addEventListener("pointerleave", () => {
          gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
        });
      });

      /* tilt cards */
      document.querySelectorAll("[data-tilt]").forEach((el) => {
        el.addEventListener("pointermove", (e) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(el, { rotateY: px * 6, rotateX: -py * 6, transformPerspective: 900, duration: 0.5, ease: "power2.out" });
        });
        el.addEventListener("pointerleave", () => {
          gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.8, ease: "elastic.out(1, 0.5)" });
        });
      });
    }
  } else {
    gsap.set("[data-reveal], .reveal-line", { opacity: 1, y: 0 });
    document.querySelectorAll("[data-count]").forEach((node) => {
      node.textContent = node.dataset.count;
    });
  }

  /* collapsible grids: machines + news share the same expand/collapse pattern */
  function wireCollapsible(gridId, toggleId) {
    const grid = document.getElementById(gridId);
    const toggle = document.getElementById(toggleId);
    if (!grid || !toggle) return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const collapsed = grid.classList.toggle("is-collapsed");
      toggle.textContent = collapsed ? toggle.dataset.labelMore : toggle.dataset.labelLess;
      toggle.setAttribute("aria-expanded", String(!collapsed));
      if (!collapsed) {
        gsap.to(grid.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
      }
      ScrollTrigger.refresh();
      if (collapsed) grid.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  wireCollapsible("machines", "machinesToggle");
  wireCollapsible("news-grid", "newsToggle");

  ScrollTrigger.refresh();
}

boot();
