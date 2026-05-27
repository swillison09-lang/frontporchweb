/*
  Front Porch Web — Owner Setup page logic
  Owner-only CRUD for everything that varies per business type:
    - Pricing tiers (Step 8 of the questionnaire)
    - Photo / media uploads expected (Step 6 + variant photo buckets)
    - Links collected (Step 4: website, social, video, fundraising, etc.)
    - Custom questionnaire fields specific to this site type

  All persisted to localStorage under BUSINESS_TYPES_KEY. The portal
  questionnaire reads this same key. Clients never see this page.

  ┌──────────────────────────────────────────────────────────────┐
  │  PLUG-IN POINT: swap localStorage for Supabase so types,     │
  │  pricing, photo categories, link types, and custom fields    │
  │  all sync across devices and survive cache clears.           │
  │                                                              │
  │    const { data } = await supabase                           │
  │      .from('business_types').select('*');                    │
  │    await supabase.from('business_types').upsert(types);      │
  │                                                              │
  │  Schema mirrors the local shape:                             │
  │    business_types {                                          │
  │      id, name, description, site_types text[], note,         │
  │      tiers jsonb, photo_categories jsonb,                    │
  │      link_types jsonb, custom_fields jsonb                   │
  │    }                                                         │
  └──────────────────────────────────────────────────────────────┘
*/

const BUSINESS_TYPES_KEY = 'frontporch_business_types';

// Step-1 site type values the questionnaire offers. Must stay in sync with
// the <select id="qSiteType"> options in portal.html.
const SITE_TYPE_OPTIONS = [
  { value: 'local-business',     label: 'Local business' },
  { value: 'adoption-profile',   label: 'Adoption profile' },
  { value: 'recruiting-profile', label: 'College sports recruiting' },
  { value: 'personal-other',     label: 'Personal / other' },
];

// Field-type vocabulary for the custom-fields editor below.
const CUSTOM_FIELD_TYPES = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Long text (bullet notes)' },
  { value: 'verbatim', label: 'Verbatim (passes through unedited)' },
  { value: 'select',   label: 'Choose one (options in placeholder)' },
  { value: 'number',   label: 'Number' },
];

// Link-type vocabulary for the link-types editor below.
const LINK_KINDS = [
  { value: 'url',           label: 'URL (any link)' },
  { value: 'social-handle', label: 'Social handle' },
  { value: 'video',         label: 'Video / film link' },
  { value: 'fundraising',   label: 'Fundraising / crowdsource' },
  { value: 'contact',       label: 'Contact link (email / tel)' },
];

