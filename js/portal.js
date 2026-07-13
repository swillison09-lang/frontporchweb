/*
  Front Porch Web — Portal Logic
  Auth card (sign-in / sign-up), Supabase authentication, dashboard,
  and 8-step website questionnaire.

  Supabase client is initialized in js/supabase-client.js as `window.sbClient`.
  Submissions land in the `submissions` table — see supabase-schema.sql.
*/


// ── Shared state ───────────────────────────────────────────────────────────

let authMode        = 'signin';   // 'signin' | 'signup'
let currentUser     = null;       // { id, email, name } — set when Supabase resolves a session
let qCurrentStep    = 1;
let qReturnToReview = false;      // true when user jumped here from review "Edit" link
let qSelectedTier   = null;       // chosen payment tier object
let qInitialized    = false;
const Q_TOTAL    = 8;
const Q_REVIEW   = 7;             // review is always step 7; payment is step 8

// Human-readable labels for select-option values
const SITE_TYPE_LABELS = {
  'local-business':     'Local business',
  'adoption-profile':   'Adoption profile',
  'recruiting-profile': 'College sports recruiting',
  'personal-other':     'Personal / other'
};

const VIBE_LABELS = {
  'warm-friendly':  'Warm & friendly',
  'clean-modern':   'Clean & modern',
  'bold-energetic': 'Bold & energetic',
  'elegant-calm':   'Elegant & calm'
};
const qData      = {};         // collects questionnaire answers

const PALETTES = {
  'Front Porch': {
    cream: '#FBF8F3',
    navy: '#2F4A38',
    sage: '#717D68',
    door: '#E9973E'
  },
  'Coastal': {
    white: '#F7FAFC',
    navy: '#21456B',
    sky: '#6DA9C9',
    slate: '#2D3A45'
  },
  'Garden': {
    ivory: '#FAF7F0',
    forest: '#3C5B47',
    gold: '#D9A441',
    bark: '#33291F'
  },
  'Gallery': {
    light: '#F4F4F5',
    charcoal: '#27272A',
    accent: '#E2563B',
    gray: '#71717A'
  },
  'Lighthouse': {
    bg: '#F6F5F2',
    main: '#1B2A4A',
    accent: '#D63B30',
    text: '#222831'
  },
  'Driftwood': {
    bg: '#F0EDE6',
    main: '#2F6E6A',
    accent: '#C97B4A',
    text: '#2E3A38'
  },
  'Rose Garden': {
    bg: '#FBF3EF',
    main: '#C97B86',
    accent: '#C2A0A0',
    text: '#43313A'
  },
  'Lavender Fields': {
    bg: '#F4F1F7',
    main: '#9885B0',
    accent: '#8FA088',
    text: '#352B3D'
  },
  'Wildflower': {
    bg: '#FFFFFF',
    main: '#1FA2E0',
    accent: '#2FBF4E',
    text: '#222431',
    spectrum: ['#F4452F', '#FF8A1E', '#FFD028', '#2FBF4E', '#1FA2E0', '#3A52D6', '#9446D4']
  },
  'Midnight': {
    bg: '#15171C',
    main: '#E8E6E1',
    accent: '#5B8FF0',
    text: '#2B2F38'
  }
};

// Photo upload state
const PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const PHOTO_MAX_SIZE = 10 * 1024 * 1024;  // 10MB per file
const qPhotoFiles = {};  // { fileId: { file: File, caption: string, fileId: string } }
let qPhotoIdCounter = 0;

// Adoption-flow photo buckets — one state object per category
const ADOPT_PHOTO_CATEGORIES = ['homeOutside', 'homeInside', 'neighborhood', 'pets', 'moments'];

// Public base URL for client photos. Set this AFTER enabling public access
// on the R2 bucket (or attaching images.frontporchwebllc.com). Must end with
// a slash. Leave '' until then — prompts fall back to filenames so nothing breaks.
const R2_PUBLIC_BASE = 'https://images.frontporchwebllc.com/';

// Best reference for a photo: real public URL when R2_PUBLIC_BASE is set,
// otherwise the filename (current behavior).
function photoRef(p) {
  if (R2_PUBLIC_BASE && p.key) return R2_PUBLIC_BASE + p.key;
  return p.filename || p.key || '(photo)';
}
const qaPhotoBuckets = ADOPT_PHOTO_CATEGORIES.reduce((acc, key) => {
  acc[key] = {}; // { fileId: { file, caption, objectUrl, fileId } }
  return acc;
}, {});

// Recruiting-flow photo buckets
const RECRUIT_PHOTO_CATEGORIES = ['headshot', 'actionShots', 'teamPhotos'];
const qrPhotoBuckets = RECRUIT_PHOTO_CATEGORIES.reduce((acc, key) => {
  acc[key] = {};
  return acc;
}, {});

// ── Club / travel team terminology by sport ────────────────────────────────
// Edit this object to change how the secondary-team section is labelled
// for each sport. Keys are lowercase substrings matched against the sport
// field value; order matters — first match wins.
const CLUB_TEAM_LABELS = {
  'baseball':    'Travel Team',
  'softball':    'Travel Team',
  'basketball':  'AAU Team',
  'soccer':      'Club Team',
  'volleyball':  'Club Team',
  'lacrosse':    'Club Team',
  'track':       'Club Team',
  'hockey':      'Travel / Club Team',
  'football':    '7-on-7 Team',
};
const CLUB_TEAM_LABEL_DEFAULT = 'Club / Travel Team';

function getClubTeamLabel(sport) {
  if (!sport) return CLUB_TEAM_LABEL_DEFAULT;
  const s = sport.toLowerCase();
  for (const [key, label] of Object.entries(CLUB_TEAM_LABELS)) {
    if (s.includes(key)) return label;
  }
  return CLUB_TEAM_LABEL_DEFAULT;
}

function updateClubTeamLabels() {
  const sport = getVal('qrPrimarySport');
  const label = getClubTeamLabel(sport);
  const sectionTitle = document.getElementById('qrClubSectionTitle');
  const teamNameLabel = document.getElementById('qrClubTeamNameLabel');
  const coachNameLabel = document.getElementById('qrClubCoachNameLabel');
  if (sectionTitle)   sectionTitle.childNodes[0].textContent = label + ' ';
  if (teamNameLabel)  teamNameLabel.textContent = label + ' name';
  if (coachNameLabel) coachNameLabel.textContent = label + ' coach name';
}

// Which questionnaire variant is active based on Step-1 site type.
// Trust qData.siteType when set; fall back to the live select for early
// navigation before Step 1 has been saved.
function getFlowVariant() {
  const t = qData.siteType || getVal('qSiteType');
  if (t === 'adoption-profile')   return 'adopt';
  if (t === 'recruiting-profile') return 'recruit';
  return 'generic';
}
function isAdoptionFlow() { return getFlowVariant() === 'adopt';   }
function isRecruitFlow()  { return getFlowVariant() === 'recruit'; }

// ┌──────────────────────────────────────────────────────────────┐
// │  Owner-managed business types & pricing live in localStorage │
// │  under BUSINESS_TYPES_KEY. The setup page (setup.html / js/  │
// │  setup.js) is the CRUD UI. Step 8 reads them at render time. │
// │                                                              │
// │  PLUG-IN POINT: replace localStorage with Supabase so types  │
// │  sync across devices:                                        │
// │    const { data } = await supabase                           │
// │      .from('business_types').select('*');                    │
// └──────────────────────────────────────────────────────────────┘
const BUSINESS_TYPES_KEY = 'frontporch_business_types';

// Fallback tier sets when localStorage is empty AND no business types
// match the client's site type (e.g. setup.html was never opened). This is
// what nearly every real visitor sees, since setup.html's config only lives
// in the owner's own browser and never syncs anywhere.
//
// One set PER SITE TYPE, because each site type's Stripe Payment Links (see
// STRIPE_PAYMENT_LINKS below) already use different tier names and amounts.
// Every `price` here is exactly 2x the real 50% deposit already configured
// on the matching live link, so the number shown before checkout always
// matches what Stripe actually charges. Tier `name` values match
// STRIPE_PAYMENT_LINKS keys exactly (case-insensitive) so Pay & Submit
// always finds a link — never edit a name here without updating the link map.
const DEFAULT_TIERS_BY_TYPE = {
  'local-business': [
    { id: 'fallback-starter',  name: 'Starter',  price: '$400',   badge: null,
      features: ['Single-page site', 'Mobile-friendly', 'Contact form'] },
    { id: 'fallback-standard', name: 'Standard', price: '$750',   badge: 'Most Popular',
      features: ['Multi-section site', 'Gallery', 'Basic SEO setup'] },
    { id: 'fallback-premium',  name: 'Premium',  price: '$1,200', badge: null,
      features: ['Everything in Standard', 'Blog setup', 'Online enquiry / booking'] },
  ],
  'recruiting-profile': [
    { id: 'fallback-starter',  name: 'Starter',  price: '$250',   badge: null,
      features: ['Single-page recruiting profile', 'Mobile-friendly', 'Contact form'] },
    { id: 'fallback-standard', name: 'Standard', price: '$450',   badge: 'Most Popular',
      features: ['Stats & highlight video section', 'Photo gallery', 'Basic SEO setup'] },
    { id: 'fallback-premium',  name: 'Premium',  price: '$700',   badge: null,
      features: ['Everything in Standard', 'Schedule & recruiting goals', 'Coach contact form'] },
  ],
  'adoption-profile': [
    { id: 'fallback-starter',  name: 'Starter',  price: '$300',   badge: null,
      features: ['Single-page adoption profile', 'Mobile-friendly', 'Letter to birth parents'] },
    { id: 'fallback-standard', name: 'Standard', price: '$500',   badge: 'Most Popular',
      features: ['Full family story & photos', 'Our Journey / blog section', 'Basic SEO setup'] },
    { id: 'fallback-premium',  name: 'Premium',  price: '$750',   badge: null,
      features: ['Everything in Standard', 'Fundraising page integration', 'Priority support'] },
  ],
  'personal-other': [
    { id: 'fallback-starter',  name: 'Starter',  price: '$350',   badge: null,
      features: ['Single-page site', 'Mobile-friendly', 'Contact form'] },
    { id: 'fallback-standard', name: 'Standard', price: '$650',   badge: 'Most Popular',
      features: ['Multi-section site', 'Photo gallery', 'Basic SEO setup'] },
    { id: 'fallback-premium',  name: 'Premium',  price: '$1,000', badge: null,
      features: ['Everything in Standard', 'Blog setup', 'Priority support'] },
  ],
};

// Given a Step-1 site type value, find the matching owner-defined
// business type's tiers. Falls back to the first defined type, then to the
// site-type-specific default set (or local-business's, if the site type
// itself is somehow unrecognized) if no types exist at all.
function getTiersForSiteType(siteType) {
  const fallback = DEFAULT_TIERS_BY_TYPE[siteType] || DEFAULT_TIERS_BY_TYPE['local-business'];
  const types = getLocalStorage(BUSINESS_TYPES_KEY, []);
  if (!Array.isArray(types) || !types.length) return fallback;
  const match = types.find(t =>
    Array.isArray(t.siteTypes) && t.siteTypes.includes(siteType)
  );
  const chosen = match || types[0];
  return (chosen && Array.isArray(chosen.tiers) && chosen.tiers.length)
    ? chosen.tiers
    : fallback;
}

// Owner-only localStorage key for saved build prompts. Used as a LOCAL
// BACKUP only — Supabase `submissions` is the source of truth. The hidden
// owner view at portal.html#admin falls back to this list if Supabase
// is unreachable or RLS blocks the read.
const OWNER_PROMPTS_KEY = 'frontporch_owner_prompts';


// ┌──────────────────────────────────────────────────────────────────────────┐
// │  STRIPE PAYMENT LINKS — 50% deposit per (site type, tier)                │
// │                                                                          │
// │  These are TEST-mode Payment Link URLs. To go live:                      │
// │    1) Recreate the same 12 Payment Links in LIVE mode in the Stripe     │
// │       dashboard, each with the matching deposit amount.                  │
// │    2) Replace every URL below with its live equivalent.                  │
// │    3) Flip STRIPE_TEST_MODE to false.                                    │
// │    4) In each live Payment Link → "After payment" settings, set the     │
// │       success URL to:                                                    │
// │         https://YOUR-DOMAIN/portal.html?fpw=success&sid={CHECKOUT_SESSION_ID}
// │       (the same redirect is already configured for the TEST links).     │
// │                                                                          │
// │  Keys are `{siteType}::{tierNameLowercase}`. Site types are the         │
// │  canonical Step-1 values from SITE_TYPE_LABELS. Tier names are matched  │
// │  case-insensitively against `qSelectedTier.name`, so owner edits to    │
// │  prices/ids in setup.html don't break this map — only renaming a tier  │
// │  does.                                                                   │
// │                                                                          │
// │  TODO (owner, cosmetic only): the site now shows Starter/Standard/     │
// │  Premium for every site type, but the 6 adoption + personal-other      │
// │  Payment Links were originally created in Stripe under their old names │
// │  (Essential/Full/Complete, Simple/Standard/Plus) — that's what a       │
// │  customer briefly sees as the product title on Stripe's own checkout   │
// │  page after clicking Pay. To match everywhere: in the Stripe           │
// │  dashboard → Payment Links, open each of those 6 links → Edit →        │
// │  rename the product/description to Starter, Standard, or Premium to   │
// │  match the deposit amount (see the site-type comments above). This is  │
// │  purely cosmetic — checkout works correctly either way.                 │
// └──────────────────────────────────────────────────────────────────────────┘
const STRIPE_TEST_MODE = false;
const STRIPE_PAYMENT_LINKS = {
  // Local business — Starter $200 / Standard $375 / Premium $600 (50% deposits)
  'local-business::starter':     'https://buy.stripe.com/00w14n09xh1s8Pl4bU4Ni0c',
  'local-business::standard':    'https://buy.stripe.com/4gM8wP3lJ8uW9TpeQy4Ni0d',
  'local-business::premium':     'https://buy.stripe.com/28E4gzcWj4eGghNeQy4Ni0e',
  // Recruiting profile — Starter $125 / Standard $225 / Premium $350
  'recruiting-profile::starter': 'https://buy.stripe.com/cNi3cve0n8uW9Tp5fY4Ni0f',
  'recruiting-profile::standard':'https://buy.stripe.com/eVq8wP9K73aC3v16k24Ni0g',
  'recruiting-profile::premium': 'https://buy.stripe.com/5kQ14n4pN9z01mT4bU4Ni0h',
  // Adoption profile — Starter $150 / Standard $250 / Premium $375
  'adoption-profile::starter':   'https://buy.stripe.com/dRm14n7BZfXod5B7o64Ni0i',
  'adoption-profile::standard':  'https://buy.stripe.com/14A8wP4pN8uWfdJ9we4Ni0j',
  'adoption-profile::premium':   'https://buy.stripe.com/14A9ATf4rfXo5D96k24Ni0k',
  // Personal / other — Starter $175 / Standard $325 / Premium $500
  'personal-other::starter':     'https://buy.stripe.com/4gMfZh9K76mOfdJdMu4Ni0l',
  'personal-other::standard':    'https://buy.stripe.com/5kQ5kD5tR5iK1mTbEm4Ni0m',
  'personal-other::premium':     'https://buy.stripe.com/8x29ATcWjdPgfdJgYG4Ni0n',
};

// Look up the Stripe Payment Link for a given (siteType, tier). Returns
// null when no match — caller must fail safe and never send the client
// to a wrong link.
function getStripeLinkFor(siteType, tier) {
  if (!siteType || !tier?.name) return null;
  const key = `${siteType}::${tier.name.toLowerCase().trim()}`;
  return STRIPE_PAYMENT_LINKS[key] || null;
}

