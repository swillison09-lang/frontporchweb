/* ═══════════════════════════════════════════════════════
   SITE EDITOR
   Loads data/content.json (or a resumed draft), renders an
   editable form for every field, autosaves to localStorage
   as you type, and lets you preview or export the result.
   No server, no account, no build step.
   ═══════════════════════════════════════════════════════ */

const DRAFT_KEY = "stiDraftContent";

const sectionsEl = document.getElementById("sections");
const statusEl = document.getElementById("status");
const btnReset = document.getElementById("btnReset");
const btnPreview = document.getElementById("btnPreview");
const btnDownload = document.getElementById("btnDownload");
const fileLoad = document.getElementById("fileLoad");

let state = null;

async function fetchContent() {
  const res = await fetch("data/content.json", { cache: "no-store" });
  return res.json();
}

function persistDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  statusEl.textContent = "Draft saved to this browser — not yet downloaded";
}

/* ════════════════ FIELD + LIST BUILDING BLOCKS ════════════════ */
function field(def, obj, key, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "a-field" + (def.type === "checkbox" ? " a-field--checkbox" : "");

  const label = document.createElement("label");
  label.textContent = def.label;

  let input;
  if (def.type === "textarea" || def.type === "lines") {
    input = document.createElement("textarea");
    input.rows = def.rows || 3;
    input.value = def.type === "lines" ? (obj[key] || []).join("\n") : obj[key] ?? "";
  } else if (def.type === "checkbox") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!obj[key];
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = obj[key] ?? "";
  }

  input.addEventListener("input", () => {
    if (def.type === "checkbox") obj[key] = input.checked;
    else if (def.type === "lines")
      obj[key] = input.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (def.type === "number") obj[key] = Number(input.value) || 0;
    else obj[key] = input.value;
    onChange();
  });

  if (def.type === "checkbox") {
    input.addEventListener("change", () => {
      obj[key] = input.checked;
      onChange();
    });
    wrap.append(input, label);
  } else {
    wrap.append(label, input);
  }
  return wrap;
}

function buildRepeatableSection(body, arr, fields, blankFactory, itemNoun, onChange) {
  const container = document.createElement("div");
  body.appendChild(container);

  function draw() {
    container.innerHTML = "";
    const list = document.createElement("div");
    list.className = "a-list";
    arr.forEach((item, i) => {
      const card = document.createElement("div");
      card.className = "a-item";
      const top = document.createElement("div");
      top.className = "a-item__top";
      const tag = document.createElement("span");
      tag.className = "a-item__tag";
      tag.textContent = `${itemNoun} ${i + 1}`;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "a-item__remove";
      rm.textContent = "Remove ✕";
      rm.addEventListener("click", () => {
        arr.splice(i, 1);
        onChange();
        draw();
      });
      top.append(tag, rm);
      card.appendChild(top);
      fields.forEach((def) => card.appendChild(field(def, item, def.key, onChange)));
      list.appendChild(card);
    });
    container.appendChild(list);

    const add = document.createElement("button");
    add.type = "button";
    add.className = "a-add";
    add.textContent = `+ Add ${itemNoun.toLowerCase()}`;
    add.addEventListener("click", () => {
      arr.push(blankFactory());
      onChange();
      draw();
    });
    container.appendChild(add);
  }
  draw();
}

function makeSection(title, bodyBuilder) {
  const sec = document.createElement("section");
  sec.className = "a-section";
  const head = document.createElement("div");
  head.className = "a-section__head";
  head.innerHTML = `<h2>${title}</h2><span>▾</span>`;
  head.addEventListener("click", () => sec.classList.toggle("is-collapsed"));
  const body = document.createElement("div");
  body.className = "a-section__body";
  bodyBuilder(body);
  sec.append(head, body);
  return sec;
}

function subhead(text) {
  const h = document.createElement("h3");
  h.className = "a-subhead";
  h.textContent = text;
  return h;
}

