/* ═══════════════════════════════════════════════════════
   CONTENT LOADER + RENDERERS
   Every section's copy lives in data/content.json (or, when
   previewing an admin draft, in localStorage). This module
   turns that data into DOM — nothing here is hand-authored
   markup, so editing the JSON is enough to change the site.
   ═══════════════════════════════════════════════════════ */

const DRAFT_KEY = "stiDraftContent";

export async function loadContent() {
  const params = new URLSearchParams(location.search);
  if (params.get("draft") === "1") {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        return JSON.parse(draft);
      } catch {
        /* fall through to the real file if the draft is corrupt */
      }
    }
  }
  const res = await fetch("data/content.json", { cache: "no-store" });
  return res.json();
}

function el(id) {
  return document.getElementById(id);
}

function renderHero(h) {
  el("heroOverline").innerHTML = h.overline;
  el("heroTitle").innerHTML = `
    <span class="hero__title-line"><span data-reveal>${h.titleLine1}</span></span>
    <span class="hero__title-line hero__title-accent"><span data-reveal>${h.titleLine2}</span></span>`;
  el("heroSub").innerHTML = h.sub;
  el("heroCta").innerHTML = `
    <a href="${h.ctaPrimaryHref}" class="btn btn--solid" data-hover data-magnetic>${h.ctaPrimaryLabel} <span class="btn__arrow">→</span></a>
    <a href="${h.ctaSecondaryHref}" class="btn btn--ghost" data-hover data-magnetic>${h.ctaSecondaryLabel}</a>`;
}

function renderLegacy(l) {
  el("legacyPhoto").innerHTML = `
    <img src="${l.photo.src}" alt="${l.photo.alt}" loading="lazy" />
    <figcaption>${l.photo.caption}</figcaption>`;
  el("legacyLead").innerHTML = l.lead;
  el("legacyStats").innerHTML = l.stats
    .map(
      (s) => `
    <div class="stat" data-hover>
      <div class="stat__value"><span data-count="${s.value}">0</span><small>${s.suffix}</small></div>
      <div class="stat__label">${s.label}</div>
    </div>`
    )
    .join("");
  el("legacyTimeline").insertAdjacentHTML(
    "beforeend",
    l.timeline
      .map(
        (t) => `
    <div class="timeline__item" data-reveal>
      <span class="timeline__year">${t.year}</span>
      <h3>${t.title}</h3>
      <p>${t.body}</p>
    </div>`
      )
      .join("")
  );
}

function renderBanner(b) {
  el("processBanner").innerHTML = `
    <img src="${b.src}" alt="${b.alt}" loading="lazy" />
    <div class="banner__caption" data-reveal>${b.caption}</div>`;
}

function renderDivisions(divs) {
  el("divisions").innerHTML = divs
    .map(
      (d) => `
    <article class="division" data-hover data-tilt data-reveal>
      <div class="division__glow"></div>
      <div class="division__img"><img src="${d.image}" alt="${d.alt}" loading="lazy" /></div>
      <span class="division__index">${d.index}</span>
      <h3>${d.title}</h3>
      <p>${d.body}</p>
      <ul>${d.items.map((i) => `<li>${i}</li>`).join("")}</ul>
    </article>`
    )
    .join("");
}

function renderMachines(intro, machines) {
  el("machinesHead").innerHTML = `<h3>${intro.title}</h3><p>${intro.body}</p>`;
  el("machines").innerHTML = machines
    .map(
      (m) => `
    <div class="machine" data-hover data-reveal>
      <span class="machine__tag">${m.tag}</span>
      <div class="machine__img"><img src="${m.image}" alt="${m.alt}" loading="lazy" /></div>
      <h4>${m.title}</h4>
      <p>${m.body}</p>
    </div>`
    )
    .join("");
  el("machinesToggle").dataset.labelMore = `Show all ${machines.length} machines ↓`;
  el("machinesToggle").dataset.labelLess = "Show fewer ↑";
  el("machinesToggle").textContent = el("machinesToggle").dataset.labelMore;
}

function renderSpotlight(panels) {
  el("spotlight").innerHTML = panels
    .map(
      (p) => `
    <div class="spotlight__panel" data-hover data-tilt>
      <span class="spotlight__chip">${p.chip}</span>
      <h3>${p.title}<span class="accent">${p.titleAccent}</span></h3>
      <p>${p.body}</p>
      <div class="spotlight__img${p.cutout ? " spotlight__img--cutout" : ""}"><img src="${p.image}" alt="${p.alt}" loading="lazy" /></div>
      <div class="spotlight__rings ${p.ringVariant || ""}"><i></i><i></i><i></i></div>
    </div>`
    )
    .join("");
}

