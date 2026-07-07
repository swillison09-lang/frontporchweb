/* Front Porch Web — renderer + animations.
   All copy lives in content.json; edit it via admin.html. */
(async function () {
  const DRAFT_KEY = "fpw-content-draft";

  async function loadContent() {
    // admin.html live-preview: ?preview=1 reads the localStorage draft
    if (new URLSearchParams(location.search).has("preview")) {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) { try { return JSON.parse(draft); } catch (e) { /* fall through */ } }
    }
    const res = await fetch("content.json");
    return res.json();
  }

  const c = await loadContent();

  /* ---------- simple slot filling ---------- */
  const get = (obj, path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
  document.querySelectorAll("[data-slot]").forEach(el => {
    const val = get(c, el.dataset.slot);
    if (val !== undefined) el.textContent = val;
  });
  document.title = c.meta.title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", c.meta.description);

  const setBtn = (id, btn) => {
    const el = document.getElementById(id);
    if (el && btn) { el.textContent = btn.label; el.href = btn.href; }
  };
  setBtn("nav-cta", c.nav.cta);
  setBtn("hero-cta-primary", c.hero.primaryCta);
  setBtn("hero-cta-secondary", c.hero.secondaryCta);
  setBtn("cta-primary", c.cta.primaryCta);
  const emailBtn = document.getElementById("cta-email");
  if (emailBtn && c.cta.email) {
    emailBtn.textContent = c.cta.email;
    emailBtn.href = "mailto:" + c.cta.email;
  }

  /* ---------- nav links ---------- */
  const navLinks = document.getElementById("nav-links");
  navLinks.innerHTML = c.nav.links.map(l => `<a href="${l.href}">${l.label}</a>`).join("");
  document.getElementById("footer-links").innerHTML =
    c.footer.links.map(l => `<a href="${l.href}">${l.label}</a>`).join("");

  /* ---------- values ---------- */
  const VALUE_ICONS = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 12 22l-8-8 8.6-8.6a2 2 0 0 1 1.4-.6H20a1 1 0 0 1 1 1v6.2a2 2 0 0 1-.4 1.4Z"/><circle cx="16.5" cy="7.5" r="1.5"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v9h14v-9"/><path d="M9 19v-5h6v5"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  ];
  document.getElementById("values-grid").innerHTML = c.values.map((v, i) => `
    <div class="value-card reveal" style="--d:${i * 0.12}s">
      <div class="value-icon">${VALUE_ICONS[i % VALUE_ICONS.length]}</div>
      <h3>${v.title}</h3>
      <p>${v.body}</p>
    </div>`).join("");

  /* ---------- work cards ---------- */
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  // real screenshot when the card has one; stylized placeholder blocks otherwise
  const mockupInner = w => w.image
    ? `<img class="mockup-shot" src="${w.image}" alt="${w.imageAlt || w.title}" loading="lazy">`
    : `<div class="mockup-hero"></div>
       <div class="mockup-body"><i></i><i></i><i></i></div>
       <div class="mockup-lines"><i></i><i></i></div>`;
  document.getElementById("work-grid").innerHTML = c.work.cards.map((w, i) => `
    <a class="work-card reveal ${w.theme}" style="--d:${(i % 2) * 0.12}s" href="${w.href}">
      <div class="mockup ${w.theme}">
        <div class="mockup-window">
          <div class="mockup-bar"><i></i><i></i><i></i></div>
          ${mockupInner(w)}
        </div>
      </div>
      <div class="work-card-body">
        <span class="work-tag">${w.tag}</span>
        <h3>${w.title}</h3>
        <p>${w.description}</p>
        <span class="work-link">View demo ${arrow}</span>
      </div>
    </a>`).join("");

  /* ---------- about photo ---------- */
  const aboutPhoto = document.getElementById("about-photo");
  if (c.about.photo) {
    aboutPhoto.src = c.about.photo;
    aboutPhoto.alt = c.about.photoAlt || "";
  } else {
    aboutPhoto.closest(".about-layout").classList.add("no-photo");
  }

  /* ---------- process steps ---------- */
  const steps = document.getElementById("steps");
  steps.insertAdjacentHTML("beforeend", c.process.steps.map((s, i) => `
    <div class="step reveal" style="--d:${i * 0.16}s">
      <div class="step-num">${i + 1}</div>
      <h3>${s.title}</h3>
      <p>${s.body}</p>
    </div>`).join(""));

  /* ---------- pricing ---------- */
  const check = '<svg class="price-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  document.getElementById("pricing-grid").innerHTML = c.pricing.tiers.map((t, i) => `
    <div class="price-card reveal ${t.featured ? "featured" : ""}" style="--d:${i * 0.12}s">
      <div class="price-name">${t.name}</div>
      <div class="price-amount">${t.price}</div>
      <div class="price-term">${t.term}</div>
      <ul class="price-features">
        ${t.features.map(f => `<li>${check}<span>${f}</span></li>`).join("")}
      </ul>
      <a class="btn ${t.featured ? "btn-primary" : "btn-ghost"} btn-lg" href="${t.cta.href}">${t.cta.label}</a>
    </div>`).join("");

  /* ==========================================================
     Ambience: stars + fireflies
     ========================================================== */
  const stars = document.getElementById("stars");
  const starCount = 70;
  let starHtml = "";
  for (let i = 0; i < starCount; i++) {
    const size = 1 + Math.random() * 1.8;
    starHtml += `<span class="star" style="
      left:${(Math.random() * 100).toFixed(2)}%;
      top:${(Math.random() * 52).toFixed(2)}%;
      width:${size.toFixed(1)}px; height:${size.toFixed(1)}px;
      --base:${(0.25 + Math.random() * 0.55).toFixed(2)};
      --dur:${(3 + Math.random() * 5).toFixed(1)}s;
      --delay:${(Math.random() * 6).toFixed(1)}s;"></span>`;
  }
  stars.innerHTML = starHtml;

  function spawnFireflies(container, count, topMin, topSpan) {
    if (!container) return;
    let html = "";
    for (let i = 0; i < count; i++) {
      html += `<span class="firefly" style="
        left:${(8 + Math.random() * 84).toFixed(1)}%;
        top:${(topMin + Math.random() * topSpan).toFixed(1)}%;
        --dx:${(Math.random() * 160 - 80).toFixed(0)}px;
        --dy:${(Math.random() * -90 - 20).toFixed(0)}px;
        --dur:${(11 + Math.random() * 12).toFixed(1)}s;
        --delay:${(-Math.random() * 12).toFixed(1)}s;"></span>`;
    }
    container.innerHTML = html;
  }
  spawnFireflies(document.getElementById("fireflies"), 9, 52, 30);
  spawnFireflies(document.getElementById("cta-fireflies"), 6, 15, 70);

  /* ==========================================================
     Scroll behavior: nav, parallax, reveals
     ========================================================== */
  const nav = document.getElementById("nav");
  const hero = document.querySelector(".hero");
  const layers = document.querySelectorAll("[data-parallax]");

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      nav.classList.toggle("scrolled", y > hero.offsetHeight - 90);
      if (y < hero.offsetHeight) {
        layers.forEach(l => {
          l.style.transform = `translateY(${(y * parseFloat(l.dataset.parallax)).toFixed(1)}px)`;
        });
      }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // reveal on scroll
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
  io.observe(steps); // triggers the connecting-line draw via .in

  /* iOS Safari can restore a page from the back-forward cache with CSS
     animations frozen — restart them all when that happens */
  window.addEventListener("pageshow", e => {
    if (e.persisted && document.getAnimations) {
      document.getAnimations().forEach(a => { try { a.cancel(); a.play(); } catch (err) {} });
    }
  });

  /* ---------- mobile menu ---------- */
  const burger = document.getElementById("nav-burger");
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("menu-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  navLinks.addEventListener("click", e => {
    if (e.target.tagName === "A") { nav.classList.remove("menu-open"); burger.setAttribute("aria-expanded", "false"); }
  });
})();