// Seed data — saved to localStorage the first time the page loads with
// no existing data. The owner is expected to edit these, not start blank.
const SEED_BUSINESS_TYPES = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Local businesses — lawn care, trades, shops',
    siteTypes: ['local-business'],
    note: 'These clients are used to paying monthly — pair with managed hosting.',
    tiers: [
      { id: 'professional-starter',  name: 'Starter',  price: '$700',   badge: null,            features: ['Single-page site', 'Mobile-friendly', 'Contact form'] },
      { id: 'professional-standard', name: 'Standard', price: '$1,200', badge: 'Most Popular',  features: ['Multi-section site', 'Gallery', 'Basic SEO setup'] },
      { id: 'professional-premium',  name: 'Premium',  price: '$2,000', badge: null,            features: ['Everything in Standard', 'Blog setup', 'Online enquiry / booking features'] },
    ],
    photoCategories: [
      { key: 'general', label: 'Storefront, team, products', helpText: 'A handful of favorites — we recommend 3 to 5.' },
    ],
    linkTypes: [
      { key: 'website',    label: 'Current website',   placeholder: 'https://yoursite.com',           kind: 'url' },
      { key: 'facebook',   label: 'Facebook',          placeholder: 'https://facebook.com/your-page', kind: 'url' },
      { key: 'instagram',  label: 'Instagram',         placeholder: 'https://instagram.com/handle',   kind: 'url' },
      { key: 'otherLinks', label: 'Other links / notes', placeholder: 'YouTube, Yelp, sites we love', kind: 'url' },
    ],
    customFields: [
      { key: 'tagline',   label: 'Tagline (one line)',       type: 'text',     placeholder: 'e.g. Honest HVAC for the Cedar Valley', helpText: '' },
      { key: 'facts',     label: 'Key facts',                type: 'textarea', placeholder: 'Bullet notes work great',                helpText: '' },
      { key: 'services',  label: 'Services / offerings',     type: 'textarea', placeholder: 'One per line',                            helpText: '' },
      { key: 'feeling',   label: 'Feeling / message',        type: 'textarea', placeholder: 'Warm, not corporate; trustworthy',        helpText: '' },
      { key: 'mustHaves', label: 'Must-haves and to avoid',  type: 'textarea', placeholder: 'No stock photos; show our truck',         helpText: '' },
    ],
  },
  {
    id: 'personal',
    name: 'Personal',
    description: 'Portfolios, personal &amp; passion sites',
    siteTypes: ['personal-other'],
    note: '',
    tiers: [
      { id: 'personal-simple',   name: 'Simple',   price: '$500',   badge: null, features: ['Single-page personal site'] },
      { id: 'personal-standard', name: 'Standard', price: '$900',   badge: null, features: ['Multi-section site with gallery'] },
      { id: 'personal-plus',     name: 'Plus',     price: '$1,400', badge: null, features: ['Adds a blog / updates section'] },
    ],
    photoCategories: [
      { key: 'general', label: 'Photos to share', helpText: '3 to 5 favorites is plenty.' },
    ],
    linkTypes: [
      { key: 'website',    label: 'Current website',   placeholder: 'https://yoursite.com',         kind: 'url' },
      { key: 'instagram',  label: 'Instagram',         placeholder: 'https://instagram.com/handle', kind: 'url' },
      { key: 'otherLinks', label: 'Other links',       placeholder: 'YouTube, portfolio, etc.',     kind: 'url' },
    ],
    customFields: [
      { key: 'tagline',   label: 'Tagline (one line)',  type: 'text',     placeholder: 'A one-line intro',  helpText: '' },
      { key: 'facts',     label: 'Key facts about you', type: 'textarea', placeholder: 'Bullet notes',      helpText: '' },
      { key: 'feeling',   label: 'Feeling / message',   type: 'textarea', placeholder: 'Tone and vibe',     helpText: '' },
      { key: 'mustHaves', label: 'Must-haves / avoid',  type: 'textarea', placeholder: 'Anything to avoid', helpText: '' },
    ],
  },
  {
    id: 'adoption',
    name: 'Adoption',
    description: 'Hopeful adoptive families',
    siteTypes: ['adoption-profile'],
    note: 'Many adoptive families are fundraising and money is tight — consider a lower rate or a build-plus-12-months-hosting bundle for them.',
    tiers: [
      { id: 'adoption-essential', name: 'Essential', price: '$650',   badge: null,            features: ['Warm profile site', 'Photo gallery', 'Contact'] },
      { id: 'adoption-full',      name: 'Full',      price: '$1,000', badge: 'Most Popular',  features: ['Adds journey blog / vlog feed', 'Fundraising section'] },
      { id: 'adoption-complete',  name: 'Complete',  price: '$1,500', badge: null,            features: ['Adds editable family login', 'Admin features'] },
    ],
    photoCategories: [
      { key: 'homeOutside',  label: 'Outside of home',   helpText: 'Front of the house, yard, porch.' },
      { key: 'homeInside',   label: 'Nursery / inside',  helpText: 'Where baby will live and play.' },
      { key: 'neighborhood', label: 'Neighborhood',      helpText: 'Parks, schools, the street.' },
      { key: 'pets',         label: 'Pets',              helpText: 'Family animals.' },
      { key: 'moments',      label: 'Everyday moments',  helpText: 'Each photo gets a one-line description.' },
      { key: 'portraits',    label: 'Headshots / portraits', helpText: 'Studio or candid family portraits.' },
    ],
    linkTypes: [
      { key: 'fundraisingUrl', label: 'Fundraising link', placeholder: 'GoFundMe / GiveSendGo URL', kind: 'fundraising' },
      { key: 'contactEmail',   label: 'Adoption email',   placeholder: 'hello@yourfamily.com',      kind: 'contact' },
      { key: 'contactPhone',   label: 'Adoption phone',   placeholder: '(555) 123-4567',            kind: 'contact' },
    ],
    customFields: [
      { key: 'city',         label: 'City and state',                 type: 'text',     placeholder: 'e.g. Cedar Falls, Iowa', helpText: '' },
      { key: 'letter',       label: 'Letter to birth parents',        type: 'verbatim', placeholder: 'Written in family\'s own words', helpText: 'Passed through verbatim on the site.' },
      { key: 'parent1Name',  label: 'Parent 1 name',                  type: 'text',     placeholder: 'e.g. Sarah',             helpText: '' },
      { key: 'parent1Facts', label: 'Parent 1 — 3 to 5 short facts',  type: 'textarea', placeholder: 'Bullet notes',           helpText: '' },
      { key: 'parent2Name',  label: 'Parent 2 name (optional)',       type: 'text',     placeholder: 'e.g. Michael',           helpText: '' },
      { key: 'parent2Facts', label: 'Parent 2 — 3 to 5 short facts',  type: 'textarea', placeholder: 'Bullet notes',           helpText: '' },
      { key: 'agency',       label: 'Adoption agency',                type: 'text',     placeholder: 'Agency name',            helpText: '' },
      { key: 'caseworker',   label: 'Caseworker',                     type: 'text',     placeholder: 'Name + contact',         helpText: '' },
      { key: 'anythingElse', label: 'Anything else',                  type: 'textarea', placeholder: 'Verses, ideas, notes',   helpText: '' },
    ],
  },
  {
    id: 'recruiting',
    name: 'College Sports Recruiting',
    description: 'High-school athletes building a recruiting profile for college coaches.',
    siteTypes: ['recruiting-profile'],
    note: 'The athlete\'s recruiting site is the central hub a coach reaches from any social bio. Lead with grad year, sport/position, and the PRIMARY highlight video. NCAA fields are collected as athlete-provided input — never as eligibility guarantees (rules change; verify at eligibilitycenter.org). Mark measurables as verified vs self-reported.',
    tiers: [
      { id: 'recruiting-starter',  name: 'Starter',  price: '$600',   badge: null,            features: ['Single-page recruiting profile', 'Embedded highlight video', 'Stats and academics', 'Contact + coach info'] },
      { id: 'recruiting-standard', name: 'Standard', price: '$1,000', badge: 'Most Popular',  features: ['Multi-section site', 'Photo gallery + multiple highlight videos', 'Social bio link block', 'Basic SEO so coaches find you'] },
      { id: 'recruiting-premium',  name: 'Premium',  price: '$1,600', badge: null,            features: ['Everything in Standard', 'Game film library', 'News / season updates section', 'Custom domain + analytics'] },
    ],
    photoCategories: [
      { key: 'headshot',    label: 'Headshot',    helpText: 'One clean portrait — coaches expect this front-and-center.' },
      { key: 'actionShots', label: 'Action shots', helpText: 'In-game photos showing form, intensity, jersey number.' },
      { key: 'teamPhotos',  label: 'Team photos',  helpText: 'Roster shots, team huddles, championship pics.' },
    ],
    linkTypes: [
      { key: 'primaryHighlightVideo', label: 'Primary highlight video', placeholder: 'Single most important reel URL', kind: 'video' },
      { key: 'highlightVideos', label: 'Additional highlight videos', placeholder: 'YouTube or Hudl URL (one per line)', kind: 'video' },
      { key: 'gameFilm',        label: 'Game film links',        placeholder: 'Full-game URL (one per line)',        kind: 'video' },
      { key: 'instagram',       label: 'Instagram',              placeholder: '@handle or full URL',                 kind: 'social-handle' },
      { key: 'twitter',         label: 'X / Twitter',            placeholder: '@handle or full URL',                 kind: 'social-handle' },
      { key: 'tiktok',          label: 'TikTok',                 placeholder: '@handle or full URL',                 kind: 'social-handle' },
      { key: 'youtube',         label: 'YouTube',                placeholder: 'Channel URL or @handle',              kind: 'social-handle' },
      { key: 'hudl',            label: 'Hudl profile',           placeholder: 'https://hudl.com/profile/...',        kind: 'url' },
      { key: 'otherSocial',     label: 'Other social / online',  placeholder: 'Any other relevant link',             kind: 'url' },
    ],
    customFields: [
      // ── Coach-facing essentials (most important first) ──
      { key: 'gradYear',           label: 'Graduation year',          type: 'number',   placeholder: 'e.g. 2027',                       helpText: 'The #1 filter coaches use. Required-feel on the questionnaire.' },
      { key: 'primarySport',       label: 'Primary sport',            type: 'text',     placeholder: 'e.g. Football, Soccer, Lacrosse', helpText: '' },
      { key: 'primaryPositions',   label: 'Primary position(s)',      type: 'text',     placeholder: 'e.g. Quarterback / Safety',       helpText: '' },
      { key: 'secondaryPositions', label: 'Secondary position(s)',    type: 'text',     placeholder: 'e.g. Punter, Kick returner',      helpText: '' },
      { key: 'highSchool',         label: 'High school name',         type: 'text',     placeholder: 'e.g. Cedar Falls High School',    helpText: '' },
      { key: 'city',               label: 'City and state',           type: 'text',     placeholder: 'e.g. Cedar Falls, Iowa',          helpText: '' },
      { key: 'height',             label: 'Height',                   type: 'text',     placeholder: 'e.g. 6\'1"',                      helpText: '' },
      { key: 'weight',             label: 'Weight',                   type: 'text',     placeholder: 'e.g. 185 lbs',                    helpText: '' },
      // ── NCAA Eligibility Center (applies to all divisions starting 2026-27) ──
      { key: 'ncaaIdStatus',       label: 'NCAA registration status', type: 'text',     placeholder: 'registered / in-progress / not-yet / unsure', helpText: 'Starting 2026-27, applies to ALL divisions including D-III. Form collects input only; rules change — verify at eligibilitycenter.org.' },
      { key: 'ncaaId',             label: 'NCAA Eligibility Center ID', type: 'text',   placeholder: 'e.g. 1234567890',                 helpText: 'Leave blank if not yet registered.' },
      // ── Academics ──
      { key: 'gpa',                label: 'Overall GPA',              type: 'text',     placeholder: 'e.g. 3.8 (weighted) / 4.2',       helpText: '' },
      { key: 'coreGpa',            label: 'Core-course GPA',          type: 'text',     placeholder: 'e.g. 3.6 across core courses',    helpText: 'NCAA recalculates GPA from ~16 approved core courses; coaches may ask for this separately.' },
      { key: 'satScore',           label: 'SAT score',                type: 'text',     placeholder: 'e.g. 1310 (R/W 660, M 650)',      helpText: 'Leave blank if not taken.' },
      { key: 'actScore',           label: 'ACT score',                type: 'text',     placeholder: 'e.g. 28 composite',               helpText: 'Leave blank if not taken.' },
      { key: 'transcriptStatus',   label: 'Official transcript availability', type: 'text', placeholder: 'yes / in-progress / not-yet', helpText: '' },
      { key: 'intendedMajor',      label: 'Intended major / academic interests', type: 'textarea', placeholder: 'e.g. Business; engineering; undecided but interested in...', helpText: '' },
      { key: 'academicHonors',     label: 'Academic honors',          type: 'textarea', placeholder: 'NHS, honor roll, AP scholar, etc.', helpText: 'Bullet notes are perfect.' },
      // ── Optional / minor (pushed down so the form does not feel overwhelming) ──
      { key: 'classRank',          label: 'Class rank (optional)',    type: 'text',     placeholder: 'e.g. 22 of 240 (top 10%)',        helpText: 'Many schools no longer report class rank — leave blank if so.' },
      { key: 'jerseyNumber',       label: 'Jersey number (optional)', type: 'text',     placeholder: 'e.g. 12',                         helpText: 'Useful for tagging clips, otherwise minor.' },
      // ── Athletic performance ──
      { key: 'keyStats',           label: 'Key stats and achievements', type: 'textarea', placeholder: '- 2,800 passing yards (Jr year)\n- 28 TD / 4 INT\n- 64% completion', helpText: 'Sport-specific bullet list. Coaches scan this first.' },
      { key: 'awards',             label: 'Awards and honors',        type: 'textarea', placeholder: '- All-Conference 1st team (Jr, Sr)\n- Team Captain\n- Offensive MVP 2025', helpText: '' },
      { key: 'varsityYears',       label: 'Years on varsity',         type: 'text',     placeholder: 'e.g. 3 (started Sophomore year)', helpText: '' },
      { key: 'teamAccomplishments', label: 'Team accomplishments',    type: 'textarea', placeholder: '- District champs 2024\n- Regional finalists', helpText: '' },
      // ── Structured measurables (verified vs self-reported) — collected as 5 rows in the form ──
      { key: 'measurables',        label: 'Measurables (structured rows)', type: 'textarea', placeholder: 'Saved as structured rows: name, value, verified/self-reported, source.', helpText: 'Each row has a verified vs self-reported toggle and a "verified by / where" source. 5 rows in the questionnaire by default.' },
      { key: 'combineNotes',       label: 'Other measurables / notes', type: 'textarea', placeholder: '- Sport-specific tests not listed above\n- Notes on where/when numbers were taken', helpText: '' },
      // ── Upcoming schedule (where coaches can watch in person) ──
      { key: 'upcomingSchedule',   label: 'Upcoming schedule',        type: 'textarea', placeholder: '- Aug 23 — vs. West HS (home)\n- Sep 14 — Midwest Elite Showcase, Indianapolis', helpText: 'Upcoming games, showcases, camps, tournaments. Dates + locations help coaches plan.' },
      // ── Recruiting goals ──
      { key: 'divisionsInterest',  label: 'Divisions of interest',    type: 'text',     placeholder: 'D1, D2, D3, NAIA, JUCO (comma-separate)', helpText: '' },
      { key: 'schoolsInterest',    label: 'Schools of interest',      type: 'textarea', placeholder: '- Iowa\n- Northern Iowa\n- Drake\n- Open to others', helpText: '' },
      { key: 'campsAttended',      label: 'Camps / showcases attended (history)', type: 'textarea', placeholder: '- Iowa Elite Camp 2025\n- Midwest QB Showcase', helpText: '' },
      // ── Teams & coaches ──
      { key: 'hsHeadCoachName',    label: 'HS head coach — name',     type: 'text',     placeholder: 'e.g. Coach Tom Reilly',           helpText: '' },
      { key: 'hsHeadCoachEmail',   label: 'HS head coach — email',    type: 'text',     placeholder: 'coach@school.edu',                helpText: '' },
      { key: 'hsHeadCoachPhone',   label: 'HS head coach — phone',    type: 'text',     placeholder: '(555) 123-4567',                  helpText: '' },
      { key: 'clubTeamName',       label: 'Club / travel / AAU team', type: 'text',     placeholder: 'e.g. Iowa Elite 7on7',            helpText: '' },
      { key: 'clubCoachName',      label: 'Club coach — name',        type: 'text',     placeholder: 'e.g. Coach Mike Ross',            helpText: '' },
      { key: 'clubCoachEmail',     label: 'Club coach — email',       type: 'text',     placeholder: 'coach@club.org',                  helpText: '' },
      { key: 'clubCoachPhone',     label: 'Club coach — phone',       type: 'text',     placeholder: '(555) 234-5678',                  helpText: '' },
      { key: 'additionalReferences', label: 'Additional coach contacts', type: 'textarea', placeholder: '- Strength coach: Sarah Lee, sarah@school.edu\n- Position coach: ...', helpText: 'Position coach, strength coach, etc.' },
      // ── Character references (NEW — non-coach) ──
      { key: 'characterReferences', label: 'Character references (structured rows)', type: 'textarea', placeholder: 'Saved as structured rows: name, role/relationship, email, phone.', helpText: 'Trainers, teachers, mentors — non-coach references. 3 rows in the questionnaire by default.' },
      // ── Contact ──
      { key: 'athleteEmail',       label: 'Athlete email',            type: 'text',     placeholder: 'athlete@example.com',             helpText: '' },
      { key: 'athletePhone',       label: 'Athlete phone',            type: 'text',     placeholder: '(555) 345-6789',                  helpText: '' },
      { key: 'parentName',         label: 'Parent / guardian — name', type: 'text',     placeholder: 'e.g. Mary Doe',                   helpText: '' },
      { key: 'parentEmail',        label: 'Parent / guardian — email', type: 'text',    placeholder: 'parent@example.com',              helpText: '' },
      { key: 'parentPhone',        label: 'Parent / guardian — phone', type: 'text',    placeholder: '(555) 456-7890',                  helpText: '' },
      // ── Athlete statement (verbatim — written by athlete) ──
      { key: 'athleteStatement',   label: 'Athlete statement (verbatim)', type: 'verbatim', placeholder: 'Why you play, your goals, your work ethic — in your own words.', helpText: 'Passed through verbatim on the site.' },
    ],
  },
];

