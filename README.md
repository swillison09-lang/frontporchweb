# Front Porch Web, LLC — Static Website

A fast, lightweight, fully responsive website for Front Porch Web's web design business. Built with plain HTML, CSS, and JavaScript — no framework, no build step, deploys to Cloudflare Pages in minutes.

---

## Project Structure

```
frontporchweb/
├── index.html               # Marketing hub (hero, demos, how-it-works, pricing, footer)
├── portal.html              # Client portal (sign-in, dashboard, 8-step questionnaire)
├── setup.html               # Owner-only — business types & pricing CRUD
├── supabase-schema.sql      # SQL to paste into the Supabase SQL editor on first setup
├── css/
│   ├── theme.css            # Brand colors, fonts, and shared CSS variables
│   └── styles.css           # Layout, components, and responsive rules
├── js/
│   ├── main.js              # Shared utilities (nav toggle, scroll-reveal, smooth scroll)
│   ├── supabase-client.js   # Supabase client init (publishable key only — safe to commit)
│   ├── r2-upload.js         # Photo upload client — sends to the Cloudflare Worker
│   ├── portal.js            # Portal auth, questionnaire logic, Stripe payment step
│   └── setup.js             # Owner setup page (business types, pricing tiers)
├── worker/
│   ├── upload-worker.js     # Cloudflare Worker — proxies photo uploads to R2
│   ├── wrangler.toml        # Worker config (no secrets — R2 access is via binding)
│   └── README.md            # Worker-specific notes
├── assets/
│   ├── logo.png             # Round badge logo
│   └── demos/               # Demo site screenshots
├── demos/                   # HTML demo pages linked from index.html
├── CLOUDFLARE-SETUP.md      # Step-by-step R2 + Worker setup
└── README.md                # This file
```

---

## Run Locally

No build step required. Open any HTML file directly in a browser, **or** use a local server to avoid path-relative quirks:

```bash
# Python (built-in, any OS)
cd frontporchweb
python -m http.server 8080
# → open http://localhost:8080

# Node
npx serve .
# → open http://localhost:3000

# VS Code
# Install "Live Server" → right-click index.html → Open with Live Server
```

Add `http://localhost:8080` (or whatever port you use) to `worker/wrangler.toml`'s `ALLOWED_ORIGINS` so photo uploads work in dev, then `cd worker && npx wrangler dev` to run the Worker locally.

---

## Services Overview

| Service | What it does | Where the secret lives |
|---|---|---|
| **Supabase** | Auth (Google OAuth + email) + questionnaire storage | Supabase Dashboard only — publishable key in `js/supabase-client.js` is safe |
| **Cloudflare R2** | Photo storage | R2 binding in wrangler.toml — no S3 key ever in the repo |
| **Cloudflare Worker** | Proxy between browser and R2 | `worker/` — deploy with `wrangler deploy`, not via Pages |
| **Stripe** | 50% deposit payments at Step 8 | Test Payment Link URLs in `js/portal.js` — safe to commit; secret keys stay in Stripe dashboard |

---

## Deployment

### 1. First-time setup

#### a) Supabase

1. In your Supabase project → **SQL Editor** → paste the contents of `supabase-schema.sql` and run it. This creates the `submissions` table and RLS policies.
2. In **Authentication → URL Configuration**:
   - **Site URL:** `https://frontporchweb.com` (your production domain)
   - **Redirect URLs:** add both `https://frontporchweb.com/portal.html` and `http://localhost:8080/portal.html` (for local dev)
3. In **Authentication → Providers → Google**: paste your Google OAuth client ID and secret. (These stay in the Supabase dashboard — never in this repo.)

#### b) Cloudflare Worker (R2 photo uploads)

Follow `CLOUDFLARE-SETUP.md` in full. Short version:

```bash
npm install -g wrangler
wrangler login

cd worker
wrangler deploy
# Note the printed URL: https://frontporchweb-uploads.<subdomain>.workers.dev
```