// Parse the dollar total out of a tier price string like "$1,200" → 1200.
// Returns null if the string can't be parsed.
function parseTierTotal(tier) {
  if (!tier?.price) return null;
  const n = parseFloat(String(tier.price).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}


// ── Submission save (R2 photo upload → Supabase row) ───────────────────────

// Gather every File object across all three flows. Each item carries a
// `ref` pointer that tells applyUploadResultsToQData() where to put the
// resulting R2 key in qData.
function collectPhotosForUpload() {
  const items = [];

  Object.entries(qPhotoFiles).forEach(([fileId, { file, caption }]) => {
    items.push({ file, caption, originalId: fileId,
      category: 'photos',
      ref: { kind: 'generic' } });
  });

  ADOPT_PHOTO_CATEGORIES.forEach(cat => {
    Object.entries(qaPhotoBuckets[cat] || {}).forEach(([fileId, { file, caption }]) => {
      items.push({ file, caption, originalId: fileId,
        category: `adopt-${cat}`,
        ref: { kind: 'adopt', bucketCategory: cat } });
    });
  });

  RECRUIT_PHOTO_CATEGORIES.forEach(cat => {
    Object.entries(qrPhotoBuckets[cat] || {}).forEach(([fileId, { file, caption }]) => {
      items.push({ file, caption, originalId: fileId,
        category: `recruit-${cat}`,
        ref: { kind: 'recruit', bucketCategory: cat } });
    });
  });

  return items;
}

// Replace the blob: objectUrl-based snapshots in qData with R2-keyed
// snapshots based on the upload results. `items` and `uploaded` are
// index-aligned (uploadAllPhotos preserves order).
function applyUploadResultsToQData(items, uploaded) {
  const generic = [];
  const adopt   = {};
  const recruit = {};

  uploaded.forEach((u, i) => {
    const ref = items[i].ref;
    const entry = {
      filename: u.filename,
      size:     u.size,
      type:     u.type,
      caption:  u.caption,
      key:      u.key,   // R2 object key — admin renders via the Worker
    };
    if (ref.kind === 'generic') {
      generic.push(entry);
    } else if (ref.kind === 'adopt') {
      (adopt[ref.bucketCategory] = adopt[ref.bucketCategory] || []).push(entry);
    } else if (ref.kind === 'recruit') {
      (recruit[ref.bucketCategory] = recruit[ref.bucketCategory] || []).push(entry);
    }
  });

  qData.photos = generic;

  qData.adopt = qData.adopt || {};
  ADOPT_PHOTO_CATEGORIES.forEach(cat => {
    const photos = adopt[cat] || [];
    if (cat === 'moments') {
      qData.adopt.moments = photos;
    } else {
      const existing = qData.adopt[cat] || {};
      qData.adopt[cat] = { note: existing.note || '', photos };
    }
  });

  qData.recruit = qData.recruit || {};
  RECRUIT_PHOTO_CATEGORIES.forEach(cat => {
    qData.recruit[cat] = recruit[cat] || [];
  });
}

// ── Upload progress overlay (mounted in portal.html as #uploadOverlay) ─────

function uploadOverlayShow() {
  const overlay = document.getElementById('uploadOverlay');
  if (overlay) overlay.classList.remove('hidden');
  uploadOverlayClearError();
  document.body.style.overflow = 'hidden';
}
function uploadOverlayHide() {
  const overlay = document.getElementById('uploadOverlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
}
function uploadOverlaySetProgress({ percent, done, total, currentName }) {
  const fill   = document.getElementById('uploadOverlayBarFill');
  const status = document.getElementById('uploadOverlayStatus');
  const count  = document.getElementById('uploadOverlayCount');
  if (fill)   fill.style.width = `${percent}%`;
  if (status) status.textContent = currentName ? `Uploading ${currentName}…` : 'Finishing up…';
  if (count)  count.textContent  = `${Math.min(done + 1, total)} of ${total}`;
}
function uploadOverlayShowError(message, { onRetry, onCancel }) {
  const errorEl = document.getElementById('uploadOverlayError');
  const actions = document.getElementById('uploadOverlayActions');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
  if (actions) actions.classList.remove('hidden');
  document.getElementById('uploadRetryBtn').onclick  = onRetry;
  document.getElementById('uploadCancelBtn').onclick = onCancel;
}
function uploadOverlayClearError() {
  document.getElementById('uploadOverlayError')?.classList.add('hidden');
  document.getElementById('uploadOverlayActions')?.classList.add('hidden');
}

// Upload the questionnaire's photos to R2 with retry support.
// Resolves on success, rejects only when the user cancels. The overlay
// is left visible by the caller so the success path can replace it with
// the complete panel; on cancel we hide it.
function uploadAllPhotosWithRetry(items, submissionId) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      uploadOverlayClearError();
      uploadOverlaySetProgress({ percent: 0, done: 0, total: items.length, currentName: items[0]?.file?.name || '' });
      try {
        const { uploaded } = await uploadAllPhotos(items, {
          submissionId,
          onProgress: ({ percent, done, total, currentName }) =>
            uploadOverlaySetProgress({ percent, done, total, currentName }),
        });
        resolve(uploaded);
      } catch (err) {
        const idx  = (err.failedAt ?? 0) + 1;
        const name = err.failedName || 'a photo';
        uploadOverlayShowError(
          `${err.message} (stopped on photo ${idx} of ${items.length}: ${name})`,
          {
            onRetry:  () => run(),
            onCancel: () => { uploadOverlayHide(); reject(new Error('Upload cancelled by user.')); },
          }
        );
      }
    };
    run();
  });
}

// Build the row that gets inserted into the `submissions` table. Columns
// match the SQL schema in supabase-schema.sql.
//
// Pricing + Stripe metadata is written by qPaySubmit into qData.payment
// before this is called, so it rides along in the q_data jsonb column
// without needing a schema change. Shape:
//   q_data.payment = {
//     businessType, tier, totalCents, depositCents, currency,
//     stripeLink, testMode, status: 'pending' | 'no_link'
//   }
function buildSubmissionRow({ submissionId, submittedAt, buildPrompt }) {
  return {
    id:           submissionId,           // ties the row to its R2 folder
    user_id:      currentUser?.id,
    user_email:   currentUser?.email   || qData.contactEmail || qData.email || null,
    user_name:    currentUser?.name    || qData.contactName  || qData.name  || null,
    submitted_at: submittedAt,
    site_type:    qData.siteType || null,
    tier:         qData.tier?.name || qData.tier || null,
    build_prompt: buildPrompt,
    q_data:       qData,
    palette:      qData.palette || null,
    photos: {
      generic: qData.photos || [],
      adopt:   qData.adopt   || {},
      recruit: qData.recruit || {},
    },
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  EMAIL NOTIFICATION ON NEW ORDER                                          │
// │  Paste your free Web3Forms access key below to turn this on. Get one at   │
// │  https://web3forms.com  (enter frontporchwebllc@gmail.com, copy the key). │
// │  When empty, notifications are simply skipped — nothing breaks.           │
// │  Only a summary is emailed; the full brief stays in the portal/Supabase.  │
// └──────────────────────────────────────────────────────────────────────────┘
const NOTIFY_ACCESS_KEY = ''; // ← paste your Web3Forms access key here

async function sendOrderNotification({ submissionId, submittedAt, savedToDb }) {
  if (!NOTIFY_ACCESS_KEY) return; // not configured yet — skip quietly
  const name     = currentUser?.name  || qData.contactName  || qData.name  || 'Unknown';
  const email    = currentUser?.email || qData.contactEmail || qData.email || 'not provided';
  const phone    = qData.phone || qData.contactPhone || 'not provided';
  const siteType = SITE_TYPE_LABELS[qData.siteType] || qData.siteType || 'not specified';
  const tier     = qData.payment?.tierName || qData.tier?.name || qData.tier || 'not selected';
  const when     = new Date(submittedAt || Date.now()).toLocaleString();
  const lines = [
    'A new questionnaire was submitted on Front Porch Web.',
    '',
    `Name:       ${name}`,
    `Email:      ${email}`,
    `Phone:      ${phone}`,
    `Site type:  ${siteType}`,
    `Package:    ${tier}`,
    `Submitted:  ${when}`,
    `Reference:  ${submissionId}`,
    savedToDb ? '' : '(Heads up: the database save reported an error — check the local backup.)',
    '',
    'Sign in to the client portal (Owner view) or Supabase to read the full brief.',
  ].filter(l => l !== undefined);
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        access_key: NOTIFY_ACCESS_KEY,
        subject: `New Front Porch order: ${name} — ${siteType}`,
        from_name: 'Front Porch Web',
        replyto: email !== 'not provided' ? email : undefined,
        message: lines.join('\n'),
      }),
    });
  } catch (e) {
    console.warn('Order notification email failed (the order itself was still saved):', e);
  }
}

async function persistSubmission({ submittedAt, buildPrompt, payment }) {
  // Stash payment metadata onto qData so it travels with q_data and the
  // local backup — admin view reads s.q_data.payment.
  if (payment) qData.payment = payment;

  if (!currentUser) {
    // Local-only save so the user doesn't lose work, but no R2 / Supabase.
    const local = getLocalStorage(OWNER_PROMPTS_KEY, []);
    local.push({ ...qData, buildPrompt, submittedAt });
    setLocalStorage(OWNER_PROMPTS_KEY, local);
    return { error: { message: 'Not signed in. Submission saved locally only.' } };
  }

  const submissionId = (crypto.randomUUID?.() || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  // 1) Upload photos to R2 first. If there are none, skip.
  const photoItems = collectPhotosForUpload();
  if (photoItems.length) {
    uploadOverlayShow();
    try {
      const uploaded = await uploadAllPhotosWithRetry(photoItems, submissionId);
      applyUploadResultsToQData(photoItems, uploaded);
    } catch (err) {
      // User cancelled — overlay already hidden. Caller stays on the
      // submit step so they can adjust photos and try again.
      return { cancelled: true };
    }
    uploadOverlayHide();
  }

  // 2) Local backup AFTER photo keys are merged in (so backup has the keys).
  const ownerEntries = getLocalStorage(OWNER_PROMPTS_KEY, []);
  ownerEntries.push({ ...qData, submissionId, buildPrompt, submittedAt });
  setLocalStorage(OWNER_PROMPTS_KEY, ownerEntries);

  // 3) Insert the row into Supabase.
  const row = buildSubmissionRow({ submissionId, submittedAt, buildPrompt });
  const { error } = await sbClient.from('submissions').insert(row);
  if (error) console.error('Supabase submissions insert error:', error);

  // Email the owner a heads-up that a new order came in (no-op until a key is set).
  await sendOrderNotification({ submissionId, submittedAt, savedToDb: !error });

  return { error, submissionId };
}


// ── Bootstrap ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initGoogleButton();
  initEmailForm();
  initAuthToggle();
  initDashboardButtons();
  initSupabaseAuth();          // session check + onAuthStateChange listener
  restoreEmailDraft();
  initAdminView();
  initTempSetupAccess(); // TEMP TESTING — remove before launch
});


// ════════════════════════════════════════════════════════════════════════════
//  AUTH — Supabase session + onAuthStateChange (covers refresh & OAuth return)
// ════════════════════════════════════════════════════════════════════════════

async function initSupabaseAuth() {
  // 1) Check for existing session on page load (covers refresh).
  //    The Supabase client auto-parses any OAuth callback in the URL
  //    (?code=... for PKCE, #access_token=... for implicit) when
  //    detectSessionInUrl: true — see supabase-client.js.
  const { data: { session } } = await sbClient.auth.getSession();
  if (session) handleSignedIn(session.user);

  // After the initial session check, if Stripe just redirected us back
  // from a successful payment, show the post-payment confirmation view.
  // Runs after handleSignedIn so the questionnaire shell is initialized.
  handleStripeReturn();

  // 2) React to all future auth changes: sign-in, sign-out, token
  //    refresh, and the OAuth redirect landing back on this page.
  sbClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      handleSignedIn(session.user);
    } else if (event === 'SIGNED_OUT') {
      handleSignedOut();
    }
  });
}

function handleSignedIn(user) {
  currentUser = {
    id:    user.id,
    email: user.email,
    name:  user.user_metadata?.full_name
        || user.user_metadata?.name
        || (user.email ? user.email.split('@')[0] : 'Friend'),
  };
  showDashboard(currentUser);

  // Clean leftover OAuth params from the URL bar after a successful redirect.
  if (window.location.hash.includes('access_token')
   || window.location.hash.includes('error')
   || window.location.search.includes('code=')) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

function handleSignedOut() {
  currentUser = null;
  hide('portalDashboard');
  hide('questionnaireSection');
  hide('ownerAdminView');
  show('portalStage');
  show('authSection');
}


// ════════════════════════════════════════════════════════════════════════════
//  AUTH — Google OAuth
// ════════════════════════════════════════════════════════════════════════════

function initGoogleButton() {
  document.getElementById('googleBtn')?.addEventListener('click', handleGoogleAuth);
}

async function handleGoogleAuth() {
  const btn = document.getElementById('googleBtn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in…';
  clearAllErrors();

  // Supabase handles the redirect to Google. After Google auth, Supabase
  // sends the browser to `redirectTo`, which lands back on this page
  // with a `?code=...` (PKCE) or `#access_token=...` (implicit) param.
  // initSupabaseAuth() picks it up via onAuthStateChange.
  //
  // The `redirectTo` URL must be in your Supabase Dashboard's allow list:
  // Authentication → URL Configuration → Redirect URLs.
  const { error } = await sbClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/portal.html',
    },
  });

  if (error) {
    showFormError(error.message);
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Continue with Google';
  }
  // On success the browser navigates away to Google — nothing more to do here.
}


// ════════════════════════════════════════════════════════════════════════════
//  AUTH — Email / password form
// ════════════════════════════════════════════════════════════════════════════

function initEmailForm() {
  document.getElementById('emailAuthForm')?.addEventListener('submit', handleEmailAuth);
  document.getElementById('authEmail')?.addEventListener('input', () => {
    setLocalStorage('portal_email_draft', document.getElementById('authEmail').value);
  });
}

async function handleEmailAuth(e) {
  e.preventDefault();
  clearAllErrors();

  const email    = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name     = document.getElementById('authName')?.value.trim();
  const confirm  = document.getElementById('authConfirm')?.value;

  let valid = true;
  if (!validateEmail(email))  { showFieldError('emailError',    'Please enter a valid email address.'); valid = false; }
  if (password.length < 6)    { showFieldError('passwordError', 'Password must be at least 6 characters.'); valid = false; }
  if (authMode === 'signup') {
    if (!name || name.length < 2) { showFieldError('nameError',    'Please enter your full name.'); valid = false; }
    if (password !== confirm)     { showFieldError('confirmError', 'Passwords do not match.'); valid = false; }
  }
  if (!valid) return;

  const submitBtn = document.getElementById('authSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = authMode === 'signup' ? 'Creating account…' : 'Signing in…';
  const restoreBtn = () => {
    submitBtn.disabled = false;
    submitBtn.textContent = authMode === 'signup' ? 'Create Account' : 'Sign In';
  };

  if (authMode === 'signup') {
    const { data, error } = await sbClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) {
      showFormError(error.message);
      restoreBtn();
      return;
    }
    if (!data.session) {
      // Default Supabase setting: email confirmation required.
      // A confirmation email has been sent; the user is not yet logged in.
      // (Owner can disable this in Dashboard → Auth → Sign In/Up → "Confirm email".)
      showFormError('Almost there. Check your email to confirm your account, then sign in.');
      restoreBtn();
      return;
    }
    // If confirmation is OFF, signUp returns a session and
    // onAuthStateChange fires SIGNED_IN → handleSignedIn() runs.
  } else {
    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) {
      showFormError(error.message);
      restoreBtn();
      return;
    }
    // onAuthStateChange fires SIGNED_IN → handleSignedIn() runs.
  }
}


// ════════════════════════════════════════════════════════════════════════════
//  AUTH — Mode toggle (Sign In ↔ Sign Up)
// ════════════════════════════════════════════════════════════════════════════

function initAuthToggle() {
  document.getElementById('authToggleLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthMode();
  });
}

function toggleAuthMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  clearAllErrors();
  const isSignup = authMode === 'signup';

  document.getElementById('authTitle').textContent       = isSignup ? 'Create your account.' : 'Welcome back.';
  document.getElementById('authSub').textContent         = isSignup ? 'Sign up for your Front Porch Web portal.' : 'Sign in to your Front Porch Web portal.';
  document.getElementById('authSubmitBtn').textContent   = isSignup ? 'Create Account' : 'Sign In';
  document.getElementById('authSubmitBtn').disabled      = false;
  document.getElementById('authToggleText').textContent  = isSignup ? 'Already have an account?' : 'Need an account?';
  document.getElementById('authToggleLink').textContent  = isSignup ? 'Sign in' : 'Sign up';

  document.getElementById('nameGroup')?.classList.toggle('hidden', !isSignup);
  document.getElementById('confirmGroup')?.classList.toggle('hidden', !isSignup);
  document.getElementById('authPassword')?.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');

  document.getElementById(isSignup ? 'authName' : 'authEmail')?.focus();
}


// ════════════════════════════════════════════════════════════════════════════
//  AUTH — Email-draft restore (session restore is handled by initSupabaseAuth)
// ════════════════════════════════════════════════════════════════════════════

function restoreEmailDraft() {
  const saved = getLocalStorage('portal_email_draft');
  const field = document.getElementById('authEmail');
  if (saved && field) field.value = saved;
}