// In-memory copy of the current business types list (mirrors localStorage)
let businessTypes = [];


// ════════════════════════════════════════════════════════════════════════════
//  Boot
// ════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  businessTypes = loadTypes();
  renderTypes();
  document.getElementById('addTypeBtn')?.addEventListener('click', addNewType);
  document.getElementById('reseedBtn')?.addEventListener('click', () => {
    if (!confirm('This wipes your current business types and restores the built-in defaults (including College Sports Recruiting). Continue?')) return;
    clearLocalStorage(BUSINESS_TYPES_KEY);
    businessTypes = loadTypes();
    renderTypes();
  });
});


// ════════════════════════════════════════════════════════════════════════════
//  Persistence
// ════════════════════════════════════════════════════════════════════════════

function loadTypes() {
  const stored = getLocalStorage(BUSINESS_TYPES_KEY, null);
  if (Array.isArray(stored) && stored.length) {
    // Backfill new meta arrays for types saved by an older build
    return stored.map(t => ({
      ...t,
      photoCategories: Array.isArray(t.photoCategories) ? t.photoCategories : [],
      linkTypes:       Array.isArray(t.linkTypes)       ? t.linkTypes       : [],
      customFields:    Array.isArray(t.customFields)    ? t.customFields    : [],
    }));
  }
  setLocalStorage(BUSINESS_TYPES_KEY, SEED_BUSINESS_TYPES);
  return JSON.parse(JSON.stringify(SEED_BUSINESS_TYPES));
}

