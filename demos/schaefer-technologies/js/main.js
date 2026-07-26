/* ═══════════════════════════════════════════════════════
   SCHAEFER TECHNOLOGIES — TOOL ROOM ENGINE
   One scroll-aware WebGL scene behind the hero:
   giant die rolls, gears, and a machined shaft being
   measured by an automated gage. Precision, not spectacle.

   All page copy is loaded from data/content.json via
   content.js — see that file to change what's on the page.
   ═══════════════════════════════════════════════════════ */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { initContent, setNewsCardHandler } from "./content.js?v=3";

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
const isMobile = window.innerWidth < 760;

gsap.registerPlugin(ScrollTrigger);

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
const canvas = document.getElementById("webgl");
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050b16, 0.045);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 11);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// studio environment → realistic metal reflections
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* ── Lighting: white key, warm amber shop light, cool steel rim ── */
const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(4, 6, 8);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x4da3ff, 1.6);
rimLight.position.set(-6, -2, -4);
scene.add(rimLight);

const shopLight = new THREE.PointLight(0xffb454, 26, 30);
shopLight.position.set(0, -2, 4);
scene.add(shopLight);

scene.add(new THREE.AmbientLight(0x223a5e, 1.1));

/* ════════════════ THE MACHINE ════════════════ */
const steel = new THREE.MeshStandardMaterial({
  color: 0x66778c,
  metalness: 0.95,
  roughness: 0.38,
  envMapIntensity: 0.75,
});
const steelDark = new THREE.MeshStandardMaterial({
  color: 0x4c5866,
  metalness: 0.9,
  roughness: 0.45,
  envMapIntensity: 0.9,
});
const steelBright = new THREE.MeshStandardMaterial({
  color: 0x93a4b9,
  metalness: 0.95,
  roughness: 0.24,
  envMapIntensity: 0.9,
});

const rig = new THREE.Group();
scene.add(rig);

/* die roll — cylinder with helix rows of pocket dimples */
function makeRoll(x) {
  const roll = new THREE.Group();
  const R = 3.4;
  const LEN = 9;
  roll.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, LEN, 64, 1), steel));
  roll.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.35, R * 0.35, LEN + 0.8, 32), steelDark));

  const pocketMat = new THREE.MeshStandardMaterial({ color: 0x2c3542, metalness: 0.8, roughness: 0.5 });
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

/* ── the measured part: stepped shaft + pinion under a scanning gage ──
   (automated post-process gaging is STI's crown jewel — gages since 1952) */
const partHolder = new THREE.Group();
const part = new THREE.Group();
partHolder.add(part);

const shaftSeg = (r, len, x) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40), steelBright);
  m.rotation.z = Math.PI / 2;
  m.position.x = x;
  part.add(m);
};
shaftSeg(0.16, 1.3, -1.85);
shaftSeg(0.34, 1.5, -0.5);
shaftSeg(0.22, 1.0, 1.95);

const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 40), steelBright);
pinion.rotation.z = Math.PI / 2;
pinion.position.x = 0.9;
part.add(pinion);
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
const scanMat = new THREE.MeshBasicMaterial({ color: 0x55e59a, transparent: true, opacity: 0.85 });
const scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.018, 8, 64), scanMat);
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
const accentColor = new THREE.Color(0x4da3ff);
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

  camera.position.x = mouse.x * 0.8;
  camera.position.y = -mouse.y * 0.5;
  camera.position.z = 11;
  camera.lookAt(0, 0, 0);

  rimLight.color.copy(accentColor);

  rollL.userData.roll.rotation.y = t * 0.35;
  rollR.userData.roll.rotation.y = -t * 0.35;
  gear1.rotation.z = t * 0.05;
  gear2.rotation.z = -t * 0.09;

  // measured part spins; the gage ring scans back and forth along it
  part.rotation.x = t * 0.9;
  scanner.position.x = Math.sin(t * 0.55) * 1.7;
  scanRing.material.opacity = 0.55 + 0.35 * Math.sin(t * 5);
  scanRing.scale.setScalar(1 + Math.sin(t * 5) * 0.02);

  // the rig parts and recedes as content arrives
  rollL.position.x = (isMobile ? -4.2 : -4.6) - p * 3.2;
  rollR.position.x = (isMobile ? 4.2 : 4.6) + p * 3.2;
  rig.position.z = rigBaseZ - p * 5;
  rig.position.y = rigBaseY + p * 1.6;
  rig.rotation.y = mouse.x * 0.04;

  particles.rotation.y = t * 0.012;

  renderer.render(scene, camera);
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

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
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
  burger.classList.toggle("is-open");
  mobileMenu.classList.toggle("is-open");
});
mobileMenu.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    burger.classList.remove("is-open");
    mobileMenu.classList.remove("is-open");
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

  newsModal.classList.add("is-open");
  newsModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeNewsModal() {
  newsModal.classList.remove("is-open");
  newsModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
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
          gsap.to(el, { x: dx * 0.25, y: dy * 0.25, duration: 0.4, ease: "power2.out" });
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
          gsap.to(el, { rotateY: px * 9, rotateX: -py * 9, transformPerspective: 900, duration: 0.5, ease: "power2.out" });
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
    toggle.addEventListener("click", () => {
      const collapsed = grid.classList.toggle("is-collapsed");
      toggle.textContent = collapsed ? toggle.dataset.labelMore : toggle.dataset.labelLess;
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