// ════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

function showDashboard(user) {
  hide('authSection');
  show('portalDashboard');

  const name = titleCase(user.name || user.email.split('@')[0]);
  const el   = document.getElementById('welcomeName');
  if (el) el.textContent = name;
}

function initDashboardButtons() {
  document.getElementById('startQuestionnaireBtn')?.addEventListener('click', openQuestionnaire);
  document.getElementById('signOutLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    signOut();
  });
}

function openQuestionnaire() {
  hide('portalStage');
  show('questionnaireSection');

  if (!qInitialized) {
    initQuestionnaire();
    qInitialized = true;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToDashboard() {
  hide('questionnaireSection');
  show('portalStage');
  // portalDashboard is still visible inside portalStage
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function signOut() {
  const { error } = await sbClient.auth.signOut();
  if (error) {
    alert(`Sign out failed: ${error.message}`);
    return;
  }
  // handleSignedOut() runs via onAuthStateChange — it hides views & restores
  // the auth card. Reset the button states here so they're fresh next time.
  const googleBtn = document.getElementById('googleBtn');
  if (googleBtn) { googleBtn.disabled = false; googleBtn.querySelector('span').textContent = 'Continue with Google'; }
  const submitBtn = document.getElementById('authSubmitBtn');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = authMode === 'signup' ? 'Create Account' : 'Sign In'; }
}


// ════════════════════════════════════════════════════════════════════════════
//  PHOTO UPLOAD — Drag-and-drop, file handling, preview rendering
// ════════════════════════════════════════════════════════════════════════════

function initPhotoUpload() {
  const fileZone = document.getElementById('qFileZone');
  const fileButton = document.getElementById('qFileButton');
  const photoInput = document.getElementById('qPhotoInput');

  if (!fileZone || !photoInput) return;

  // Drag-and-drop
  fileZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileZone.classList.add('dragover');
  });
  fileZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileZone.classList.remove('dragover');
  });
  fileZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileZone.classList.remove('dragover');
    handlePhotoFiles(e.dataTransfer.files);
  });

  // File button
  fileButton?.addEventListener('click', (e) => {
    e.preventDefault();
    photoInput.click();
  });

  // File input — accumulate, then reset value so re-selecting the
  // same file (or adding more) still fires `change`.
  photoInput.addEventListener('change', () => {
    handlePhotoFiles(photoInput.files);
    photoInput.value = '';
  });
}

function handlePhotoFiles(files) {
  // ┌──────────────────────────────────────────────────────────────┐
  // │  PLUG-IN POINT: Upload files to Supabase Storage here        │
  // │  - Validate file types and sizes                             │
  // │  - Upload to bucket, get signed URLs                         │
  // │  - Return URLs for qData storage                             │
  // └──────────────────────────────────────────────────────────────┘

  // FileList → real array so iteration is unambiguous
  const incoming = Array.from(files || []);

  for (const file of incoming) {
    // Accept any image — match by MIME or by extension fallback (some
    // browsers report '' for screenshots, HEIC, etc.).
    const looksLikeImage =
      (file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|gif|webp|svg|bmp|heic|heif|avif)$/i.test(file.name);

    if (!looksLikeImage) {
      console.warn(`Skipped ${file.name}: not a recognized image (${file.type || 'no MIME'})`);
      continue;
    }
    if (file.size > PHOTO_MAX_SIZE) {
      console.warn(`Skipped ${file.name}: file too large (max 10MB)`);
      continue;
    }

    // ACCUMULATE — never replace; each selection gets its own unique id
    const fileId    = `photo-${qPhotoIdCounter++}`;
    const objectUrl = URL.createObjectURL(file);
    qPhotoFiles[fileId] = { file, caption: '', fileId, objectUrl };
  }

  qRenderPhotoPreview();
}

function qRenderPhotoPreview() {
  const grid = document.getElementById('qPhotoGrid');
  const note = document.getElementById('qPhotoNote');
  if (!grid || !note) return;

  grid.innerHTML = '';
  const count = Object.keys(qPhotoFiles).length;

  // Update count note
  if (count === 0) {
    note.textContent = 'No photos yet. We recommend 3–5.';
  } else if (count === 1) {
    note.textContent = '1 photo. We recommend 3–5 total.';
  } else {
    note.textContent = `${count} photos. ${count < 3 ? 'We recommend 3–5 total.' : 'Looking good!'}`;
  }

  // Render thumbnails — use pre-created object URLs (synchronous, no base64 overhead)
  Object.entries(qPhotoFiles).forEach(([fileId, { caption, objectUrl }]) => {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'photo-thumbnail';
    thumbnail.innerHTML = `
      <div class="photo-thumbnail-img">
        <img src="${objectUrl}" alt="${escapeHtml(qPhotoFiles[fileId].file.name)}">
        <button type="button" class="photo-remove-btn" data-file-id="${fileId}" title="Remove photo">&times;</button>
      </div>
      <input type="text" class="photo-caption" placeholder="e.g., storefront, family" value="${escapeHtml(caption)}" data-file-id="${fileId}">
    `;
    grid.appendChild(thumbnail);

    thumbnail.querySelector('.photo-remove-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      URL.revokeObjectURL(qPhotoFiles[fileId].objectUrl);
      delete qPhotoFiles[fileId];
      qRenderPhotoPreview();
    });

    thumbnail.querySelector('.photo-caption')?.addEventListener('input', (e) => {
      qPhotoFiles[fileId].caption = e.target.value;
    });
  });
}


// ── Adoption photo buckets ─────────────────────────────────────────────────
// Each category (homeOutside, homeInside, neighborhood, pets, moments)
// gets its own zone/input/grid wired up to its own state object in
// qaPhotoBuckets[category].

function initAdoptPhotoBuckets() {
  ADOPT_PHOTO_CATEGORIES.forEach(cat => {
    const zone   = document.getElementById(`qaZone_${cat}`);
    const button = document.getElementById(`qaBtn_${cat}`);
    const input  = document.getElementById(`qaInput_${cat}`);
    if (!zone || !input) return;

    zone.addEventListener('dragover',  e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover'); });
    zone.addEventListener('drop',      e => {
      e.preventDefault(); e.stopPropagation();
      zone.classList.remove('dragover');
      handleAdoptPhotoFiles(cat, e.dataTransfer.files);
    });

    button?.addEventListener('click', e => { e.preventDefault(); input.click(); });

    input.addEventListener('change', () => {
      handleAdoptPhotoFiles(cat, input.files);
      input.value = '';
    });
  });
}

function handleAdoptPhotoFiles(category, files) {
  const bucket   = qaPhotoBuckets[category];
  const incoming = Array.from(files || []);

  for (const file of incoming) {
    const looksLikeImage =
      (file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|gif|webp|svg|bmp|heic|heif|avif)$/i.test(file.name);
    if (!looksLikeImage) continue;
    if (file.size > PHOTO_MAX_SIZE) continue;

    const fileId    = `qa-${category}-${qPhotoIdCounter++}`;
    const objectUrl = URL.createObjectURL(file);
    bucket[fileId]  = { file, caption: '', fileId, objectUrl };
  }
  renderAdoptPhotoPreview(category);
}

function renderAdoptPhotoPreview(category) {
  const bucket = qaPhotoBuckets[category];
  const grid   = document.getElementById(`qaGrid_${category}`);
  const note   = document.getElementById(`qaNote_${category}`);
  if (!grid || !note) return;

  grid.innerHTML = '';
  const count = Object.keys(bucket).length;
  // Friendlier per-bucket note. Moments asks for captions; others are simpler.
  if (count === 0) {
    note.textContent = (category === 'moments')
      ? 'No photos yet. Add a description to each one.'
      : 'No photos yet.';
  } else {
    note.textContent = `${count} photo${count !== 1 ? 's' : ''}.`;
  }

  Object.entries(bucket).forEach(([fileId, { caption, objectUrl, file }]) => {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'photo-thumbnail';
    const placeholder = (category === 'moments') ? 'describe this moment' : 'caption (optional)';
    thumbnail.innerHTML = `
      <div class="photo-thumbnail-img">
        <img src="${objectUrl}" alt="${escapeHtml(file.name)}">
        <button type="button" class="photo-remove-btn" data-file-id="${fileId}" title="Remove photo">&times;</button>
      </div>
      <input type="text" class="photo-caption" placeholder="${placeholder}" value="${escapeHtml(caption)}" data-file-id="${fileId}">
    `;
    grid.appendChild(thumbnail);

    thumbnail.querySelector('.photo-remove-btn')?.addEventListener('click', e => {
      e.preventDefault();
      URL.revokeObjectURL(bucket[fileId].objectUrl);
      delete bucket[fileId];
      renderAdoptPhotoPreview(category);
    });
    thumbnail.querySelector('.photo-caption')?.addEventListener('input', e => {
      bucket[fileId].caption = e.target.value;
    });
  });
}

// Snapshot a bucket as a serializable array (used in qSaveStep + review)
function snapshotBucket(category) {
  return Object.values(qaPhotoBuckets[category]).map(({ file, caption, objectUrl }) => ({
    filename: file.name,
    size: file.size,
    type: file.type,
    caption,
    objectUrl,
  }));
}


// ── Recruiting photo buckets ───────────────────────────────────────────────
// Same pattern as adoption, but keyed off qrPhotoBuckets and qr* element IDs.

function initRecruitPhotoBuckets() {
  RECRUIT_PHOTO_CATEGORIES.forEach(cat => {
    const zone   = document.getElementById(`qrZone_${cat}`);
    const button = document.getElementById(`qrBtn_${cat}`);
    const input  = document.getElementById(`qrInput_${cat}`);
    if (!zone || !input) return;

    zone.addEventListener('dragover',  e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover'); });
    zone.addEventListener('drop',      e => {
      e.preventDefault(); e.stopPropagation();
      zone.classList.remove('dragover');
      handleRecruitPhotoFiles(cat, e.dataTransfer.files);
    });

    button?.addEventListener('click', e => { e.preventDefault(); input.click(); });

    input.addEventListener('change', () => {
      handleRecruitPhotoFiles(cat, input.files);
      input.value = '';
    });
  });
}

function handleRecruitPhotoFiles(category, files) {
  const bucket   = qrPhotoBuckets[category];
  const incoming = Array.from(files || []);

  for (const file of incoming) {
    const looksLikeImage =
      (file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|gif|webp|svg|bmp|heic|heif|avif)$/i.test(file.name);
    if (!looksLikeImage) continue;
    if (file.size > PHOTO_MAX_SIZE) continue;

    const fileId    = `qr-${category}-${qPhotoIdCounter++}`;
    const objectUrl = URL.createObjectURL(file);
    bucket[fileId]  = { file, caption: '', fileId, objectUrl };
  }
  renderRecruitPhotoPreview(category);
}

function renderRecruitPhotoPreview(category) {
  const bucket = qrPhotoBuckets[category];
  const grid   = document.getElementById(`qrGrid_${category}`);
  const note   = document.getElementById(`qrNote_${category}`);
  if (!grid || !note) return;

  grid.innerHTML = '';
  const count = Object.keys(bucket).length;
  note.textContent = count === 0 ? 'No photos yet.' : `${count} photo${count !== 1 ? 's' : ''}.`;

  Object.entries(bucket).forEach(([fileId, { caption, objectUrl, file }]) => {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'photo-thumbnail';
    thumbnail.innerHTML = `
      <div class="photo-thumbnail-img">
        <img src="${objectUrl}" alt="${escapeHtml(file.name)}">
        <button type="button" class="photo-remove-btn" data-file-id="${fileId}" title="Remove photo">&times;</button>
      </div>
      <input type="text" class="photo-caption" placeholder="caption (optional)" value="${escapeHtml(caption)}" data-file-id="${fileId}">
    `;
    grid.appendChild(thumbnail);

    thumbnail.querySelector('.photo-remove-btn')?.addEventListener('click', e => {
      e.preventDefault();
      URL.revokeObjectURL(bucket[fileId].objectUrl);
      delete bucket[fileId];
      renderRecruitPhotoPreview(category);
    });
    thumbnail.querySelector('.photo-caption')?.addEventListener('input', e => {
      bucket[fileId].caption = e.target.value;
    });
  });
}

function snapshotRecruitBucket(category) {
  return Object.values(qrPhotoBuckets[category]).map(({ file, caption, objectUrl }) => ({
    filename: file.name,
    size: file.size,
    type: file.type,
    caption,
    objectUrl,
  }));
}

// Collect the 5 structured measurable rows (40-yd dash, vertical, etc.).
// Only rows with both a measurement name and a result are kept.
function collectRecruitMeasurables() {
  const out = [];
  for (let i = 0; i < 5; i++) {
    const name   = (document.getElementById(`qrMeas${i}_name`)?.value   || '').trim();
    const value  = (document.getElementById(`qrMeas${i}_value`)?.value  || '').trim();
    const status = (document.getElementById(`qrMeas${i}_status`)?.value || '').trim();
    const source = (document.getElementById(`qrMeas${i}_source`)?.value || '').trim();
    if (!name || !value) continue;
    out.push({ name, value, status, source });
  }
  return out;
}

// Collect the 3 character-reference rows. Only rows with at least a name are kept.
function collectRecruitReferences() {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const name  = (document.getElementById(`qrRef${i}_name`)?.value  || '').trim();
    const role  = (document.getElementById(`qrRef${i}_role`)?.value  || '').trim();
    const email = (document.getElementById(`qrRef${i}_email`)?.value || '').trim();
    const phone = (document.getElementById(`qrRef${i}_phone`)?.value || '').trim();
    if (!name) continue;
    out.push({ name, role, email, phone });
  }
  return out;
}

// Show/hide variant-scoped blocks based on site type. Called from qShowStep
// so the right variant is visible whenever a panel is entered (after Step 1
// has been saved or even if the user just changed the site-type select).
function applyFlowVariant() {
  const v = getFlowVariant();
  document.querySelectorAll('.q-flow-generic').forEach(el => el.classList.toggle('hidden', v !== 'generic'));
  document.querySelectorAll('.q-flow-adopt').forEach(el => el.classList.toggle('hidden', v !== 'adopt'));
  document.querySelectorAll('.q-flow-recruit').forEach(el => el.classList.toggle('hidden', v !== 'recruit'));
  // Blocks shared by generic + adopt but NOT recruit (the Step 6 single uploader).
  document.querySelectorAll('.q-flow-not-recruit').forEach(el => el.classList.toggle('hidden', v === 'recruit'));
  updateClubTeamLabels();
}


// ════════════════════════════════════════════════════════════════════════════
//  REVIEW — Summary rendering + Build Prompt generation
// ════════════════════════════════════════════════════════════════════════════

function qRenderReview() {
  // Client-facing review: ONLY the friendly summary of their answers.
  // The "Website Build Prompt" is owner-only — generated on submit
  // and saved under the owner localStorage key (see qSubmit() below).
  const summaryEl = document.getElementById('qReviewSummary');
  if (!summaryEl) return;
  summaryEl.innerHTML = qBuildSummaryHTML();
  summaryEl.querySelectorAll('.review-edit-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const step = parseInt(link.dataset.step, 10);
      qReturnToReview = true;
      qCurrentStep    = step;
      qShowStep(step, 'back');
    });
  });
}

// Returns a mismatch descriptor if the selected tier's page cap is exceeded,
// or null if there is no problem.
function qGetPageMismatch() {
  if (!qSelectedTier) return null;
  // Adoption + recruiting profiles use fixed structures, not user-selected
  // pages — skip the cap check there.
  if (isAdoptionFlow() || isRecruitFlow()) return null;
  const limit     = getTierPageLimit(qSelectedTier);
  const pageCount = (qData.pages || []).length;
  if (limit !== null && pageCount > limit) {
    return { tierName: qSelectedTier.name, limit, count: pageCount, excess: pageCount - limit };
  }
  return null;
}