function persist() {
  setLocalStorage(BUSINESS_TYPES_KEY, businessTypes);
}


// ════════════════════════════════════════════════════════════════════════════
//  Rendering
// ════════════════════════════════════════════════════════════════════════════

function renderTypes() {
  const container = document.getElementById('typesList');
  if (!container) return;
  container.innerHTML = '';

  if (!businessTypes.length) {
    container.innerHTML = `
      <div class="setup-empty">
        <p>No business types yet.</p>
        <p class="setup-empty-sub">Click <strong>+ Add new business type</strong> above to create one.</p>
      </div>
    `;
    return;
  }

  businessTypes.forEach(type => {
    container.appendChild(renderTypeCard(type));
  });
}

function renderTypeCard(type) {
  const card = document.createElement('section');
  card.className = 'type-card';
  card.dataset.typeId = type.id;

  card.innerHTML = `
    <header class="type-card-head">
      <input type="text" class="type-name-input" data-field="name"
             value="${escapeAttr(type.name)}" placeholder="Business type name"
             aria-label="Business type name">
      <button type="button" class="btn-icon delete-type-btn"
              aria-label="Delete this business type" title="Delete this business type">&times;</button>
    </header>

    <label class="setup-label" for="desc-${type.id}">Short description</label>
    <input type="text" id="desc-${type.id}" class="type-desc-input" data-field="description"
           value="${escapeAttr(type.description || '')}"
           placeholder="e.g. Local businesses — lawn care, trades, shops">

    <fieldset class="site-types-fieldset">
      <legend class="setup-label">Maps to Step 1 site type(s)</legend>
      <div class="site-types-row">
        ${SITE_TYPE_OPTIONS.map(opt => `
          <label class="site-type-chip">
            <input type="checkbox" value="${escapeAttr(opt.value)}"
                   ${type.siteTypes?.includes(opt.value) ? 'checked' : ''}>
            <span>${escapeHtml(opt.label)}</span>
          </label>
        `).join('')}
      </div>
    </fieldset>

    <label class="setup-label" for="note-${type.id}">Owner note (internal — clients never see this)</label>
    <textarea id="note-${type.id}" class="type-note-input" data-field="note" rows="2"
              placeholder="Anything you'd like to remember about this client group">${escapeHtml(type.note || '')}</textarea>

    <div class="type-tiers-head">
      <h2>Pricing tiers <span class="type-tiers-count">(${type.tiers.length})</span></h2>
      <button type="button" class="btn-mini add-tier-btn"
              ${type.tiers.length >= 4 ? 'disabled' : ''}>+ Add tier</button>
    </div>

    <div class="type-tiers"></div>

    <div class="type-meta-section" data-section="photoCategories">
      <div class="type-meta-head">
        <h2>Photo &amp; media uploads <span class="type-meta-count"></span></h2>
        <button type="button" class="btn-mini add-row-btn" data-add="photoCategories">+ Add upload category</button>
      </div>
      <p class="type-meta-help">Each row becomes a photo bucket the client uploads to. Use a short label and an optional one-line hint.</p>
      <div class="type-meta-rows"></div>
    </div>

    <div class="type-meta-section" data-section="linkTypes">
      <div class="type-meta-head">
        <h2>Links collected <span class="type-meta-count"></span></h2>
        <button type="button" class="btn-mini add-row-btn" data-add="linkTypes">+ Add link type</button>
      </div>
      <p class="type-meta-help">Website, social handles, video links, fundraising/crowdsource — anything you want collected on Step 4.</p>
      <div class="type-meta-rows"></div>
    </div>

    <div class="type-meta-section" data-section="customFields">
      <div class="type-meta-head">
        <h2>Custom questionnaire fields <span class="type-meta-count"></span></h2>
        <button type="button" class="btn-mini add-row-btn" data-add="customFields">+ Add field</button>
      </div>
      <p class="type-meta-help">The questions specific to this site type. <strong>Verbatim</strong> fields pass through unedited (used for the client's own words — adoption letters, athlete statements).</p>
      <div class="type-meta-rows"></div>
    </div>

    <footer class="type-card-actions">
      <span class="type-save-status" role="status" aria-live="polite"></span>
      <button type="button" class="btn-primary save-type-btn">Save changes</button>
    </footer>
  `;

  // Render tier editors
  const tiersContainer = card.querySelector('.type-tiers');
  type.tiers.forEach(tier => {
    tiersContainer.appendChild(renderTierEditor(tier, type.tiers.length));
  });

  // Render meta-section rows
  const photoSection  = card.querySelector('[data-section="photoCategories"] .type-meta-rows');
  const linkSection   = card.querySelector('[data-section="linkTypes"] .type-meta-rows');
  const fieldSection  = card.querySelector('[data-section="customFields"] .type-meta-rows');
  (type.photoCategories || []).forEach(row => photoSection.appendChild(renderPhotoCategoryRow(row)));
  (type.linkTypes       || []).forEach(row => linkSection.appendChild(renderLinkTypeRow(row)));
  (type.customFields    || []).forEach(row => fieldSection.appendChild(renderCustomFieldRow(row)));
  refreshMetaCounts(card);

  // Wire up handlers scoped to this card
  wireCardEvents(card, type);

  return card;
}