function renderServices(s) {
  el("servicesIntro").innerHTML = s.intro;
  el("servicesGrid").innerHTML = s.items
    .map(
      (it) => `
    <div class="service" data-hover data-reveal>
      <span class="service__num">${it.num}</span>
      <h3>${it.title}</h3>
      <p>${it.body}</p>
    </div>`
    )
    .join("");
  el("financing").innerHTML = `
    <div class="financing__text">
      <span class="spotlight__chip">FINANCING</span>
      <p>"${s.financingQuote}"</p>
    </div>
    <div class="financing__partners">
      ${s.financingPartners
        .map(
          (p) => `
        <div class="financing__partner" data-hover>
          <h4>${p.name}</h4>
          <span>${p.body}</span>
        </div>`
        )
        .join("")}
    </div>`;

  const manuals = el("manuals");
  if (manuals) {
    manuals.innerHTML = `
      <h3>${s.manualsTitle}</h3>
      <p>${s.manualsBody}</p>
      <div class="manuals__grid">
        ${s.manuals
          .map(
            (m) => `
          <a class="manuals__item" href="${m.file}" target="_blank" rel="noopener" data-hover data-reveal>
            <span>${m.title}</span>
            <em>PDF ↓</em>
          </a>`
          )
          .join("")}
      </div>`;
  }
}

function renderTeam(t) {
  el("teamGrid").innerHTML = t.members
    .map(
      (m) => `
    <div class="member" data-hover data-reveal>
      <div class="member__avatar">${m.initials}</div>
      <h3>${m.name}</h3><span>${m.title}</span>
    </div>`
    )
    .join("");
  el("teamNote").innerHTML = `
    <a class="team__partner" href="${t.partnerHref}" target="_blank" rel="noopener" data-hover>
      <span>${t.partnerLabel}</span>
      <img src="${t.partnerImg}" alt="Operio Group logo" loading="lazy" />
    </a>
    <p>${t.note}</p>`;
}

let newsItems = [];
let onNewsCardOpen = () => {};

function renderNews(news) {
  newsItems = news;
  el("news-grid").innerHTML = news
    .map(
      (n, i) => `
    <button class="news-card" type="button" data-reveal data-news-index="${i}">
      <span class="news-card__date">${n.date}</span>
      <h3>${n.title}</h3>
      <p>"${n.synopsis}"</p>
      <span class="news-card__more">${n.fullText ? "Read full article →" : "Read summary →"}</span>
    </button>`
    )
    .join("");
  el("newsToggle").dataset.labelMore = `Show all ${news.length} articles ↓`;
  el("newsToggle").dataset.labelLess = "Show fewer ↑";
  el("newsToggle").textContent = el("newsToggle").dataset.labelMore;

  el("news-grid")
    .querySelectorAll(".news-card")
    .forEach((card) => {
      card.addEventListener("click", () => onNewsCardOpen(newsItems[+card.dataset.newsIndex]));
    });
}

export function setNewsCardHandler(fn) {
  onNewsCardOpen = fn;
}

function renderContact(c) {
  el("contactInfo").innerHTML = `
    <a class="contact__phone" href="${c.phonePrimaryHref}" data-hover>${c.phonePrimary}</a>
    <a class="contact__phone contact__phone--sm" href="${c.phoneSecondaryHref}" data-hover>${c.phoneSecondary}</a>
    <p class="contact__note">${c.note}</p>
    <address>${c.addressLines.join("<br />")}</address>
    <a class="contact__map" data-hover href="${c.mapHref}" target="_blank" rel="noopener">
      <img class="contact__mapimg" src="${c.mapImg}" alt="Map — ${c.addressLines.join(", ")}" loading="lazy" />
      <span>Open in Maps ↗</span>
    </a>`;

  // single source of truth: nav + mobile menu phone number follow contact data
  const navCta = el("navCta");
  if (navCta) navCta.href = c.phonePrimaryHref;
  const navCtaText = el("navCtaText");
  if (navCtaText) navCtaText.textContent = c.phonePrimary;
  const mobilePhone = el("mobileMenuPhone");
  if (mobilePhone) {
    mobilePhone.href = c.phonePrimaryHref;
    mobilePhone.textContent = c.phonePrimary;
  }
}

function renderQuickActions(items) {
  el("quickActions").innerHTML = items
    .map(
      (q) => `
    <a class="quick__item" href="${q.href}" ${q.external ? 'target="_blank" rel="noopener"' : ""} data-hover>
      <span class="quick__label">${q.label}</span>
      <strong>${q.title}</strong>
      <em>${q.sub}</em>
    </a>`
    )
    .join("");
}

function renderFooter(f) {
  el("footer").innerHTML = `
    <div class="footer__big" aria-hidden="true">${f.wordmark}</div>
    <div class="footer__row">
      <span>${f.copyright}</span>
      <span>${f.address}</span>
      <span><a href="${f.partnerHref}" target="_blank" rel="noopener">${f.partnerLabel}</a></span>
    </div>`;
}

export async function initContent() {
  const data = await loadContent();
  renderHero(data.hero);
  renderLegacy(data.legacy);
  renderBanner(data.banner);
  renderDivisions(data.divisions);
  renderMachines(data.machinesIntro, data.machines);
  renderSpotlight(data.spotlight);
  renderServices(data.services);
  renderTeam(data.team);
  renderNews(data.news);
  renderContact(data.contact);
  renderQuickActions(data.quickActions);
  renderFooter(data.footer);
  return data;
}