function qBuildSummaryHTML() {
  const siteTypeLabel = SITE_TYPE_LABELS[qData.siteType] || qData.siteType || '—';
  const vibeLabel     = VIBE_LABELS[qData.vibe]          || qData.vibe     || '—';
  const pagesChips    = (qData.pages && qData.pages.length)
    ? qData.pages.map(p => `<span class="review-chip">${escapeHtml(p)}</span>`).join('')
    : '—';
  const isAdopt   = qData.siteType === 'adoption-profile';
  const isRecruit = qData.siteType === 'recruiting-profile';
  const ad        = qData.adopt   || {};
  const rc        = qData.recruit || {};
  const out       = [];

  // Mismatch warning — only shown when a tier is already known (return-to-review flow)
  const mismatch = qGetPageMismatch();
  if (mismatch) {
    const pg  = n => `${n} page${n !== 1 ? 's' : ''}`;
    out.push(
      `<div class="q-tier-mismatch" role="alert">` +
        `<strong>Package mismatch:</strong> Your ` +
        `<strong>${escapeHtml(mismatch.tierName)}</strong> package includes up to ` +
        `<strong>${pg(mismatch.limit)}</strong>, but you have selected ` +
        `<strong>${pg(mismatch.count)}</strong>. ` +
        `Please <a href="#" class="review-edit-link" data-step="3">remove ${pg(mismatch.excess)}</a>` +
        ` or <a href="#" class="review-edit-link" data-step="8">choose a larger package</a>.` +
      `</div>`
    );
  }

  // About
  out.push('<div class="review-section"><div class="review-section-head"><h3>About</h3><a href="#" class="review-edit-link" data-step="1">Edit</a></div><dl class="review-dl">');
  out.push(`<dt>Name</dt><dd>${escapeHtml(qData.name || '—')}</dd>`);
  out.push(`<dt>Site type</dt><dd>${escapeHtml(siteTypeLabel)}</dd>`);
  if (isAdopt && ad.city)   out.push(`<dt>Location</dt><dd>${escapeHtml(ad.city)}</dd>`);
  if (isRecruit && rc.city) out.push(`<dt>Location</dt><dd>${escapeHtml(rc.city)}</dd>`);
  out.push(`<dt>Email</dt><dd>${escapeHtml(qData.email || '—')}</dd>`);
  if (qData.phone) out.push(`<dt>Phone</dt><dd>${escapeHtml(qData.phone)}</dd>`);
  out.push('</dl></div>');

  if (isAdopt) {
    // Adoption — Family (letter + parents)
    if (ad.letter || (ad.parent1 && (ad.parent1.name || ad.parent1.facts)) || (ad.parent2 && (ad.parent2.name || ad.parent2.facts))) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Your Family</h3><a href="#" class="review-edit-link" data-step="2">Edit</a></div>');
      if (ad.letter) {
        out.push('<p class="review-subheading">Letter to birth parents</p>');
        out.push(`<blockquote class="review-letter">${escapeHtml(ad.letter)}</blockquote>`);
      }
      out.push('<dl class="review-dl">');
      if (ad.parent1 && (ad.parent1.name || ad.parent1.facts)) {
        out.push(`<dt>Parent 1</dt><dd>${escapeHtml(ad.parent1.name || '—')}${ad.parent1.facts ? `<div class="review-multiline">${escapeHtml(ad.parent1.facts)}</div>` : ''}</dd>`);
      }
      if (ad.parent2 && (ad.parent2.name || ad.parent2.facts)) {
        out.push(`<dt>Parent 2</dt><dd>${escapeHtml(ad.parent2.name || '—')}${ad.parent2.facts ? `<div class="review-multiline">${escapeHtml(ad.parent2.facts)}</div>` : ''}</dd>`);
      }
      out.push('</dl></div>');
    }

    // Adoption — Home & Pets
    const homeSections = ['homeOutside', 'homeInside', 'neighborhood', 'pets']
      .map(k => ({ key: k, data: ad[k] }))
      .filter(s => s.data && ((s.data.photos && s.data.photos.length) || s.data.note));
    if (homeSections.length) {
      const labels = { homeOutside: 'Outside of home', homeInside: 'Nursery / inside', neighborhood: 'Neighborhood', pets: 'Pets' };
      out.push('<div class="review-section"><div class="review-section-head"><h3>Home &amp; Pets</h3><a href="#" class="review-edit-link" data-step="3">Edit</a></div><dl class="review-dl">');
      homeSections.forEach(({ key, data }) => {
        const photoCount = (data.photos || []).length;
        const photoStr   = photoCount ? `${photoCount} photo${photoCount !== 1 ? 's' : ''}` : 'no photos';
        out.push(`<dt>${escapeHtml(labels[key])}</dt><dd>${escapeHtml(photoStr)}${data.note ? `<div class="review-multiline">${escapeHtml(data.note)}</div>` : ''}</dd>`);
      });
      out.push('</dl></div>');
    }

    // Adoption — Everyday & Logistics
    const fund = ad.fundraising || {};
    if ((ad.moments && ad.moments.length) || ad.agency || ad.caseworker || fund.url || ad.contactEmail || ad.contactPhone || ad.anythingElse) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Everyday &amp; Logistics</h3><a href="#" class="review-edit-link" data-step="4">Edit</a></div><dl class="review-dl">');
      if (ad.moments && ad.moments.length) {
        out.push(`<dt>Everyday moments</dt><dd>${ad.moments.length} photo${ad.moments.length !== 1 ? 's' : ''}</dd>`);
      }
      if (ad.agency)       out.push(`<dt>Agency</dt><dd>${escapeHtml(ad.agency)}</dd>`);
      if (ad.caseworker)   out.push(`<dt>Caseworker</dt><dd>${escapeHtml(ad.caseworker)}</dd>`);
      if (fund.url)        out.push(`<dt>Fundraising</dt><dd>${escapeHtml(fund.platform || 'link')}: ${escapeHtml(fund.url)}<div class="review-help-note">Click tracking enabled on the built site.</div></dd>`);
      if (ad.contactEmail) out.push(`<dt>Adoption email</dt><dd>${escapeHtml(ad.contactEmail)}</dd>`);
      if (ad.contactPhone) out.push(`<dt>Adoption phone</dt><dd>${escapeHtml(ad.contactPhone)}</dd>`);
      if (ad.anythingElse) out.push(`<dt>Anything else</dt><dd class="review-multiline">${escapeHtml(ad.anythingElse)}</dd>`);
      out.push('</dl></div>');
    }
  } else if (isRecruit) {
    // Recruiting — Coach-facing basics
    const basicsItems = [
      ['Graduation year',       rc.gradYear],
      ['Sport',                 rc.primarySport],
      ['Primary position(s)',   rc.primaryPositions],
      ['Secondary position(s)', rc.secondaryPositions],
      ['High school',           rc.highSchool],
      ['City',                  rc.city],
      ['Height',                rc.height],
      ['Weight',                rc.weight],
    ].filter(([_, v]) => v);
    if (basicsItems.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Athlete Basics</h3><a href="#" class="review-edit-link" data-step="2">Edit</a></div><dl class="review-dl">');
      basicsItems.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`));
      out.push('</dl></div>');
    }

    // Recruiting — NCAA Eligibility Center
    const NCAA_STATUS_LABELS = {
      'registered':  'Registered (has ID)',
      'in-progress': 'Account started',
      'not-yet':     'Not yet registered',
      'unsure':      'Not sure',
    };
    const ncaaItems = [
      ['Registration status', NCAA_STATUS_LABELS[rc.ncaaIdStatus] || rc.ncaaIdStatus],
      ['NCAA Eligibility ID', rc.ncaaId],
    ].filter(([_, v]) => v);
    if (ncaaItems.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>NCAA Eligibility Center</h3><a href="#" class="review-edit-link" data-step="2">Edit</a></div>');
      out.push('<p class="review-subheading">Athlete-provided input only. NCAA rules change; verify at eligibilitycenter.org.</p>');
      out.push('<dl class="review-dl">');
      ncaaItems.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`));
      out.push('</dl></div>');
    }

    // Recruiting — Academics
    const TRANSCRIPT_LABELS = {
      'yes':         'Yes, available',
      'in-progress': 'In progress',
      'not-yet':     'Not yet',
    };
    const acadItems = [
      ['Overall GPA',         rc.gpa],
      ['Core-course GPA',     rc.coreGpa],
      ['SAT',                 rc.satScore],
      ['ACT',                 rc.actScore],
      ['Official transcript', TRANSCRIPT_LABELS[rc.transcriptStatus] || rc.transcriptStatus],
      ['Intended major',      rc.intendedMajor],
      ['Academic honors',     rc.academicHonors],
    ].filter(([_, v]) => v);
    if (acadItems.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Academics</h3><a href="#" class="review-edit-link" data-step="2">Edit</a></div><dl class="review-dl">');
      acadItems.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd class="review-multiline">${escapeHtml(v)}</dd>`));
      out.push('</dl></div>');
    }

    // Recruiting — Optional / minor detail
    const optItems = [
      ['Class rank',    rc.classRank],
      ['Jersey #',      rc.jerseyNumber],
    ].filter(([_, v]) => v);
    if (optItems.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Optional Detail</h3><a href="#" class="review-edit-link" data-step="2">Edit</a></div><dl class="review-dl">');
      optItems.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`));
      out.push('</dl></div>');
    }

    // Recruiting — Performance
    const perfItems = [
      ['Key stats',            rc.keyStats],
      ['Awards',               rc.awards],
      ['Years on varsity',     rc.varsityYears],
      ['Team accomplishments', rc.teamAccomplishments],
    ].filter(([_, v]) => v);
    if (perfItems.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Performance</h3><a href="#" class="review-edit-link" data-step="3">Edit</a></div><dl class="review-dl">');
      perfItems.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd class="review-multiline">${escapeHtml(v)}</dd>`));
      out.push('</dl></div>');
    }

    // Recruiting — Structured measurables (verified / self-reported)
    const measurables = Array.isArray(rc.measurables) ? rc.measurables : [];
    if (measurables.length || rc.combineNotes) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Measurables</h3><a href="#" class="review-edit-link" data-step="3">Edit</a></div>');
      if (measurables.length) {
        out.push('<table class="review-meas-table"><thead><tr><th>Measurement</th><th>Result</th><th>Status</th><th>Verified by / where</th></tr></thead><tbody>');
        measurables.forEach(m => {
          const statusLabel = m.status === 'verified' ? 'Verified'
                             : m.status === 'self'     ? 'Self-reported'
                             : '—';
          const statusClass = m.status === 'verified' ? 'review-meas-verified'
                             : m.status === 'self'     ? 'review-meas-self'
                             : '';
          out.push(
            `<tr>` +
              `<td>${escapeHtml(m.name)}</td>` +
              `<td>${escapeHtml(m.value)}</td>` +
              `<td class="${statusClass}">${escapeHtml(statusLabel)}</td>` +
              `<td>${escapeHtml(m.source || '')}</td>` +
            `</tr>`
          );
        });
        out.push('</tbody></table>');
      }
      if (rc.combineNotes) {
        out.push('<dl class="review-dl">');
        out.push(`<dt>Other notes</dt><dd class="review-multiline">${escapeHtml(rc.combineNotes)}</dd>`);
        out.push('</dl>');
      }
      out.push('</div>');
    }

    // Recruiting — Upcoming schedule (NEW — where coaches can see in person)
    if (rc.upcomingSchedule) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Upcoming Schedule</h3><a href="#" class="review-edit-link" data-step="3">Edit</a></div>');
      out.push('<p class="review-subheading">Where a coach could watch in person.</p>');
      out.push(`<div class="review-multiline">${escapeHtml(rc.upcomingSchedule)}</div>`);
      out.push('</div>');
    }

    // Recruiting — Recruiting goals
    const goalsItems = [
      ['Divisions of interest', rc.divisionsInterest],
      ['Schools of interest',   rc.schoolsInterest],
      ['Camps / showcases',     rc.campsAttended],
    ].filter(([_, v]) => v);
    if (goalsItems.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Recruiting Goals</h3><a href="#" class="review-edit-link" data-step="3">Edit</a></div><dl class="review-dl">');
      goalsItems.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd class="review-multiline">${escapeHtml(v)}</dd>`));
      out.push('</dl></div>');
    }

    // Recruiting — Coaches, film, social, contact, statement
    const hsc = rc.hsHeadCoach || {};
    const club = rc.clubTeam   || {};
    const social = rc.social   || {};
    const contact = rc.contact || {};
    const coachItems = [
      ['HS head coach',    [hsc.name, hsc.email, hsc.phone].filter(Boolean).join(' · ')],
      [getClubTeamLabel(rc.primarySport), club.name],
      [getClubTeamLabel(rc.primarySport) + ' coach', [club.coachName, club.coachEmail, club.coachPhone].filter(Boolean).join(' · ')],
      ['Additional refs',  rc.additionalReferences],
    ].filter(([_, v]) => v);
    if (coachItems.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Teams &amp; Coaches</h3><a href="#" class="review-edit-link" data-step="4">Edit</a></div><dl class="review-dl">');
      coachItems.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd class="review-multiline">${escapeHtml(v)}</dd>`));
      out.push('</dl></div>');
    }
    if (rc.primaryHighlightVideo || (rc.highlightVideos || []).length || (rc.gameFilm || []).length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Highlight Media</h3><a href="#" class="review-edit-link" data-step="4">Edit</a></div><dl class="review-dl">');
      if (rc.primaryHighlightVideo) {
        out.push(`<dt class="review-meas-verified">Primary highlight</dt><dd><span class="review-primary-tag">embed above the fold</span><div class="review-multiline">${escapeHtml(rc.primaryHighlightVideo)}</div></dd>`);
      }
      if ((rc.highlightVideos || []).length) {
        out.push(`<dt>Additional highlights</dt><dd>${rc.highlightVideos.length} link${rc.highlightVideos.length !== 1 ? 's' : ''}<div class="review-multiline">${escapeHtml(rc.highlightVideos.join('\n'))}</div></dd>`);
      }
      if ((rc.gameFilm || []).length) {
        out.push(`<dt>Game film</dt><dd>${rc.gameFilm.length} link${rc.gameFilm.length !== 1 ? 's' : ''}<div class="review-multiline">${escapeHtml(rc.gameFilm.join('\n'))}</div></dd>`);
      }
      out.push('</dl></div>');
    }

    // Recruiting — Character references (non-coach)
    const refs = Array.isArray(rc.characterReferences) ? rc.characterReferences : [];
    if (refs.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Character References</h3><a href="#" class="review-edit-link" data-step="4">Edit</a></div>');
      out.push('<p class="review-subheading">Beyond coaches: trainers, teachers, mentors.</p>');
      out.push('<table class="review-meas-table"><thead><tr><th>Name</th><th>Role / relationship</th><th>Email</th><th>Phone</th></tr></thead><tbody>');
      refs.forEach(r => {
        out.push(
          `<tr>` +
            `<td>${escapeHtml(r.name)}</td>` +
            `<td>${escapeHtml(r.role || '')}</td>` +
            `<td>${escapeHtml(r.email || '')}</td>` +
            `<td>${escapeHtml(r.phone || '')}</td>` +
          `</tr>`
        );
      });
      out.push('</tbody></table></div>');
    }
    const socialItems = [
      ['Instagram', social.instagram],
      ['X / Twitter', social.twitter],
      ['TikTok',    social.tiktok],
      ['YouTube',   social.youtube],
      ['Hudl',      social.hudl],
      ['Other',     social.otherSocial],
    ].filter(([_, v]) => v);
    if (socialItems.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Social Presence</h3><a href="#" class="review-edit-link" data-step="4">Edit</a></div><dl class="review-dl">');
      socialItems.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`));
      out.push('</dl></div>');
    }
    const contactItems = [
      ['Athlete email', contact.athleteEmail],
      ['Athlete phone', contact.athletePhone],
      ['Parent name',   contact.parentName],
      ['Parent email',  contact.parentEmail],
      ['Parent phone',  contact.parentPhone],
    ].filter(([_, v]) => v);
    if (contactItems.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Contact</h3><a href="#" class="review-edit-link" data-step="4">Edit</a></div><dl class="review-dl">');
      contactItems.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`));
      out.push('</dl></div>');
    }
    if (rc.athleteStatement) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Athlete Statement</h3><a href="#" class="review-edit-link" data-step="4">Edit</a></div>');
      out.push('<p class="review-subheading">In the athlete\'s own words (verbatim on site)</p>');
      out.push(`<blockquote class="review-letter">${escapeHtml(rc.athleteStatement)}</blockquote>`);
      out.push('</div>');
    }

    // Recruiting — categorized photo counts
    const photoCats = [
      { key: 'headshot',    label: 'Headshot' },
      { key: 'actionShots', label: 'Action shots' },
      { key: 'teamPhotos',  label: 'Team photos' },
    ].filter(c => (rc[c.key] || []).length);
    if (photoCats.length) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Photos</h3><a href="#" class="review-edit-link" data-step="6">Edit</a></div><dl class="review-dl">');
      photoCats.forEach(c => {
        const n = rc[c.key].length;
        out.push(`<dt>${escapeHtml(c.label)}</dt><dd>${n} photo${n !== 1 ? 's' : ''}</dd>`);
      });
      out.push('</dl></div>');
    }
  } else {
    // Generic — Your Story
    if (qData.tagline || qData.facts || qData.services || qData.feeling) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Your Story</h3><a href="#" class="review-edit-link" data-step="2">Edit</a></div><dl class="review-dl">');
      if (qData.tagline)  out.push(`<dt>Tagline</dt><dd>${escapeHtml(qData.tagline)}</dd>`);
      if (qData.facts)    out.push(`<dt>Key facts</dt><dd class="review-multiline">${escapeHtml(qData.facts)}</dd>`);
      if (qData.services) out.push(`<dt>Services</dt><dd class="review-multiline">${escapeHtml(qData.services)}</dd>`);
      if (qData.feeling)  out.push(`<dt>Feeling / message</dt><dd class="review-multiline">${escapeHtml(qData.feeling)}</dd>`);
      out.push('</dl></div>');
    }

    // Generic — Style & Pages
    out.push('<div class="review-section"><div class="review-section-head"><h3>Style &amp; Pages</h3><a href="#" class="review-edit-link" data-step="3">Edit</a></div><dl class="review-dl">');
    out.push(`<dt>Pages</dt><dd class="review-chips">${pagesChips}</dd>`);
    if (qData.vibe)      out.push(`<dt>Vibe</dt><dd>${escapeHtml(vibeLabel)}</dd>`);
    if (qData.mustHaves) out.push(`<dt>Must-haves / avoid</dt><dd class="review-multiline">${escapeHtml(qData.mustHaves)}</dd>`);
    out.push('</dl></div>');

    // Generic — Links
    if (qData.website || qData.facebook || qData.instagram || qData.otherLinks) {
      out.push('<div class="review-section"><div class="review-section-head"><h3>Links</h3><a href="#" class="review-edit-link" data-step="4">Edit</a></div><dl class="review-dl">');
      if (qData.website)    out.push(`<dt>Website</dt><dd>${escapeHtml(qData.website)}</dd>`);
      if (qData.facebook)   out.push(`<dt>Facebook</dt><dd>${escapeHtml(qData.facebook)}</dd>`);
      if (qData.instagram)  out.push(`<dt>Instagram</dt><dd>${escapeHtml(qData.instagram)}</dd>`);
      if (qData.otherLinks) out.push(`<dt>Other</dt><dd class="review-multiline">${escapeHtml(qData.otherLinks)}</dd>`);
      out.push('</dl></div>');
    }
  }

  // Colors
  if (qData.paletteChoice && qData.paletteColors) {
    out.push('<div class="review-section"><div class="review-section-head"><h3>Color Palette</h3><a href="#" class="review-edit-link" data-step="5">Edit</a></div>');
    out.push(`<p class="review-palette-name">${escapeHtml(qData.paletteChoice)}</p>`);
    out.push('<div class="review-swatches">');
    for (const [name, hex] of Object.entries(qData.paletteColors)) {
      if (name === 'spectrum') continue; // array value, not a swatch
      out.push(
        `<div class="review-swatch">` +
          `<div class="review-swatch-color" style="background-color: ${escapeHtml(hex)}"></div>` +
          `<span class="review-swatch-name">${escapeHtml(name)}</span>` +
          `<span class="review-swatch-hex">${escapeHtml(hex)}</span>` +
        `</div>`
      );
    }
    out.push('</div></div>');
  }

  // Photos
  if (qData.photos && qData.photos.length) {
    out.push('<div class="review-section"><div class="review-section-head"><h3>Photos</h3><a href="#" class="review-edit-link" data-step="6">Edit</a></div>');
    out.push('<div class="review-photo-grid">');
    qData.photos.forEach(p => {
      out.push('<div class="review-photo-card">');
      if (p.objectUrl) {
        out.push(`<img class="review-photo-thumb" src="${p.objectUrl}" alt="${escapeHtml(p.filename)}">`);
      }
      if (p.caption) {
        out.push(`<p class="review-photo-caption-text">&ldquo;${escapeHtml(p.caption)}&rdquo;</p>`);
      }
      out.push(`<p class="review-photo-filename">${escapeHtml(p.filename)}</p>`);
      out.push('</div>');
    });
    out.push('</div></div>');
  }

  return out.join('');
}

function qGenerateBuildPrompt() {
  const lines = [];
  const name          = qData.name || '(name not provided)';
  const siteTypeLabel = SITE_TYPE_LABELS[qData.siteType] || qData.siteType || 'website';
  const vibeLabel     = VIBE_LABELS[qData.vibe]          || qData.vibe     || 'warm and natural';
  const isAdopt       = qData.siteType === 'adoption-profile';
  const isRecruit     = qData.siteType === 'recruiting-profile';
  const ad            = qData.adopt   || {};
  const rc            = qData.recruit || {};

  lines.push(`WEBSITE BUILD PROMPT — ${name}`);
  lines.push('');
  if (qData.tier) {
    const tierRaw  = parseFloat((qData.tier.price || '').replace(/[^0-9.]/g, ''));
    const tierHalf = Number.isFinite(tierRaw) ? Math.round(tierRaw / 2) : null;
    const tierSplit = tierHalf !== null
      ? ` | 50/50 terms: $${tierHalf} due now (upfront), $${tierHalf} due on completion and client approval`
      : '';
    lines.push(`PACKAGE: ${qData.tier.name} — ${qData.tier.price} total${tierSplit}`);
    lines.push('');
  }
  lines.push(`Build a ${siteTypeLabel.toLowerCase()} website for ${name}.`);
  if (isAdopt && ad.city)    lines.push(`Family location: ${ad.city}`);
  if (isRecruit && rc.city)  lines.push(`Athlete location: ${rc.city}`);
  lines.push('');
  if (R2_PUBLIC_BASE) {
    lines.push('NOTE ON PHOTOS: photo entries below are REAL public image URLs.');
    lines.push('Use them directly as <img src="..."> in the matching sections of the site,');
    lines.push('honoring any caption as alt text / placement hint. Do not invent placeholders.');
    lines.push('');
  }

  // ── Client notes verbatim ──
  lines.push('═══════════════════════════════════════');
  lines.push("CLIENT'S NOTES (raw, unedited)");
  lines.push('═══════════════════════════════════════');
  lines.push('');

  if (isAdopt) {
    // Letter is written by the client and must be passed through verbatim.
    if (ad.letter) {
      lines.push('┌─────────────────────────────────────────────────────────┐');
      lines.push('│  LETTER TO BIRTH PARENTS — VERBATIM, DO NOT REWRITE     │');
      lines.push('│  This is the client\'s own words. Display exactly as is. │');
      lines.push('└─────────────────────────────────────────────────────────┘');
      lines.push(ad.letter);
      lines.push('');
    }

    if (ad.parent1 && (ad.parent1.name || ad.parent1.facts)) {
      lines.push(`Adoptive Parent 1 — ${ad.parent1.name || '(name not provided)'}:`);
      if (ad.parent1.facts) lines.push(ad.parent1.facts);
      lines.push('');
    }
    if (ad.parent2 && (ad.parent2.name || ad.parent2.facts)) {
      lines.push(`Adoptive Parent 2 — ${ad.parent2.name || '(name not provided)'}:`);
      if (ad.parent2.facts) lines.push(ad.parent2.facts);
      lines.push('');
    } else if (isAdopt) {
      lines.push('(Single parent — no second parent provided.)');
      lines.push('');
    }

    const homeSections = [
      { key: 'homeOutside',  label: 'OUTSIDE OF HOME' },
      { key: 'homeInside',   label: 'NURSERY / INSIDE' },
      { key: 'neighborhood', label: 'NEIGHBORHOOD FEATURE' },
      { key: 'pets',         label: 'PETS' },
    ];
    homeSections.forEach(({ key, label }) => {
      const data = ad[key];
      if (data && (data.note || (data.photos && data.photos.length))) {
        lines.push(`${label}:`);
        if (data.note) lines.push(data.note);
        if (data.photos && data.photos.length) {
          lines.push(`Photos (${data.photos.length}):`);
          data.photos.forEach(p => {
            const cap = p.caption ? ` — "${p.caption}"` : '';
            lines.push(`  - ${photoRef(p)}${cap}`);
          });
        }
        lines.push('');
      }
    });

    if (ad.moments && ad.moments.length) {
      lines.push('EVERYDAY MOMENTS (each photo has its own description):');
      ad.moments.forEach(p => {
        const cap = p.caption ? ` — "${p.caption}"` : ' — (no description)';
        lines.push(`  - ${photoRef(p)}${cap}`);
      });
      lines.push('');
    }

    if (ad.agency || ad.caseworker) {
      lines.push('AGENCY:');
      if (ad.agency)     lines.push(`  - Agency: ${ad.agency}`);
      if (ad.caseworker) lines.push(`  - Caseworker: ${ad.caseworker}`);
      lines.push('');
    }

    const fund = ad.fundraising || {};
    if (fund.url) {
      lines.push('FUNDRAISING:');
      lines.push(`  - Platform: ${fund.platform || '(unspecified)'}`);
      lines.push(`  - Link: ${fund.url}`);
      lines.push('  - REQUIREMENT: the built website must display this link prominently AND');
      lines.push('    track clicks/visits (e.g. via a small JS click handler that logs to');
      lines.push('    Cloudflare Analytics, Plausible, or a custom counter). Show the click');
      lines.push('    count somewhere the owner can review it.');
      lines.push('');
    }

    if (ad.contactEmail || ad.contactPhone) {
      lines.push('ADOPTION-SPECIFIC CONTACT (use these for the inquiry form / contact section,');
      lines.push('not the personal contact info from About):');
      if (ad.contactEmail) lines.push(`  - Email: ${ad.contactEmail}`);
      if (ad.contactPhone) lines.push(`  - Phone: ${ad.contactPhone}`);
      lines.push('');
    }

    if (ad.anythingElse) {
      lines.push('ANYTHING ELSE THE FAMILY WANTED TO SAY:');
      lines.push(ad.anythingElse);
      lines.push('');
    }
  } else if (isRecruit) {
    // ── Coach-facing essentials (most important first) ──
    lines.push('ATHLETE BASICS (coach-facing essentials first):');
    const basicsRows = [
      ['Name',             name],
      ['Graduation year',  rc.gradYear],
      ['Sport',            rc.primarySport],
      ['Primary pos.',     rc.primaryPositions],
      ['Secondary pos.',   rc.secondaryPositions],
      ['High school',      rc.highSchool],
      ['Location',         rc.city],
      ['Height',           rc.height],
      ['Weight',           rc.weight],
    ].filter(([_, v]) => v);
    basicsRows.forEach(([k, v]) => lines.push(`  - ${k}: ${v}`));
    if (rc.classRank || rc.jerseyNumber) {
      lines.push('  (optional / minor detail)');
      if (rc.classRank)    lines.push(`  - Class rank: ${rc.classRank}`);
      if (rc.jerseyNumber) lines.push(`  - Jersey #: ${rc.jerseyNumber}`);
    }
    lines.push('');

    // ── NCAA Eligibility Center (athlete inputs only, not asserted rules) ──
    const NCAA_STATUS_LABELS = {
      'registered':  'Registered (has ID)',
      'in-progress': 'Account started, not finalized',
      'not-yet':     'Not yet registered',
      'unsure':      'Not sure',
    };
    if (rc.ncaaIdStatus || rc.ncaaId) {
      lines.push('NCAA ELIGIBILITY CENTER (athlete-provided input, not asserted by this form):');
      lines.push('  Note: starting 2026-27, the Eligibility Center is being applied at ALL');
      lines.push('  divisions including D-III. NCAA rules change — verify current requirements');
      lines.push('  at eligibilitycenter.org. Display these as athlete inputs, not as guarantees.');
      if (rc.ncaaIdStatus) lines.push(`  - Registration status: ${NCAA_STATUS_LABELS[rc.ncaaIdStatus] || rc.ncaaIdStatus}`);
      if (rc.ncaaId)       lines.push(`  - NCAA Eligibility Center ID: ${rc.ncaaId}`);
      lines.push('');
    }

    // ── Academics ──
    const TRANSCRIPT_LABELS = {
      'yes':         'Yes — available on request',
      'in-progress': 'In progress',
      'not-yet':     'Not yet',
    };
    const acadRows = [
      ['Overall GPA',         rc.gpa],
      ['Core-course GPA',     rc.coreGpa],
      ['SAT',                 rc.satScore],
      ['ACT',                 rc.actScore],
      ['Official transcript', TRANSCRIPT_LABELS[rc.transcriptStatus] || rc.transcriptStatus],
    ].filter(([_, v]) => v);
    if (acadRows.length || rc.intendedMajor || rc.academicHonors) {
      lines.push('ACADEMICS:');
      acadRows.forEach(([k, v]) => lines.push(`  - ${k}: ${v}`));
      if (rc.coreGpa) {
        lines.push('  (Core-course GPA = NCAA-recalculated GPA from ~16 approved core courses;');
        lines.push('   not a substitute for overall GPA — display both if available.)');
      }
      if (rc.intendedMajor)  { lines.push('  - Intended major / interests:'); lines.push(rc.intendedMajor); }
      if (rc.academicHonors) { lines.push('  - Academic honors:');             lines.push(rc.academicHonors); }
      lines.push('');
    }

    // ── Athletic performance ──
    if (rc.keyStats || rc.awards || rc.varsityYears || rc.teamAccomplishments) {
      lines.push('ATHLETIC PERFORMANCE:');
      if (rc.keyStats)            { lines.push('  - Key stats and achievements:'); lines.push(rc.keyStats); }
      if (rc.awards)              { lines.push('  - Awards and honors:');          lines.push(rc.awards); }
      if (rc.varsityYears)        lines.push(`  - Years on varsity: ${rc.varsityYears}`);
      if (rc.teamAccomplishments) { lines.push('  - Team accomplishments:');       lines.push(rc.teamAccomplishments); }
      lines.push('');
    }

    // ── Structured measurables (verified vs self-reported) ──
    const measurables = Array.isArray(rc.measurables) ? rc.measurables : [];
    if (measurables.length || rc.combineNotes) {
      lines.push('MEASURABLES (mark verified vs self-reported clearly on the site):');
      measurables.forEach(m => {
        const tag = m.status === 'verified' ? '[VERIFIED]'
                   : m.status === 'self'    ? '[self-reported]'
                   : '[status not given]';
        const src = m.source ? ` — ${m.source}` : '';
        lines.push(`  - ${m.name}: ${m.value} ${tag}${src}`);
      });
      if (rc.combineNotes) {
        lines.push('  - Other notes:');
        lines.push(rc.combineNotes);
      }
      lines.push('');
    }

    // ── Upcoming schedule (where coaches can watch in person) ──
    if (rc.upcomingSchedule) {
      lines.push('UPCOMING SCHEDULE (where coaches can watch in person — surface prominently):');
      lines.push(rc.upcomingSchedule);
      lines.push('');
    }

    // ── Recruiting goals ──
    if (rc.divisionsInterest || rc.schoolsInterest || rc.campsAttended) {
      lines.push('RECRUITING GOALS:');
      if (rc.divisionsInterest) lines.push(`  - Divisions of interest: ${rc.divisionsInterest}`);
      if (rc.schoolsInterest)   { lines.push('  - Schools of interest:'); lines.push(rc.schoolsInterest); }
      if (rc.campsAttended)     { lines.push('  - Camps / showcases (history):'); lines.push(rc.campsAttended); }
      lines.push('');
    }

    // ── Teams & coaches ──
    const hsc  = rc.hsHeadCoach || {};
    const club = rc.clubTeam    || {};
    if (hsc.name || hsc.email || hsc.phone) {
      lines.push('HIGH SCHOOL TEAM & COACH:');
      if (hsc.name)  lines.push(`  - Head coach: ${hsc.name}`);
      if (hsc.email) lines.push(`  - Email: ${hsc.email}`);
      if (hsc.phone) lines.push(`  - Phone: ${hsc.phone}`);
      lines.push('');
    }
    if (club.name || club.coachName || club.coachEmail || club.coachPhone) {
      const clubLabel = getClubTeamLabel(rc.primarySport).toUpperCase();
      lines.push(`${clubLabel}:`);
      if (club.name)       lines.push(`  - Team: ${club.name}`);
      if (club.coachName)  lines.push(`  - Coach: ${club.coachName}`);
      if (club.coachEmail) lines.push(`  - Email: ${club.coachEmail}`);
      if (club.coachPhone) lines.push(`  - Phone: ${club.coachPhone}`);
      lines.push('');
    }
    if (rc.additionalReferences) {
      lines.push('ADDITIONAL COACH CONTACTS (position, strength, etc.):');
      lines.push(rc.additionalReferences);
      lines.push('');
    }

    // ── Character references (non-coach) ──
    const refs = Array.isArray(rc.characterReferences) ? rc.characterReferences : [];
    if (refs.length) {
      lines.push('CHARACTER REFERENCES (beyond coaches — trainers, teachers, mentors):');
      refs.forEach(r => {
        const contact = [r.email, r.phone].filter(Boolean).join(' · ');
        const roleStr = r.role ? ` (${r.role})` : '';
        lines.push(`  - ${r.name}${roleStr}${contact ? ' — ' + contact : ''}`);
      });
      lines.push('');
    }

    // ── PRIMARY highlight video (the single most important asset) ──
    if (rc.primaryHighlightVideo) {
      lines.push('┌─────────────────────────────────────────────────────────┐');
      lines.push('│  PRIMARY HIGHLIGHT VIDEO — single most important asset   │');
      lines.push('│  Embed this prominently above the fold on the site.     │');
      lines.push('└─────────────────────────────────────────────────────────┘');
      lines.push(`  ${rc.primaryHighlightVideo}`);
      lines.push('');
    }

    // ── Additional highlight media ──
    if ((rc.highlightVideos || []).length || (rc.gameFilm || []).length) {
      lines.push('ADDITIONAL HIGHLIGHT MEDIA:');
      if ((rc.highlightVideos || []).length) {
        lines.push('  - Additional highlight video links:');
        rc.highlightVideos.forEach(u => lines.push(`      ${u}`));
      }
      if ((rc.gameFilm || []).length) {
        lines.push('  - Game film links:');
        rc.gameFilm.forEach(u => lines.push(`      ${u}`));
      }
      lines.push('');
    }

    // ── Photos by category ──
    const photoCats = [
      { key: 'headshot',    label: 'HEADSHOT (use as primary portrait)' },
      { key: 'actionShots', label: 'ACTION SHOTS' },
      { key: 'teamPhotos',  label: 'TEAM PHOTOS' },
    ];
    const anyPhotos = photoCats.some(c => (rc[c.key] || []).length);
    if (anyPhotos) {
      lines.push('PHOTOS:');
      photoCats.forEach(c => {
        const photos = rc[c.key] || [];
        if (!photos.length) return;
        lines.push(`  ${c.label} (${photos.length}):`);
        photos.forEach(p => {
          const cap = p.caption ? ` — "${p.caption}"` : '';
          lines.push(`      - ${photoRef(p)}${cap}`);
        });
      });
      lines.push('');
    }

    // ── Social & online presence ──
    const social = rc.social || {};
    const socialList = [
      ['Instagram', social.instagram],
      ['X / Twitter', social.twitter],
      ['TikTok',    social.tiktok],
      ['YouTube',   social.youtube],
      ['Hudl',      social.hudl],
      ['Other',     social.otherSocial],
    ].filter(([_, v]) => v);
    if (socialList.length) {
      lines.push('SOCIAL & ONLINE PRESENCE (display these prominently — bio-link block):');
      socialList.forEach(([k, v]) => lines.push(`  - ${k}: ${v}`));
      lines.push('');
    }

    // ── Contact ──
    const contact = rc.contact || {};
    if (contact.athleteEmail || contact.athletePhone || contact.parentName || contact.parentEmail || contact.parentPhone) {
      lines.push('CONTACT:');
      if (contact.athleteEmail) lines.push(`  - Athlete email: ${contact.athleteEmail}`);
      if (contact.athletePhone) lines.push(`  - Athlete phone: ${contact.athletePhone}`);
      if (contact.parentName)   lines.push(`  - Parent/guardian: ${contact.parentName}`);
      if (contact.parentEmail)  lines.push(`  - Parent email: ${contact.parentEmail}`);
      if (contact.parentPhone)  lines.push(`  - Parent phone: ${contact.parentPhone}`);
      lines.push('');
    }

    // ── Athlete statement (verbatim) ──
    if (rc.athleteStatement) {
      lines.push('┌─────────────────────────────────────────────────────────┐');
      lines.push('│  ATHLETE STATEMENT — VERBATIM, DO NOT REWRITE           │');
      lines.push('│  The athlete\'s own words. Display exactly as is.        │');
      lines.push('└─────────────────────────────────────────────────────────┘');
      lines.push(rc.athleteStatement);
      lines.push('');
    }
  } else {
    if (qData.tagline) {
      lines.push('Tagline idea:');
      lines.push(qData.tagline);
      lines.push('');
    }
    if (qData.facts) {
      lines.push('Key facts about the business / family:');
      lines.push(qData.facts);
      lines.push('');
    }
    if (qData.services) {
      lines.push('Services / main offerings:');
      lines.push(qData.services);
      lines.push('');
    }
    if (qData.feeling) {
      lines.push('What they want said / feeling to convey:');
      lines.push(qData.feeling);
      lines.push('');
    }
    if (qData.mustHaves) {
      lines.push('Must-haves and things to avoid:');
      lines.push(qData.mustHaves);
      lines.push('');
    }
  }

  // ── Instructions ──
  lines.push('═══════════════════════════════════════');
  lines.push('INSTRUCTIONS');
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push('The notes above are BULLET POINTS from the client, not finished website copy.');
  lines.push(`Your job is to WRITE the actual website copy from those notes — natural, warm,`);
  lines.push(`well-written prose in a ${vibeLabel.toLowerCase()} tone.`);
  lines.push('');
  lines.push('RULE: Write only from the notes provided. Do not invent specific facts — no');
  lines.push('made-up dates, names, statistics, or personal-story details. If a section');
  lines.push('needs more detail than the notes give, keep it general rather than fabricating.');
  if (isAdopt) {
    lines.push('');
    lines.push('ADOPTION-SPECIFIC RULES:');
    lines.push('- The letter to birth parents (above) is the family\'s own words. Display it');
    lines.push('  VERBATIM as a dedicated section on the site. Do not edit, summarize, or');
    lines.push('  paraphrase it in any way.');
    lines.push('- Use the family\'s photos in the home/pets/moments sections of the site;');
    lines.push('  preserve the moment descriptions verbatim as captions.');
    lines.push('- Treat the fundraising link (if provided) as a sensitive, tracked CTA.');
  }
  if (isRecruit) {
    lines.push('');
    lines.push('RECRUITING-SPECIFIC RULES:');
    lines.push('- The athlete statement (above) is the athlete\'s own words. Display it');
    lines.push('  VERBATIM as a dedicated section on the site. Do not edit, summarize, or');
    lines.push('  paraphrase it in any way.');
    lines.push('- Embed the PRIMARY HIGHLIGHT VIDEO (designated separately above) prominently');
    lines.push('  above the fold (YouTube / Hudl iframe). This is the single most important');
    lines.push('  asset on the page. Additional highlight links go in a secondary "more film"');
    lines.push('  block below — do NOT mix them with the primary.');
    lines.push('- Graduation year is the #1 filter coaches use — surface it in the hero,');
    lines.push('  alongside sport and primary position(s).');
    lines.push('- For measurables, preserve the [VERIFIED] vs [self-reported] tags visually on');
    lines.push('  the site (e.g. a small badge next to each number). Do NOT remove these tags.');
    lines.push('- Show NCAA Eligibility Center info (ID + status) as athlete-provided data,');
    lines.push('  NOT as a guarantee of eligibility. Include a small note linking to');
    lines.push('  eligibilitycenter.org for current requirements. NCAA rules are changing;');
    lines.push('  the site reports inputs, not rules.');
    lines.push('- Surface upcoming schedule (games, showcases, camps) as a clear, dated list');
    lines.push('  so coaches can plan to watch in person.');
    lines.push('- Display the social-handle block (Instagram, X, TikTok, YouTube, Hudl)');
    lines.push('  prominently. This site is the central hub the athlete links to from');
    lines.push('  every social bio and every email to a coach.');
    lines.push('- Show stats, awards, and academics as scannable bullets — coaches skim,');
    lines.push('  they do not read paragraphs.');
    lines.push('- Make ALL contact info (athlete, parent, head coach, club coach, character');
    lines.push('  references) clearly visible. Coaches need to reach out fast.');
    lines.push('- Do NOT invent stats, awards, or measurables. If a number was not given,');
    lines.push('  do not put one in. Pure pass-through on the numeric facts.');
  }
  lines.push('');

  // ── Pages ──
  lines.push('═══════════════════════════════════════');
  lines.push('PAGES / SECTIONS');
  lines.push('═══════════════════════════════════════');
  if (isAdopt) {
    // Suggested page structure for adoption profiles
    lines.push('Suggested sections for an adoption profile (assemble as appropriate):');
    lines.push('- Hero / family portrait');
    lines.push('- Letter to birth parents (verbatim)');
    lines.push('- Meet the parents');
    lines.push('- Our home (outside / inside / neighborhood)');
    lines.push('- Our pets');
    lines.push('- Everyday moments gallery');
    if ((ad.fundraising || {}).url) lines.push('- Fundraising (tracked CTA)');
    lines.push('- Get in touch (agency + family contact)');
  } else if (isRecruit) {
    // Suggested page structure for recruiting profiles
    lines.push('Suggested sections for a recruiting profile (single-page hub by default):');
    lines.push('- Hero — headshot, name, GRAD YEAR, sport + position, height/weight,');
    lines.push('  PRIMARY highlight video embedded above the fold');
    lines.push('- Quick-stat strip — key stat(s), GPA, top verified measurable');
    lines.push('- Athletic performance — stats, awards, team accomplishments');
    lines.push('- Measurables table — name, value, verified/self-reported tag, source');
    lines.push('- Upcoming schedule — dated list of games, showcases, camps coaches can attend');
    lines.push('- Academics — overall + core-course GPA, test scores, transcript availability,');
    lines.push('  intended major, honors');
    lines.push('- NCAA Eligibility Center — ID + status, with link to eligibilitycenter.org');
    lines.push('  (displayed as athlete-provided info, not as a rules statement)');
    lines.push('- Additional film library — additional highlight videos + game film links');
    lines.push('- Photo gallery — action shots + team photos');
    lines.push('- Recruiting goals — divisions of interest, schools, camps history');
    lines.push('- Athlete statement (verbatim)');
    lines.push('- Coaches — HS coach, club coach, additional coach contacts');
    lines.push('- Character references — non-coach (trainers, teachers, mentors)');
    lines.push('- Social bio-link block — Instagram, X, TikTok, YouTube, Hudl');
    lines.push('- Contact — athlete + parent contact info');
  } else if (qData.pages && qData.pages.length) {
    qData.pages.forEach(p => lines.push(`- ${p}`));
  } else {
    lines.push('(none specified — use sensible defaults)');
  }
  lines.push('');

  // Palette
  lines.push('═══════════════════════════════════════');
  lines.push(`COLOR PALETTE — ${qData.paletteChoice || '(not chosen)'}`);
  lines.push('═══════════════════════════════════════');
  if (qData.paletteColors) {
    for (const [colorName, hex] of Object.entries(qData.paletteColors)) {
      if (colorName !== 'spectrum') {
        lines.push(`- ${colorName}: ${hex}`);
      }
    }
    // Add Wildflower spectrum note if applicable
    if (qData.paletteChoice === 'Wildflower' && qData.paletteColors.spectrum) {
      lines.push('');
      lines.push('WILDFLOWER SPECTRUM (available for section accents, icons, dividers):');
      lines.push(qData.paletteColors.spectrum.join(', '));
    }
  } else {
    lines.push('(no palette chosen — pick warm, trustworthy defaults)');
  }
  lines.push('');

  // Photos — recruit already listed its categorized photos in the body
  if (!isRecruit) {
    lines.push('═══════════════════════════════════════');
    lines.push('PHOTOS');
    lines.push('═══════════════════════════════════════');
    if (isAdopt) {
      // Adoption photos are already broken down by category in the client notes.
      // Step-6 photos here are extras (headshots/portraits).
      if (qData.photos && qData.photos.length) {
        lines.push('Headshots / portraits / extras (from Step 6):');
        qData.photos.forEach(p => {
          const cap = p.caption ? ` — "${p.caption}"` : '';
          lines.push(`  - ${photoRef(p)}${cap}`);
        });
      } else {
        lines.push('(no extra portraits — use photos from the family/home/moments sections above)');
      }
    } else if (qData.photos && qData.photos.length) {
      qData.photos.forEach(p => {
        const cap = p.caption ? ` — "${p.caption}"` : '';
        lines.push(`- ${photoRef(p)}${cap}`);
      });
      lines.push('');
      lines.push('(Use the captions as guidance for where each photo belongs:');
      lines.push(' storefront/exterior → hero; team/people/pets → about; product/work → services/gallery.)');
    } else {
      lines.push('(no photos provided)');
    }
    lines.push('');
  }

  // Contact / links — recruit already listed its dedicated contact + social blocks
  if (!isRecruit) {
    const contact = [];
    if (qData.email)      contact.push(`- Email: ${qData.email}`);
    if (qData.phone)      contact.push(`- Phone: ${qData.phone}`);
    if (!isAdopt) {
      if (qData.website)    contact.push(`- Current site: ${qData.website}`);
      if (qData.facebook)   contact.push(`- Facebook: ${qData.facebook}`);
      if (qData.instagram)  contact.push(`- Instagram: ${qData.instagram}`);
      if (qData.otherLinks) contact.push(`- Other: ${qData.otherLinks}`);
    }
    if (contact.length) {
      lines.push('═══════════════════════════════════════');
      lines.push('CONTACT / LINKS');
      lines.push('═══════════════════════════════════════');
      contact.forEach(l => lines.push(l));
      lines.push('');
    }
  }

  lines.push('Build a responsive, single-file website.');

  return lines.join('\n');
}