// ── Meta-section row renderers ─────────────────────────────────────────────

function renderPhotoCategoryRow(row = {}) {
  const el = document.createElement('div');
  el.className = 'meta-row meta-row-photo';
  el.dataset.rowKind = 'photoCategories';
  el.innerHTML = `
    <div class="meta-row-grid meta-row-grid--photo">
      <input type="text" data-field="label" placeholder="Category label (e.g. Action shots)"
             value="${escapeAttr(row.label || '')}" aria-label="Category label">
      <input type="text" data-field="helpText" placeholder="Optional one-line hint"
             value="${escapeAttr(row.helpText || '')}" aria-label="Help text">
    </div>
    <button type="button" class="btn-icon delete-row-btn" aria-label="Remove" title="Remove">&times;</button>
  `;
  return el;
}

function renderLinkTypeRow(row = {}) {
  const el = document.createElement('div');
  el.className = 'meta-row meta-row-link';
  el.dataset.rowKind = 'linkTypes';
  el.innerHTML = `
    <div class="meta-row-grid meta-row-grid--link">
      <input type="text" data-field="label" placeholder="Label (e.g. Highlight video)"
             value="${escapeAttr(row.label || '')}" aria-label="Link label">
      <select data-field="kind" aria-label="Link kind">
        ${LINK_KINDS.map(k => `<option value="${escapeAttr(k.value)}" ${row.kind === k.value ? 'selected' : ''}>${escapeHtml(k.label)}</option>`).join('')}
      </select>
      <input type="text" data-field="placeholder" placeholder="Placeholder (e.g. https://...)"
             value="${escapeAttr(row.placeholder || '')}" aria-label="Placeholder">
    </div>
    <button type="button" class="btn-icon delete-row-btn" aria-label="Remove" title="Remove">&times;</button>
  `;
  return el;
}