Then open `js/r2-upload.js` and set `R2_UPLOAD_ENDPOINT` to that URL + `/upload`.

In `worker/wrangler.toml`, add your production domain to `ALLOWED_ORIGINS`:

```toml
ALLOWED_ORIGINS = "http://localhost:8080,http://127.0.0.1:5500,https://frontporchweb.com"
```

Redeploy: `wrangler deploy` again.

#### c) Stripe

All 12 Payment Links are already configured in `js/portal.js` in TEST mode. For each link in the Stripe dashboard, set **After payment → Redirect to**:

```
https://frontporchweb.com/portal.html?fpw=success&sid={CHECKOUT_SESSION_ID}
```

(Use `{CHECKOUT_SESSION_ID}` literally — Stripe substitutes it.)

---

### 2. Deploy to Cloudflare Pages

The main site (`index.html`, `portal.html`, `setup.html`) is a **static site** — no build step.

1. Push this repo to GitHub.
2. Log in to [Cloudflare Pages](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select your GitHub repo.
4. **Build settings:**
   - Build command: *(leave blank)*
   - Build output directory: `/` *(repo root)*
5. Click **Save and Deploy**.

The site is live at `your-project.pages.dev` in ~30 seconds.

> **Note:** The Cloudflare Worker (`worker/`) is **not** deployed via Pages. It deploys separately via `wrangler deploy` and lives at `*.workers.dev`. Pages hosts only the HTML/CSS/JS files.

---

### 3. Connect a custom domain

1. In Cloudflare Pages → your project → **Custom domains** → **Set up a custom domain**.
2. Enter `frontporchweb.com`.
3. If your domain is already on Cloudflare DNS (recommended), it auto-provisions. Otherwise follow the DNS instructions Cloudflare shows.

After the domain is connected:

- Return to Supabase and confirm the **Site URL** and **Redirect URLs** match your live domain (step 1a above).
- Confirm the Stripe Payment Link success URL uses the live domain (step 1c above).

---

### 4. Ongoing deployments

Push to `main` (or whatever branch you connected). Cloudflare Pages auto-deploys on every push — no CI config required.

For Worker changes: `cd worker && wrangler deploy` from your terminal.

---

## Questionnaire Flow

The client portal (`portal.html`) walks users through an 8-step brief:

| Step | Panel | What's collected |
|------|-------|-----------------|
| 1 | About You | Name, site type, email (required), phone (optional) |
| 2 | Your Story | Tagline, key facts, services, feeling/message |
| 3 | Style & Pages | Page checkboxes, overall vibe, must-haves |
| 4 | Links & Media | Links, photos, recruiting/adoption-specific fields |
| 5 | Colors | One of four preset color palettes |
| 6 | Photos | Drag-and-drop upload + captions |
| 7 | Review | Full summary with "Edit" links back to any step |
| 8 | Payment | Tier selection + Pay & Submit → Stripe redirect |

On Pay & Submit: photos upload to R2, the full submission saves to Supabase, then the client is redirected to the matching Stripe Payment Link (50% deposit). After payment, Stripe returns the client to `portal.html?fpw=success`.

---

## Owner Setup Page (`setup.html`)

The pricing tiers on Step 8 come from `setup.html` — an owner-only CRUD page. Navigate there directly:

```
https://frontporchweb.com/setup.html
```

Business types and tier data are stored in `localStorage` under `frontporch_business_types`. Each business type maps to one or more Step-1 site types (`local-business`, `adoption-profile`, `recruiting-profile`, `personal-other`) and carries 2–4 pricing tiers with names that **must match** the Stripe Payment Link map in `js/portal.js` (case-insensitive) for payment redirect to work.

---

## Browser Support

Modern evergreen browsers (Chrome, Firefox, Safari, Edge). Uses CSS Grid, Flexbox, `color-mix()`, and `clamp()` — all supported in browsers released after mid-2023.

---

*Websites Built on Trust — © 2026 Front Porch Web, LLC*