/* ════════════════ SECTION BUILDERS ════════════════ */
function buildHero(body, onChange) {
  body.appendChild(field({ label: "Overline (small text above headline)", type: "text" }, state.hero, "overline", onChange));
  const row = document.createElement("div");
  row.className = "a-row";
  row.appendChild(field({ label: "Headline line 1", type: "text" }, state.hero, "titleLine1", onChange));
  row.appendChild(field({ label: "Headline line 2 (shown in accent color)", type: "text" }, state.hero, "titleLine2", onChange));
  body.appendChild(row);
  body.appendChild(field({ label: "Subheading (HTML ok, e.g. <strong>)", type: "textarea", rows: 3 }, state.hero, "sub", onChange));
  const row2 = document.createElement("div");
  row2.className = "a-row";
  row2.appendChild(field({ label: "Primary button label", type: "text" }, state.hero, "ctaPrimaryLabel", onChange));
  row2.appendChild(field({ label: "Primary button link", type: "text" }, state.hero, "ctaPrimaryHref", onChange));
  body.appendChild(row2);
  const row3 = document.createElement("div");
  row3.className = "a-row";
  row3.appendChild(field({ label: "Secondary button label", type: "text" }, state.hero, "ctaSecondaryLabel", onChange));
  row3.appendChild(field({ label: "Secondary button link", type: "text" }, state.hero, "ctaSecondaryHref", onChange));
  body.appendChild(row3);
}

function buildLegacy(body, onChange) {
  body.appendChild(field({ label: "Lead paragraph (HTML ok, e.g. <strong>)", type: "textarea", rows: 4 }, state.legacy, "lead", onChange));

  body.appendChild(subhead("Archive Photo"));
  const photoRow = document.createElement("div");
  photoRow.className = "a-row";
  photoRow.appendChild(field({ label: "Photo path", type: "text" }, state.legacy.photo, "src", onChange));
  photoRow.appendChild(field({ label: "Photo alt text", type: "text" }, state.legacy.photo, "alt", onChange));
  body.appendChild(photoRow);
  body.appendChild(field({ label: "Photo caption", type: "text" }, state.legacy.photo, "caption", onChange));

  body.appendChild(subhead("Stats"));
  buildRepeatableSection(
    body,
    state.legacy.stats,
    [
      { key: "value", label: "Number", type: "number" },
      { key: "suffix", label: 'Suffix (e.g. "yrs", "k ft²")' },
      { key: "label", label: "Label text" },
    ],
    () => ({ value: 0, suffix: "", label: "" }),
    "Stat",
    onChange
  );

  body.appendChild(subhead("Timeline"));
  buildRepeatableSection(
    body,
    state.legacy.timeline,
    [
      { key: "year", label: "Year" },
      { key: "title", label: "Title" },
      { key: "body", label: "Description", type: "textarea", rows: 2 },
    ],
    () => ({ year: "", title: "", body: "" }),
    "Timeline entry",
    onChange
  );
}

function buildBanner(body, onChange) {
  body.appendChild(field({ label: "Image path", type: "text" }, state.banner, "src", onChange));
  body.appendChild(field({ label: "Image alt text", type: "text" }, state.banner, "alt", onChange));
  body.appendChild(field({ label: "Caption", type: "text" }, state.banner, "caption", onChange));
}

function buildDivisions(body, onChange) {
  buildRepeatableSection(
    body,
    state.divisions,
    [
      { key: "index", label: "Index letter (A, B, C…)" },
      { key: "image", label: "Image path" },
      { key: "alt", label: "Image alt text" },
      { key: "title", label: "Title (HTML ok, e.g. <br />)" },
      { key: "body", label: "Description", type: "textarea", rows: 2 },
      { key: "items", label: "Bullet list (one per line)", type: "lines", rows: 6 },
    ],
    () => ({
      index: String.fromCharCode(65 + state.divisions.length),
      image: "",
      alt: "",
      title: "New Division",
      body: "",
      items: [],
    }),
    "Division",
    onChange
  );
}

function buildMachines(body, onChange) {
  body.appendChild(field({ label: "Section title", type: "text" }, state.machinesIntro, "title", onChange));
  body.appendChild(field({ label: "Section intro text", type: "textarea", rows: 2 }, state.machinesIntro, "body", onChange));
  body.appendChild(subhead("Machines"));
  buildRepeatableSection(
    body,
    state.machines,
    [
      { key: "tag", label: "Tag (category label)" },
      { key: "image", label: "Image path" },
      { key: "alt", label: "Image alt text" },
      { key: "title", label: "Machine name" },
      { key: "body", label: "Description", type: "textarea", rows: 3 },
    ],
    () => ({ tag: "NEW", image: "", alt: "", title: "New Machine", body: "" }),
    "Machine",
    onChange
  );
}