function renderCustomFieldRow(row = {}) {
  const el = document.createElement('div');
  el.className = 'meta-row meta-row-field';
  el.dataset.rowKind = 'customFields';
  el.innerHTML = `
    <div class="meta-row-grid meta-row-grid--field">
      <input type="text" data-field="label" placeholder="Field label (e.g. GPA)"
             value="${escapeAttr(row.label || '')}" aria-label="Field label">
      <select data-field="type" aria-label="Field type">
        ${CUSTOM_FIELD_TYPES.map(t => `<option value="${escapeAttr(t.value)}" ${row.type === t.value ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
      </select>
      <input type="text" data-field="placeholder" placeholder="Placeholder"
             value="${escapeAttr(row.placeholder || '')}" aria-label="Placeholder">
      <input type="text" data-field="helpText" placeholder="Help text (optional)"
             value="${escapeAttr(row.helpText || '')}" aria-label="Help text">
    </div>
    <button type="button" class="btn-icon delete-row-btn" aria-label="Remove" title="Remove">&times;</button>
  `;
  return el;
}

function refreshMetaCounts(card) {
  card.querySelectorAll('.type-meta-section').forEach(section => {
    const n = section.querySelector('.type-meta-rows').children.length;
    section.querySelector('.type-meta-count').textContent = `(${n})`;
  });
}

function renderTierEditor(tier, totalTiers) {
  const editor = document.createElement('div');
  editor.className = 'tier-editor';
  editor.dataset.tierId = tier.id;

  editor.innerHTML = `
    <div class="tier-editor-head">
      <input type="text" data-field="name" value="${escapeAttr(tier.name)}"
             placeholder="Tier name" aria-label="Tier name">
      <button type="button" class="btn-icon delete-tier-btn"
              aria-label="Remove tier" title="Remove tier"
              ${totalTiers <= 2 ? 'disabled' : ''}>&times;</button>
    </div>
    <input type="text" data-field="price" value="${escapeAttr(tier.price)}"
           placeholder="$700" aria-label="Tier price">
    <label class="tier-badge-toggle">
      <input type="checkbox" data-field="badge"
             ${tier.badge === 'Most Popular' ? 'checked' : ''}>
      <span>Mark as &ldquo;Most Popular&rdquo;</span>
    </label>
    <label class="setup-label setup-label-inline">Features (one per line)</label>
    <textarea data-field="features" rows="4"
              placeholder="Single-page site&#10;Mobile-friendly&#10;Contact form">${escapeHtml((tier.features || []).join('\n'))}</textarea>
  `;

  return editor;
}


// ════════════════════════════════════════════════════════════════════════════
//  Per-card event wiring
// ════════════════════════════════════════════════════════════════════════════

function wireCardEvents(card, type) {
  // Delete entire business type
  card.querySelector('.delete-type-btn')?.addEventListener('click', () => {
    const currentName = card.querySelector('[data-field="name"]').value.trim() || type.name;
    if (!confirm(`Delete "${currentName}"? This cannot be undone.`)) return;
    businessTypes = businessTypes.filter(t => t.id !== type.id);
    persist();
    renderTypes();
  });

  // Add a new tier (max 4)
  card.querySelector('.add-tier-btn')?.addEventListener('click', () => {
    const tiersContainer = card.querySelector('.type-tiers');
    const currentCount = tiersContainer.children.length;
    if (currentCount >= 4) return;

    const newTier = {
      id: `tier-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: '',
      price: '',
      badge: null,
      features: [],
    };
    tiersContainer.appendChild(renderTierEditor(newTier, currentCount + 1));
    refreshTierState(card);
    // Focus the new tier's name input
    tiersContainer.lastElementChild.querySelector('[data-field="name"]')?.focus();
  });

  // Delete a tier (event delegation; min 2 tiers)
  card.querySelector('.type-tiers')?.addEventListener('click', (e) => {
    if (!e.target.classList.contains('delete-tier-btn')) return;
    const editor = e.target.closest('.tier-editor');
    const tiersContainer = card.querySelector('.type-tiers');
    if (!editor || !tiersContainer || tiersContainer.children.length <= 2) return;
    editor.remove();
    refreshTierState(card);
  });

  // Enforce single "Most Popular" badge per business type
  card.querySelector('.type-tiers')?.addEventListener('change', (e) => {
    const input = e.target;
    if (input.dataset.field !== 'badge' || !input.checked) return;
    card.querySelectorAll('.tier-editor input[data-field="badge"]').forEach(other => {
      if (other !== input) other.checked = false;
    });
  });

  // Meta-section: + Add row buttons (photo categories, link types, custom fields)
  card.querySelectorAll('.add-row-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.add;
      const rows = card.querySelector(`[data-section="${kind}"] .type-meta-rows`);
      if (!rows) return;
      const row =
        kind === 'photoCategories' ? renderPhotoCategoryRow() :
        kind === 'linkTypes'       ? renderLinkTypeRow()      :
                                     renderCustomFieldRow();
      rows.appendChild(row);
      refreshMetaCounts(card);
      row.querySelector('[data-field="label"]')?.focus();
    });
  });

  // Meta-section: × delete row (event delegation across all three sections)
  card.querySelectorAll('.type-meta-section').forEach(section => {
    section.addEventListener('click', (e) => {
      if (!e.target.classList.contains('delete-row-btn')) return;
      const row = e.target.closest('.meta-row');
      if (!row) return;
      row.remove();
      refreshMetaCounts(card);
    });
  });

  // Save the whole card → re-collect form state, validate, persist
  card.querySelector('.save-type-btn')?.addEventListener('click', () => saveCard(card, type.id));
}