// Generic "Copy" button helper. `getTextFn` is called at click time
// so we always copy the current text, not a stale snapshot.
function attachCopyHandler(btn, getTextFn) {
  if (!btn) return;

  btn.addEventListener('click', () => {
    const text = getTextFn();
    const span = btn.querySelector('span');
    const original = span ? span.textContent : 'Copy Prompt';

    const flashCopied = () => {
      if (span) span.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        if (span) span.textContent = original;
        btn.classList.remove('copied');
      }, 1800);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(flashCopied).catch(() => {
        fallbackCopyToClipboard(text, flashCopied);
      });
    } else {
      fallbackCopyToClipboard(text, flashCopied);
    }
  });
}

function fallbackCopyToClipboard(text, onSuccess) {
  // Legacy fallback for browsers without async clipboard API
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); onSuccess?.(); } catch { /* noop */ }
  document.body.removeChild(ta);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Split a multi-line textarea value into a clean array (one item per line).
function splitLines(str) {
  return String(str || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}


// ════════════════════════════════════════════════════════════════════════════
//  QUESTIONNAIRE — Init & navigation
// ════════════════════════════════════════════════════════════════════════════

function initQuestionnaire() {
  qCurrentStep = 1;
  qShowStep(1);

  document.getElementById('qNextBtn')?.addEventListener('click', qNext);
  document.getElementById('qPrevBtn')?.addEventListener('click', qPrev);
  document.getElementById('qPayBtn')?.addEventListener('click', qPaySubmit);

  // TEMP TESTING: clickable step jump — REMOVE to restore validation
  // Every step dot (not just completed ones) is clickable. Jumps freely
  // without running qValidateStep so any step is reachable at any time.
  document.querySelectorAll('#qSteps .q-step[data-step]').forEach(dot => {
    dot.addEventListener('click', () => {
      const target = parseInt(dot.dataset.step, 10);
      if (target === qCurrentStep) return;
      qSaveStep(qCurrentStep);
      qCurrentStep = target;
      qShowStep(target, target < qCurrentStep ? 'back' : 'forward');
    });
  });
  // END TEMP TESTING
  document.getElementById('qExitBtn')?.addEventListener('click',  (e) => { e.preventDefault(); backToDashboard(); });
  document.getElementById('qExitBtn2')?.addEventListener('click', (e) => { e.preventDefault(); backToDashboard(); });
  document.getElementById('qReturnBtn')?.addEventListener('click', () => {
    qSaveStep(qCurrentStep);
    qReturnToReview = false;
    qCurrentStep    = Q_REVIEW;
    qShowStep(Q_REVIEW, 'forward');
  });
  initPhotoUpload();
  initAdoptPhotoBuckets();
  initRecruitPhotoBuckets();
  initPageToggles();
  initPaymentStep();
  document.getElementById('qrPrimarySport')?.addEventListener('input', updateClubTeamLabels);
  applyFlowVariant();
}

function initPageToggles() {
  document.querySelectorAll('#qPanel3 .checkbox-label').forEach(label => {
    const input = label.querySelector('input[type="checkbox"]');
    if (!input) return;
    // Sync class to initial HTML state (e.g., "Home" is pre-checked)
    label.classList.toggle('is-checked', input.checked);
    // Whenever the native checkbox changes, mirror it and re-enforce any cap
    input.addEventListener('change', () => {
      label.classList.toggle('is-checked', input.checked);
      updatePageLimitUI();
    });
  });
}

// Returns max pages for a tier (null = unlimited).
// Matches by tier name: Starter → 3, Standard → 6, anything else → null.
function getTierPageLimit(tier) {
  if (!tier) return null;
  const n = (tier.name || '').toLowerCase();
  if (n.includes('starter'))  return 3;
  if (n.includes('standard')) return 6;
  return null;
}

// Enforce (or lift) the page-count cap in Step 3 based on the
// currently selected tier. Safe to call when step 3 is hidden.
function updatePageLimitUI() {
  // Adoption + recruiting flows use fixed structures, not the pages
  // checkboxes — skip cap enforcement entirely there.
  if (isAdoptionFlow() || isRecruitFlow()) return;

  const limit      = getTierPageLimit(qSelectedTier);
  const checkboxes = Array.from(document.querySelectorAll('#qPanel3 input[name="qPages"]'));
  const msgEl      = document.getElementById('qPageLimitMsg');

  // Start clean: re-enable every checkbox
  checkboxes.forEach(cb => {
    cb.disabled = false;
    cb.closest('.checkbox-label')?.classList.remove('checkbox-label--disabled');
  });

  if (limit === null) {
    if (msgEl) { msgEl.hidden = true; msgEl.innerHTML = ''; }
    return;
  }

  // Show tier note
  if (msgEl) {
    msgEl.hidden   = false;
    msgEl.innerHTML =
      `<strong>${escapeHtml(qSelectedTier.name)}</strong> includes ` +
      `up to <strong>${limit}</strong> page${limit !== 1 ? 's' : ''}.`;
  }

  // Trim excess: uncheck boxes beyond the cap (keep first `limit` checked ones)
  const checked = checkboxes.filter(cb => cb.checked);
  if (checked.length > limit) {
    checked.slice(limit).forEach(cb => {
      cb.checked = false;
      cb.closest('.checkbox-label')?.classList.remove('is-checked');
    });
  }

  // Disable unchecked boxes once the cap is reached
  const atCap = checkboxes.filter(cb => cb.checked).length >= limit;
  if (atCap) {
    checkboxes.forEach(cb => {
      if (!cb.checked) {
        cb.disabled = true;
        cb.closest('.checkbox-label')?.classList.add('checkbox-label--disabled');
      }
    });
  }
}

function initPaymentStep() {
  const grid = document.getElementById('qTierCards');
  if (!grid) return;
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Choose a package');
  // Cards rendered dynamically when user reaches Step 8 — see qShowStep.
}

function renderTierCards(tiers) {
  const grid = document.getElementById('qTierCards');
  if (!grid) return;

  // Reset prior selection (tiers may have changed if site type changed)
  grid.innerHTML = '';
  qSelectedTier = null;
  const payBtn = document.getElementById('qPayBtn');
  if (payBtn) payBtn.disabled = true;

  if (!tiers || !tiers.length) {
    grid.innerHTML = '<p class="tier-empty">No pricing tiers available for this site type. <a href="/setup.html">Set them up</a>.</p>';
    return;
  }

  tiers.forEach(tier => {
    const card = document.createElement('div');
    card.className = 'tier-card' + (tier.badge ? ' tier-featured' : '');
    card.dataset.tierId = tier.id;

    // Parse dollar amount for 50/50 split display
    const rawNum = parseFloat((tier.price || '').replace(/[^0-9.]/g, ''));
    const half   = Number.isFinite(rawNum) ? Math.round(rawNum / 2) : null;
    const splitLine = half !== null
      ? `<p class="tier-split">${escapeHtml(tier.price)} total: $${half} now, $${half} on completion</p>`
      : '';

    card.innerHTML = `
      ${tier.badge ? `<span class="tier-badge">${escapeHtml(tier.badge)}</span>` : ''}
      <p class="tier-name">${escapeHtml(tier.name)}</p>
      <p class="tier-price">$${half !== null ? half : escapeHtml(tier.price)}</p>
      <p class="tier-cycle">due now</p>
      ${splitLine}
      <ul class="tier-features">
        ${(tier.features || []).map(f => `<li>${escapeHtml(f)}</li>`).join('')}
      </ul>
    `;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    const selectTier = () => {
      grid.querySelectorAll('.tier-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-checked', 'true');
      qSelectedTier = tier;
      if (payBtn) payBtn.disabled = false;
      // Re-evaluate Step 3 page cap now that a tier is known
      updatePageLimitUI();
    };
    card.addEventListener('click', selectTier);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTier(); }
    });
    grid.appendChild(card);
  });
}