function buildSpotlight(body, onChange) {
  buildRepeatableSection(
    body,
    state.spotlight,
    [
      { key: "chip", label: "Chip label" },
      { key: "title", label: "Title (main)" },
      { key: "titleAccent", label: "Title (accent suffix)" },
      { key: "body", label: "Description", type: "textarea", rows: 3 },
      { key: "image", label: "Image path" },
      { key: "alt", label: "Image alt text" },
      { key: "cutout", label: "Cutout style (transparent, no card background)", type: "checkbox" },
      { key: "ringVariant", label: 'Ring color variant — leave blank, or "spotlight__rings--alt"' },
    ],
    () => ({ chip: "", title: "", titleAccent: "", body: "", image: "", alt: "", cutout: false, ringVariant: "" }),
    "Panel",
    onChange
  );
}

function buildServices(body, onChange) {
  body.appendChild(field({ label: "Intro paragraph", type: "textarea", rows: 2 }, state.services, "intro", onChange));
  body.appendChild(subhead("Service Cards"));
  buildRepeatableSection(
    body,
    state.services.items,
    [
      { key: "num", label: 'Number (e.g. "01")' },
      { key: "title", label: "Title" },
      { key: "body", label: "Description", type: "textarea", rows: 3 },
    ],
    () => ({ num: String(state.services.items.length + 1).padStart(2, "0"), title: "New Service", body: "" }),
    "Service",
    onChange
  );

  body.appendChild(subhead("Financing"));
  body.appendChild(field({ label: "Financing quote", type: "textarea", rows: 2 }, state.services, "financingQuote", onChange));
  buildRepeatableSection(
    body,
    state.services.financingPartners,
    [
      { key: "name", label: "Partner name" },
      { key: "body", label: "Description" },
    ],
    () => ({ name: "", body: "" }),
    "Partner",
    onChange
  );

  body.appendChild(subhead("Service Manuals"));
  const manualsRow = document.createElement("div");
  manualsRow.className = "a-row";
  manualsRow.appendChild(field({ label: "Section title", type: "text" }, state.services, "manualsTitle", onChange));
  manualsRow.appendChild(field({ label: "Section note", type: "text" }, state.services, "manualsBody", onChange));
  body.appendChild(manualsRow);
  const manualsNote = document.createElement("p");
  manualsNote.style.cssText = "font-size:12px;color:var(--ink-dim);";
  manualsNote.textContent =
    "File path must point to a PDF already sitting in the manuals/ folder — this tool doesn't upload files, it only edits the JSON.";
  body.appendChild(manualsNote);
  buildRepeatableSection(
    body,
    state.services.manuals,
    [
      { key: "title", label: "Manual title" },
      { key: "file", label: "File path (e.g. manuals/my-machine-manual.pdf)" },
    ],
    () => ({ title: "New Manual", file: "" }),
    "Manual",
    onChange
  );
}

function buildTeam(body, onChange) {
  buildRepeatableSection(
    body,
    state.team.members,
    [
      { key: "initials", label: "Initials" },
      { key: "name", label: "Full name" },
      { key: "title", label: "Job title" },
    ],
    () => ({ initials: "", name: "New Member", title: "" }),
    "Member",
    onChange
  );

  body.appendChild(subhead("International Partner"));
  const row = document.createElement("div");
  row.className = "a-row";
  row.appendChild(field({ label: "Label", type: "text" }, state.team, "partnerLabel", onChange));
  row.appendChild(field({ label: "Link URL", type: "text" }, state.team, "partnerHref", onChange));
  body.appendChild(row);
  body.appendChild(field({ label: "Logo image path", type: "text" }, state.team, "partnerImg", onChange));
  body.appendChild(field({ label: "Note (e.g. careers text)", type: "text" }, state.team, "note", onChange));
}

function buildNews(body, onChange) {
  const note = document.createElement("p");
  note.style.cssText = "font-size:12px;color:var(--ink-dim);margin-bottom:4px;";
  note.textContent =
    "Fill in either \"Full article text\" (real, complete content you're allowed to publish — one paragraph per line) OR mark it external and leave full text blank, in which case only the summary shows along with the note explaining why.";
  body.appendChild(note);
  buildRepeatableSection(
    body,
    state.news,
    [
      { key: "date", label: "Date" },
      { key: "title", label: "Headline" },
      { key: "category", label: "Category" },
      { key: "synopsis", label: "Short summary (always shown on the card)", type: "textarea", rows: 2 },
      { key: "fullText", label: "Full article text (one paragraph per line — leave blank if not available)", type: "lines", rows: 6 },
      { key: "externalSource", label: "Sourced from elsewhere / can't publish in full", type: "checkbox" },
      { key: "sourceNote", label: "Note explaining why (shown instead of full text)", type: "textarea", rows: 2 },
    ],
    () => ({ date: "", title: "New Article", category: "Company", synopsis: "", fullText: [], externalSource: false, sourceNote: "" }),
    "Article",
    onChange
  );
}