// Updates the add-tier button disabled state, delete-tier disabled states,
// and the count label after add/remove.
function refreshTierState(card) {
  const tiersContainer = card.querySelector('.type-tiers');
  const count = tiersContainer.children.length;
  card.querySelector('.add-tier-btn').disabled = count >= 4;
  card.querySelector('.type-tiers-count').textContent = `(${count})`;
  card.querySelectorAll('.delete-tier-btn').forEach(btn => {
    btn.disabled = count <= 2;
  });
}


// ════════════════════════════════════════════════════════════════════════════
//  Save logic
// ════════════════════════════════════════════════════════════════════════════

function saveCard(card, originalTypeId) {
  const name        = card.querySelector('[data-field="name"]').value.trim();
  const description = card.querySelector('[data-field="description"]').value.trim();
  const note        = card.querySelector('[data-field="note"]').value.trim();
  const siteTypes   = Array.from(card.querySelectorAll('.site-types-row input:checked'))
                           .map(i => i.value);

  const tiers = Array.from(card.querySelectorAll('.tier-editor')).map(ed => ({
    id:       ed.dataset.tierId,
    name:     ed.querySelector('[data-field="name"]').value.trim(),
    price:    ed.querySelector('[data-field="price"]').value.trim(),
    badge:    ed.querySelector('[data-field="badge"]').checked ? 'Most Popular' : null,
    features: ed.querySelector('[data-field="features"]').value
                .split('\n')
                .map(s => s.trim())
                .filter(Boolean),
  }));

  // Meta sections
  const photoCategories = collectMetaRows(card, 'photoCategories', row => ({
    key:      slugifyLabel(row.label),
    label:    row.label,
    helpText: row.helpText,
  }));
  const linkTypes = collectMetaRows(card, 'linkTypes', row => ({
    key:         slugifyLabel(row.label),
    label:       row.label,
    placeholder: row.placeholder,
    kind:        row.kind || 'url',
  }));
  const customFields = collectMetaRows(card, 'customFields', row => ({
    key:         slugifyLabel(row.label),
    label:       row.label,
    type:        row.type || 'text',
    placeholder: row.placeholder,
    helpText:    row.helpText,
  }));

  // Validation
  if (!name) {
    flashStatus(card, 'Business type name is required.', 'error');
    return;
  }
  if (tiers.length < 2 || tiers.length > 4) {
    flashStatus(card, 'Each business type needs 2–4 tiers.', 'error');
    return;
  }
  const missingTierField = tiers.find(t => !t.name || !t.price);
  if (missingTierField) {
    flashStatus(card, 'Each tier needs a name and a price.', 'error');
    return;
  }
  const missingMetaLabel =
    photoCategories.find(r => !r.label) ||
    linkTypes.find(r => !r.label) ||
    customFields.find(r => !r.label);
  if (missingMetaLabel) {
    flashStatus(card, 'Every photo/link/field row needs a label.', 'error');
    return;
  }

  const idx = businessTypes.findIndex(t => t.id === originalTypeId);
  if (idx === -1) {
    flashStatus(card, 'Could not find this business type. Reload.', 'error');
    return;
  }

  businessTypes[idx] = {
    ...businessTypes[idx],
    name, description, note, siteTypes, tiers,
    photoCategories, linkTypes, customFields,
  };
  persist();
  flashStatus(card, '✓ Saved', 'success');
}