function qNext() {
  if (!qValidateStep(qCurrentStep)) return;
  qSaveStep(qCurrentStep);
  qCurrentStep++;
  qShowStep(qCurrentStep, 'forward');
}

function qPrev() {
  qSaveStep(qCurrentStep); // save without validation on back
  qCurrentStep--;
  qShowStep(qCurrentStep, 'back');
}

async function qSubmit() {
  qSaveStep(Q_TOTAL);

  const submittedAt = new Date().toISOString();
  const buildPrompt = qGenerateBuildPrompt();

  const result = await persistSubmission({ submittedAt, buildPrompt });
  if (result.cancelled) return;        // user cancelled photo upload — stay on submit step
  if (result.error) {
    alert(
      `We couldn't save your submission to the server:\n\n${result.error.message}\n\n` +
      `A local backup was kept. Please contact us so we don't miss your project.`
    );
  }

  qShowComplete();
}

async function qPaySubmit() {
  if (!qSelectedTier) return;

  // Block payment if the chosen tier's page cap is exceeded
  const mismatch = qGetPageMismatch();
  if (mismatch) {
    const pg = n => `${n} page${n !== 1 ? 's' : ''}`;
    const errEl = document.getElementById('qTierMismatchErr');
    if (errEl) {
      errEl.hidden = false;
      errEl.innerHTML =
        `Your <strong>${escapeHtml(mismatch.tierName)}</strong> package includes up to ` +
        `<strong>${pg(mismatch.limit)}</strong>. You have selected ` +
        `<strong>${pg(mismatch.count)}</strong>. Please ` +
        `<a href="#" class="q-mismatch-link" data-step="3">remove ${pg(mismatch.excess)}</a>` +
        ` or choose a larger package.`;
      errEl.querySelectorAll('.q-mismatch-link').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault();
          errEl.hidden = true;
          qReturnToReview = false;
          qCurrentStep    = parseInt(a.dataset.step, 10);
          qShowStep(qCurrentStep, 'back');
        });
      });
    }
    return;
  }

  qSaveStep(Q_TOTAL); // saves tier selection into qData

  const submittedAt = new Date().toISOString();
  const buildPrompt = qGenerateBuildPrompt();

  // ── Build payment metadata for the submission ───────────────────────────
  // Computed BEFORE the Supabase insert so it lands in the saved row, and
  // BEFORE the Stripe redirect so the brief is never lost if the client
  // pays then bounces. Total/deposit are derived from the tier price; the
  // Stripe link is matched by (siteType, tier name).
  const total      = parseTierTotal(qSelectedTier);
  const deposit    = total !== null ? Math.round(total / 2) : null;
  const stripeLink = getStripeLinkFor(qData.siteType, qSelectedTier);

  const payment = {
    businessType: qData.siteType || null,
    tier:         qSelectedTier.name || null,
    totalCents:   total   !== null ? Math.round(total   * 100) : null,
    depositCents: deposit !== null ? Math.round(deposit * 100) : null,
    currency:     'usd',
    stripeLink:   stripeLink,
    testMode:     STRIPE_TEST_MODE,
    status:       stripeLink ? 'pending' : 'no_link',
  };

  // ── CRITICAL: save the submission FIRST, then redirect to Stripe ────────
  // A client must never pay and lose their brief. Photos → R2, row → Supabase.
  const payBtn = document.getElementById('qPayBtn');
  if (payBtn) {
    payBtn.disabled    = true;
    payBtn.textContent = 'Saving your brief…';
  }

  const result = await persistSubmission({ submittedAt, buildPrompt, payment });

  if (result.cancelled) {
    // User cancelled photo upload — stay on Step 8 and let them retry.
    if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Pay & Submit'; }
    return;
  }
  if (result.error) {
    if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Pay & Submit'; }
    alert(
      `We couldn't save your submission to the server:\n\n${result.error.message}\n\n` +
      `A local backup was kept. Please contact us so we don't miss your project.`
    );
    return; // Do NOT redirect to Stripe — we haven't saved the brief.
  }

  // ── Fail-safe: no Stripe link matches this (siteType, tier) ─────────────
  // Common reason: owner renamed a tier in setup.html so the case-insensitive
  // name lookup misses. The brief IS already saved; show the user a clear
  // message rather than sending them to a wrong/broken link.
  if (!stripeLink) {
    console.warn('No Stripe Payment Link matched', { siteType: qData.siteType, tier: qSelectedTier?.name });
    qShowComplete({
      noLink: true,
      tierName: qSelectedTier?.name || 'your package',
    });
    return;
  }

  // ── Redirect to Stripe Payment Link (50% deposit only) ──────────────────
  // The remaining 50% is invoiced separately on project completion.
  //
  // TO GO LIVE: swap STRIPE_PAYMENT_LINKS above to live URLs and set
  // STRIPE_TEST_MODE = false. The success_url configured on each Payment
  // Link in the Stripe dashboard should return the client to
  // /portal.html?fpw=success&sid={CHECKOUT_SESSION_ID}.
  if (payBtn) payBtn.textContent = 'Redirecting to secure checkout…';

  // Prefill the buyer's email on the Stripe checkout page when we know it.
  const buyerEmail = currentUser?.email || qData.contactEmail || qData.email || '';
  const url        = new URL(stripeLink);
  if (buyerEmail) url.searchParams.set('prefilled_email', buyerEmail);
  // submissionId lets a future webhook tie the Stripe Checkout Session
  // back to the submission row in Supabase (via client_reference_id).
  if (result.submissionId) url.searchParams.set('client_reference_id', result.submissionId);

  window.location.href = url.toString();
}