function buildContact(body, onChange) {
  const row = document.createElement("div");
  row.className = "a-row";
  row.appendChild(field({ label: "Primary phone (display)", type: "text" }, state.contact, "phonePrimary", onChange));
  row.appendChild(field({ label: "Primary phone (tel: link, digits only)", type: "text" }, state.contact, "phonePrimaryHref", onChange));
  body.appendChild(row);
  const row2 = document.createElement("div");
  row2.className = "a-row";
  row2.appendChild(field({ label: "Secondary phone (display)", type: "text" }, state.contact, "phoneSecondary", onChange));
  row2.appendChild(field({ label: "Secondary phone (tel: link, digits only)", type: "text" }, state.contact, "phoneSecondaryHref", onChange));
  body.appendChild(row2);
  body.appendChild(field({ label: "Note", type: "textarea", rows: 2 }, state.contact, "note", onChange));
  body.appendChild(field({ label: "Address (one line per row)", type: "lines", rows: 3 }, state.contact, "addressLines", onChange));
  const row3 = document.createElement("div");
  row3.className = "a-row";
  row3.appendChild(field({ label: "Map link URL", type: "text" }, state.contact, "mapHref", onChange));
  row3.appendChild(field({ label: "Map image path", type: "text" }, state.contact, "mapImg", onChange));
  body.appendChild(row3);
}

function buildQuickActions(body, onChange) {
  buildRepeatableSection(
    body,
    state.quickActions,
    [
      { key: "label", label: "Small label" },
      { key: "title", label: "Bold title" },
      { key: "sub", label: 'Sub text (e.g. "800-435-7174 →")' },
      { key: "href", label: "Link URL" },
      { key: "external", label: "Opens in a new tab", type: "checkbox" },
    ],
    () => ({ label: "", title: "", sub: "", href: "#", external: false }),
    "Quick action",
    onChange
  );
}

function buildFooter(body, onChange) {
  body.appendChild(field({ label: "Background wordmark text", type: "text" }, state.footer, "wordmark", onChange));
  body.appendChild(field({ label: "Copyright line", type: "text" }, state.footer, "copyright", onChange));
  body.appendChild(field({ label: "Address line", type: "text" }, state.footer, "address", onChange));
  const row = document.createElement("div");
  row.className = "a-row";
  row.appendChild(field({ label: "Partner label", type: "text" }, state.footer, "partnerLabel", onChange));
  row.appendChild(field({ label: "Partner link URL", type: "text" }, state.footer, "partnerHref", onChange));
  body.appendChild(row);
}

/* ════════════════ BOOT ════════════════ */
function renderAll() {
  sectionsEl.innerHTML = "";
  sectionsEl.appendChild(makeSection("Hero", (b) => buildHero(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Legacy / History", (b) => buildLegacy(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Process Banner Image", (b) => buildBanner(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Equipment Divisions", (b) => buildDivisions(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Machine Line", (b) => buildMachines(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Spotlight Panels", (b) => buildSpotlight(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Services & Financing", (b) => buildServices(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Team", (b) => buildTeam(b, persistDraft)));
  sectionsEl.appendChild(makeSection("News Articles", (b) => buildNews(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Contact Info", (b) => buildContact(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Quick Action Bar", (b) => buildQuickActions(b, persistDraft)));
  sectionsEl.appendChild(makeSection("Footer", (b) => buildFooter(b, persistDraft)));
}

btnReset.addEventListener("click", async () => {
  if (!confirm("Discard all unsaved edits in this browser and reload content.json from disk?")) return;
  localStorage.removeItem(DRAFT_KEY);
  state = await fetchContent();
  renderAll();
  statusEl.textContent = "Reloaded from data/content.json";
});

btnPreview.addEventListener("click", () => {
  persistDraft();
  window.open("index.html?draft=1", "_blank");
});

btnDownload.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "content.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  statusEl.textContent = "Downloaded — replace data/content.json with this file, then redeploy";
});

fileLoad.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    state = JSON.parse(await file.text());
    persistDraft();
    renderAll();
    statusEl.textContent = `Loaded ${file.name}`;
  } catch {
    alert("That file is not valid JSON.");
  }
  fileLoad.value = "";
});

(async function init() {
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft) {
    try {
      state = JSON.parse(draft);
      statusEl.textContent = "Resumed your unsaved draft from this browser";
    } catch {
      state = await fetchContent();
    }
  } else {
    state = await fetchContent();
    statusEl.textContent = "Loaded data/content.json";
  }
  renderAll();
})();