// Collect all rows from one meta section. `transform` shapes each row.
// Skips rows where every input is blank (so a freshly-added row that the
// owner then ignored doesn't persist as junk).
function collectMetaRows(card, sectionName, transform) {
  const rows = Array.from(card.querySelectorAll(`[data-section="${sectionName}"] .meta-row`));
  return rows
    .map(row => {
      const raw = {};
      row.querySelectorAll('[data-field]').forEach(input => {
        raw[input.dataset.field] = input.value.trim();
      });
      return raw;
    })
    .filter(raw => Object.values(raw).some(v => v && v.length))
    .map(transform);
}

// Convert a free-text label into a stable JS-friendly key.
// "Highlight video links" → "highlightVideoLinks"
function slugifyLabel(label) {
  return String(label || '')
    .trim()
    .replace(/[^A-Za-z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase())
    .replace(/[^A-Za-z0-9]/g, '');
}

function flashStatus(card, msg, kind) {
  const el = card.querySelector('.type-save-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('error', 'success');
  el.classList.add(kind);
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.textContent = '';
    el.classList.remove('error', 'success');
  }, 2800);
}


// ════════════════════════════════════════════════════════════════════════════
//  Add new business type
// ════════════════════════════════════════════════════════════════════════════

function addNewType() {
  const stamp = Date.now();
  const newType = {
    id: `type-${stamp}-${Math.floor(Math.random() * 1e6)}`,
    name: 'New business type',
    description: '',
    siteTypes: [],
    note: '',
    tiers: [
      { id: `tier-${stamp}-a`, name: 'Starter',  price: '$0',     badge: null,            features: [] },
      { id: `tier-${stamp}-b`, name: 'Standard', price: '$0',     badge: 'Most Popular',  features: [] },
      { id: `tier-${stamp}-c`, name: 'Premium',  price: '$0',     badge: null,            features: [] },
    ],
    photoCategories: [],
    linkTypes: [],
    customFields: [],
  };

  businessTypes.push(newType);
  persist();
  renderTypes();

  // Scroll new card into view and focus its name input
  const newCard = document.querySelector(`[data-type-id="${newType.id}"]`);
  if (!newCard) return;
  newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const nameInput = newCard.querySelector('[data-field="name"]');
  nameInput?.focus();
  nameInput?.select();
}


// ════════════════════════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════════════════════════

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// For attribute values — same as escapeHtml; explicit name keeps intent clear.
function escapeAttr(str) { return escapeHtml(str); }