function qShowStep(step, direction = 'forward') {
  // Hide all step panels (not the complete panel)
  for (let i = 1; i <= Q_TOTAL; i++) {
    document.getElementById(`qPanel${i}`)?.classList.add('hidden');
  }

  const panel = document.getElementById(`qPanel${step}`);
  if (!panel) return;

  panel.classList.remove('hidden', 'q-enter-fwd', 'q-enter-back');
  void panel.offsetWidth; // force reflow to restart animation
  panel.classList.add(direction === 'back' ? 'q-enter-back' : 'q-enter-fwd');

  // Make sure the right flow variant (generic vs adoption) is showing
  applyFlowVariant();

  // Re-apply page-count cap whenever Step 3 is revisited with a tier set
  if (step === 3) {
    updatePageLimitUI();
  }

  // Render review on step 7; clear edit-mode flag
  if (step === Q_REVIEW) {
    qReturnToReview = false;
    qRenderReview();
  }

  // Render tier cards for payment step — uses the site type chosen in Step 1
  if (step === Q_TOTAL) {
    renderTierCards(getTiersForSiteType(qData.siteType));
  }

  // UI updates
  updateQStepIndicator(step);
  updateQNav(step);

  // Clear any lingering errors
  clearQErrors();

  document.getElementById('questionnaireSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// `opts` lets the caller tailor the complete-panel copy for the three cases:
//   • undefined → "brief received" (paid or in-progress)
//   • { paid: true }   → "payment received" (Stripe success redirect)
//   • { noLink: true, tierName } → fallback when no Stripe link matched
function qShowComplete(opts) {
  // Hide all step panels and nav
  for (let i = 1; i <= Q_TOTAL; i++) {
    document.getElementById(`qPanel${i}`)?.classList.add('hidden');
  }
  document.getElementById('qNav')?.classList.add('hidden');

  // Mark all steps done in indicator
  for (let i = 1; i <= Q_TOTAL; i++) {
    const dot  = document.querySelector(`.q-step[data-step="${i}"]`);
    const rail = document.querySelector(`.q-step-rail[data-rail="${i}"]`);
    dot?.classList.remove('active', 'upcoming');
    dot?.classList.add('done');
    rail?.classList.add('done');
  }

  // Populate the complete panel
  const completeName = document.getElementById('qCompleteName');
  if (completeName) completeName.textContent = qData.name || 'friend';

  const heading = document.querySelector('#qPanelComplete h2');
  const subEl   = document.querySelector('#qPanelComplete .q-panel-sub');
  const noteEl  = document.querySelector('#qPanelComplete .q-complete-payment-note');

  if (opts?.paid) {
    // qData is empty on a fresh page load after Stripe — fall back to the
    // signed-in user's display name (set by Supabase auth) so the greeting
    // isn't a generic "friend".
    const name = qData.name || currentUser?.name || 'friend';
    if (heading) heading.textContent = 'Payment received, thank you!';
    if (subEl) {
      subEl.innerHTML =
        `Thank you, <strong id="qCompleteName">${escapeHtml(name)}</strong>! ` +
        `Your brief has been received and your 50% deposit is confirmed. ` +
        `We will be in touch within 1&nbsp;business&nbsp;day.`;
    }
    if (noteEl) {
      noteEl.innerHTML =
        `The remaining 50% will be invoiced when your finished site is ` +
        `delivered and you have approved every detail, not a moment before.`;
    }
  } else if (opts?.noLink) {
    if (heading) heading.textContent = 'Brief received, we will follow up to take payment';
    if (subEl) {
      subEl.innerHTML =
        `Thank you, <strong id="qCompleteName">${escapeHtml(qData.name || 'friend')}</strong>! ` +
        `Your project brief for the <strong>${escapeHtml(opts.tierName)}</strong> package ` +
        `has been received. We could not auto-route you to a payment page from here, ` +
        `so we will send a payment link by email within 1&nbsp;business&nbsp;day.`;
    }
    if (noteEl) {
      noteEl.innerHTML =
        `Once the 50% deposit is paid, work begins. The remaining 50% is ` +
        `invoiced when your finished site is delivered and approved.`;
    }
  }
  // else: default copy already in the HTML covers the non-payment Submit flow.

  const panel = document.getElementById('qPanelComplete');
  if (panel) {
    panel.classList.remove('hidden', 'q-enter-fwd', 'q-enter-back');
    void panel.offsetWidth;
    panel.classList.add('q-enter-fwd');
  }

  document.getElementById('questionnaireSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Detect the Stripe Payment Link success redirect on page load. Stripe sends
// the client back to `?fpw=success&sid={CHECKOUT_SESSION_ID}` — we don't yet
// verify the session server-side (no webhook), so this is best-effort UX:
// the source of truth for "did they actually pay?" is the Stripe dashboard
// (and, later, a webhook that flips q_data.payment.status to 'paid').
function handleStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('fpw') !== 'success') return;

  // Clean the query off the URL so a refresh doesn't re-show this view.
  const cleanUrl = window.location.pathname + window.location.hash;
  history.replaceState(null, '', cleanUrl);

  // Make sure the questionnaire shell is visible, then show the paid-complete view.
  document.getElementById('authSection')?.classList.add('hidden');
  document.getElementById('portalDashboard')?.classList.add('hidden');
  document.getElementById('questionnaireSection')?.classList.remove('hidden');
  qShowComplete({ paid: true });
}

// Update the step dots + rails to reflect current step
function updateQStepIndicator(currentStep) {
  for (let i = 1; i <= Q_TOTAL; i++) {
    const dot  = document.querySelector(`.q-step[data-step="${i}"]`);
    const rail = document.querySelector(`.q-step-rail[data-rail="${i}"]`);

    if (dot) {
      dot.classList.remove('active', 'done', 'upcoming');
      if (i < currentStep)      dot.classList.add('done');
      else if (i === currentStep) dot.classList.add('active');
      else                       dot.classList.add('upcoming');
    }
    if (rail) rail.classList.toggle('done', i < currentStep);
  }
}

// Update Back / counter / Next / Pay-or-Submit / Return-to-review
function updateQNav(step) {
  const prevBtn   = document.getElementById('qPrevBtn');
  const nextBtn   = document.getElementById('qNextBtn');
  const payBtn    = document.getElementById('qPayBtn');
  const returnBtn = document.getElementById('qReturnBtn');
  const counter   = document.getElementById('qStepCounter');
  const isPayment = step === Q_TOTAL; // step 8

  if (prevBtn) prevBtn.disabled = (step === 1);
  if (nextBtn) {
    nextBtn.classList.toggle('hidden', isPayment);
    nextBtn.innerHTML = (step === Q_REVIEW) ? 'Continue &rarr;' : 'Next &rarr;';
  }
  if (payBtn)    payBtn.classList.toggle('hidden', !isPayment);
  if (returnBtn) returnBtn.classList.toggle('hidden', !qReturnToReview || isPayment);
  if (counter)   counter.textContent = `Step ${step} of ${Q_TOTAL}`;
}


// ════════════════════════════════════════════════════════════════════════════
//  QUESTIONNAIRE — Data collection & validation
// ════════════════════════════════════════════════════════════════════════════

function qSaveStep(step) {
  // Each variant collects its own fields under qData.adopt.* / qData.recruit.* —
  // we save them side-by-side so switching site types preserves prior input.
  qData.adopt   = qData.adopt   || {};
  qData.recruit = qData.recruit || {};
  const adopt   = isAdoptionFlow();
  const recruit = isRecruitFlow();

  switch (step) {
    case 1:
      qData.name     = getVal('qName');
      qData.siteType = getVal('qSiteType');
      qData.email    = getVal('qEmail');
      qData.phone    = getVal('qPhone');
      break;
    case 2:
      if (adopt) {
        qData.adopt.city      = getVal('qaCity');
        qData.adopt.letter    = getVal('qaLetter');
        qData.adopt.parent1   = { name: getVal('qaP1Name'), facts: getVal('qaP1Facts') };
        qData.adopt.parent2   = { name: getVal('qaP2Name'), facts: getVal('qaP2Facts') };
      } else if (recruit) {
        // Coach-facing essentials (reordered so the most important fields come first)
        qData.recruit.gradYear           = getVal('qrGradYear');
        qData.recruit.primarySport       = getVal('qrPrimarySport');
        qData.recruit.primaryPositions   = getVal('qrPrimaryPositions');
        qData.recruit.secondaryPositions = getVal('qrSecondaryPositions');
        qData.recruit.highSchool         = getVal('qrHighSchool');
        qData.recruit.city               = getVal('qrCity');
        qData.recruit.height             = getVal('qrHeight');
        qData.recruit.weight             = getVal('qrWeight');
        // NCAA Eligibility Center (now applies to all divisions for 2026-27)
        qData.recruit.ncaaIdStatus       = getVal('qrNcaaIdStatus');
        qData.recruit.ncaaId             = getVal('qrNcaaId');
        // Academics
        qData.recruit.gpa                = getVal('qrGpa');
        qData.recruit.coreGpa            = getVal('qrCoreGpa');
        qData.recruit.satScore           = getVal('qrSatScore');
        qData.recruit.actScore           = getVal('qrActScore');
        qData.recruit.transcriptStatus   = getVal('qrTranscriptStatus');
        qData.recruit.intendedMajor      = getVal('qrIntendedMajor');
        qData.recruit.academicHonors     = getVal('qrAcademicHonors');
        // Optional / minor
        qData.recruit.classRank          = getVal('qrClassRank');
        qData.recruit.jerseyNumber       = getVal('qrJerseyNumber');
      } else {
        qData.tagline  = getVal('qTagline');
        qData.facts    = getVal('qFacts');
        qData.services = getVal('qServices');
        qData.feeling  = getVal('qFeeling');
      }
      break;
    case 3:
      if (adopt) {
        qData.adopt.homeOutside  = { note: getVal('qaHomeOutsideNote'),  photos: snapshotBucket('homeOutside') };
        qData.adopt.homeInside   = { note: getVal('qaHomeInsideNote'),   photos: snapshotBucket('homeInside') };
        qData.adopt.neighborhood = { note: getVal('qaNeighborhoodNote'), photos: snapshotBucket('neighborhood') };
        qData.adopt.pets         = { note: getVal('qaPetsNote'),         photos: snapshotBucket('pets') };
      } else if (recruit) {
        qData.recruit.keyStats            = getVal('qrKeyStats');
        qData.recruit.awards              = getVal('qrAwards');
        qData.recruit.varsityYears        = getVal('qrVarsityYears');
        qData.recruit.teamAccomplishments = getVal('qrTeamAccomplishments');
        // Structured measurables — each row has name, value, status (verified/self), source
        qData.recruit.measurables         = collectRecruitMeasurables();
        qData.recruit.combineNotes        = getVal('qrCombineNotes');
        // Upcoming schedule (NEW — where coaches can watch in person)
        qData.recruit.upcomingSchedule    = getVal('qrUpcomingSchedule');
        // Recruiting goals (NCAA ID moved to Step 2)
        qData.recruit.divisionsInterest   = getVal('qrDivisionsInterest');
        qData.recruit.schoolsInterest     = getVal('qrSchoolsInterest');
        qData.recruit.campsAttended       = getVal('qrCampsAttended');
      } else {
        qData.pages = Array.from(
          document.querySelectorAll('#qPanel3 input[name="qPages"]:checked')
        ).map(cb => cb.value);
        qData.vibe      = getVal('qVibe');
        qData.mustHaves = getVal('qMustHaves');
      }
      break;
    case 4:
      if (adopt) {
        qData.adopt.moments       = snapshotBucket('moments');
        qData.adopt.agency        = getVal('qaAgency');
        qData.adopt.caseworker    = getVal('qaCaseworker');
        qData.adopt.fundraising   = {
          platform: getVal('qaFundraisingType'),
          url:      getVal('qaFundraisingUrl'),
        };
        qData.adopt.contactEmail  = getVal('qaContactEmail');
        qData.adopt.contactPhone  = getVal('qaContactPhone');
        qData.adopt.anythingElse  = getVal('qaAnythingElse');
      } else if (recruit) {
        qData.recruit.hsHeadCoach = {
          name:  getVal('qrHsHeadCoachName'),
          email: getVal('qrHsHeadCoachEmail'),
          phone: getVal('qrHsHeadCoachPhone'),
        };
        qData.recruit.clubTeam = {
          name:       getVal('qrClubTeamName'),
          coachName:  getVal('qrClubCoachName'),
          coachEmail: getVal('qrClubCoachEmail'),
          coachPhone: getVal('qrClubCoachPhone'),
        };
        qData.recruit.additionalReferences = getVal('qrAdditionalReferences');
        // Primary highlight video (single most important reel — separate from additional)
        qData.recruit.primaryHighlightVideo = getVal('qrPrimaryHighlightVideo');
        qData.recruit.highlightVideos      = splitLines(getVal('qrHighlightVideos'));
        qData.recruit.gameFilm             = splitLines(getVal('qrGameFilm'));
        // Character references (non-coach: trainers, teachers, mentors)
        qData.recruit.characterReferences  = collectRecruitReferences();
        qData.recruit.social = {
          instagram:   getVal('qrInstagram'),
          twitter:     getVal('qrTwitter'),
          tiktok:      getVal('qrTiktok'),
          youtube:     getVal('qrYoutube'),
          hudl:        getVal('qrHudl'),
          otherSocial: getVal('qrOtherSocial'),
        };
        qData.recruit.contact = {
          athleteEmail: getVal('qrAthleteEmail'),
          athletePhone: getVal('qrAthletePhone'),
          parentName:   getVal('qrParentName'),
          parentEmail:  getVal('qrParentEmail'),
          parentPhone:  getVal('qrParentPhone'),
        };
        qData.recruit.athleteStatement = getVal('qrAthleteStatement');
      } else {
        qData.website    = getVal('qWebsite');
        qData.facebook   = getVal('qFacebook');
        qData.instagram  = getVal('qInstagram');
        qData.otherLinks = getVal('qOtherLinks');
      }
      break;
    case 5: {
      // qPalette is the NAME of a radio group, not an element id —
      // read the currently-checked radio rather than getVal().
      const selected = document.querySelector('input[name="qPalette"]:checked');
      const choice   = selected ? selected.value : '';
      qData.paletteChoice = choice;
      qData.paletteColors = choice && PALETTES[choice] ? PALETTES[choice] : null;
      break;
    }
    case 6:
      // ┌──────────────────────────────────────────────────────────────┐
      // │  PLUG-IN POINT: Upload files to Supabase Storage here        │
      // │  For now, store metadata (captions + file count) only        │
      // └──────────────────────────────────────────────────────────────┘
      if (recruit) {
        qData.recruit.headshot    = snapshotRecruitBucket('headshot');
        qData.recruit.actionShots = snapshotRecruitBucket('actionShots');
        qData.recruit.teamPhotos  = snapshotRecruitBucket('teamPhotos');
        qData.photos              = []; // recruit uses per-category buckets, not the single uploader
        qData.photoCount          = qData.recruit.headshot.length + qData.recruit.actionShots.length + qData.recruit.teamPhotos.length;
      } else {
        qData.photos = Object.entries(qPhotoFiles).map(([_, { file, caption, objectUrl }]) => ({
          filename: file.name,
          size: file.size,
          type: file.type,
          caption: caption,
          objectUrl: objectUrl
        }));
        qData.photoCount = Object.keys(qPhotoFiles).length;
      }
      break;
    case 8:
      qData.tier = qSelectedTier
        ? { id: qSelectedTier.id, name: qSelectedTier.name, price: qSelectedTier.price }
        : null;
      break;
  }
}

// Validate step-specific required fields:
//   Step 1: name, site type, email (all required for all flows)
//   Step 2: adoption letter (required for adoption flow only)
//   Step 4: athlete statement (required for recruiting flow only)
// Other steps are low-friction (optional).
function qValidateStep(step) {
  clearQErrors();
  let valid = true;

  // ── Step 1: Contact info (required for all flows) ───────────────────────
  if (step === 1) {
    if (!getVal('qName')) {
      showQError('qNameError', 'Please enter your name or business name.');
      valid = false;
    }
    if (!getVal('qSiteType')) {
      showQError('qSiteTypeError', 'Please choose the type of site.');
      valid = false;
    }
    const email = getVal('qEmail');
    if (!email) {
      showQError('qEmailError', 'Email is required. We need this to contact you about your project.');
      valid = false;
    } else if (!validateEmail(email)) {
      showQError('qEmailError', 'Please enter a valid email address (e.g. you@example.com).');
      valid = false;
    }
  }

  // ── Step 2: Adoption letter (required for adoption only) ────────────────
  if (step === 2 && isAdoptionFlow()) {
    if (!getVal('qaLetter')) {
      showQError('qaLetterError', 'Share your heart with prospective birth parents. This letter is a key part of your profile.');
      valid = false;
    }
  }

  // ── Step 4: Recruiting athlete statement (required for recruiting only) ───
  if (step === 4 && isRecruitFlow()) {
    if (!getVal('qrAthleteStatement')) {
      showQError('qrAthleteStatementError', 'Tell coaches why you play, your goals, and your work ethic. This is how they get to know you.');
      valid = false;
    }
  }

  // Shake the first errored field on invalid
  if (!valid) {
    const firstErr = document.querySelector('.q-error:not(:empty)');
    firstErr?.previousElementSibling?.classList.add('q-shake');
    setTimeout(() => document.querySelector('.q-shake')?.classList.remove('q-shake'), 500);
  }

  return valid;
}


// ════════════════════════════════════════════════════════════════════════════
//  OWNER ADMIN VIEW — Hidden behind portal.html#admin
//  Lists saved build prompts so the studio owner can copy them out.
// ════════════════════════════════════════════════════════════════════════════

function initAdminView() {
  // If the user lands on portal.html#admin, show the owner view
  // immediately. Also react to in-page hash changes.
  if (window.location.hash === '#admin') showAdminView();
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#admin') showAdminView();
    else hideAdminView();
  });
}


// ════════════════════════════════════════════════════════════════════════════
//  TEMP TESTING — Owner setup-page access (REMOVE / LOCK DOWN BEFORE LAUNCH)
//  ─────────────────────────────────────────────────────────────────────────
//  Two reliable ways to reach the owner-only setup page during testing:
//
//    1. URL:  portal.html#setup
//       Typing this in the address bar (or following a link) redirects
//       straight to /setup.html.
//
//    2. Keyboard shortcut: Ctrl+Shift+S (Cmd+Shift+S on Mac)
//       From any portal page, this jumps to /setup.html.
//
//  BEFORE LAUNCH: replace this whole function with a real auth gate
//  (e.g. only show the link when the signed-in user matches the owner
//  Supabase user ID). Until then the setup page is unauthenticated and
//  the only thing keeping clients out is obscurity — fine for local
//  testing, NOT fine for production.
// ════════════════════════════════════════════════════════════════════════════

function initTempSetupAccess() {
  // Hash route — typing portal.html#setup in the address bar redirects
  // to the setup page. (The keyboard shortcut is wired globally in main.js
  // so it works from index.html and setup.html too.)
  if (window.location.hash === '#setup') {
    window.location.href = '/setup.html';
    return;
  }
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#setup') {
      window.location.href = '/setup.html';
    }
  });
}

function showAdminView() {
  hide('portalStage');
  hide('questionnaireSection');
  show('ownerAdminView');
  renderAdminSubmissions();
  window.scrollTo({ top: 0 });
}

function hideAdminView() {
  hide('ownerAdminView');
  // Bring the regular portal flow back — auth or dashboard depending
  // on session state.
  show('portalStage');
}

async function renderAdminSubmissions() {
  const list = document.getElementById('adminSubmissionsList');
  if (!list) return;

  list.innerHTML = '<p class="admin-empty">Loading submissions…</p>';

  // Fetch from Supabase first (the source of truth; RLS lets the owner
  // see all rows, while non-owner authenticated users see only their own).
  let submissions = [];
  let fetchError  = null;
  const { data, error } = await sbClient
    .from('submissions')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    fetchError = error;
    // Fallback: show the localStorage backup so the owner is never blind.
    const local = getLocalStorage(OWNER_PROMPTS_KEY, []) || [];
    submissions = local.slice().reverse().map(s => ({
      name:        s.name || s.contact?.name  || s.contactName || '',
      email:       s.email || s.contact?.email || s.contactEmail || '',
      submittedAt: s.submittedAt,
      buildPrompt: s.buildPrompt,
    }));
  } else {
    submissions = (data || []).map(row => ({
      name:        row.user_name  || row.q_data?.contact?.name  || '',
      email:       row.user_email || row.q_data?.contact?.email || '',
      submittedAt: row.submitted_at,
      buildPrompt: row.build_prompt,
    }));
  }

  list.innerHTML = '';

  if (fetchError) {
    const warn = document.createElement('p');
    warn.className = 'admin-empty';
    warn.style.color = '#a85a3c';
    warn.textContent = `Supabase: ${fetchError.message} — showing local backup.`;
    list.appendChild(warn);
  }

  if (!submissions.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = 'No submissions yet.';
    list.appendChild(empty);
    return;
  }

  submissions.forEach((s, idx) => {
    const article = document.createElement('article');
    article.className = 'admin-submission';

    const headerHtml = `
      <div class="admin-submission-head">
        <div class="admin-submission-meta">
          <h3>${escapeHtml(s.name || 'Untitled')}</h3>
          <p>
            <span>${escapeHtml(s.email || 'no email')}</span>
            <span aria-hidden="true"> · </span>
            <time>${escapeHtml(formatSubmittedAt(s.submittedAt))}</time>
          </p>
        </div>
        <button type="button" class="copy-prompt-btn admin-copy-btn" data-idx="${idx}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy Prompt</span>
        </button>
      </div>
    `;
    article.innerHTML = headerHtml;

    const pre = document.createElement('pre');
    pre.className = 'build-prompt admin-build-prompt';
    pre.textContent = s.buildPrompt || '(no prompt saved)';
    article.appendChild(pre);

    attachCopyHandler(
      article.querySelector('.admin-copy-btn'),
      () => s.buildPrompt || ''
    );

    list.appendChild(article);
  });
}

function formatSubmittedAt(iso) {
  if (!iso) return 'unknown date';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}


// ════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════════════════

function getVal(id) {
  return (document.getElementById(id)?.value ?? '').trim();
}

function getCheckedVals(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
    .map(cb => cb.value);
}

function showQError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearQErrors() {
  document.querySelectorAll('.q-error').forEach(el => el.textContent = '');
}

// ── Auth error helpers ─────────────────────────────────────────────────────

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function showFormError(msg) { showFieldError('formError', msg); }

function clearAllErrors() {
  ['nameError','emailError','passwordError','confirmError','formError']
    .forEach(id => showFieldError(id, ''));
}

// ── DOM helpers ────────────────────────────────────────────────────────────

function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

// ── Validation ─────────────────────────────────────────────────────────────

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function titleCase(str) {
  return String(str).replace(/\b\w/g, c => c.toUpperCase());
}
