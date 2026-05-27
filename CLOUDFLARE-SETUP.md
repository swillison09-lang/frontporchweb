# Cloudflare R2 Setup — Step by Step

Everything you must do in the Cloudflare dashboard / CLI to make photo
uploads work. Follow these in order.

## 1. Confirm the R2 bucket exists

You said you already have **`frontporchweb-uploads`** in account
`9e2e1a3b326fc1a4ccfb893f6d36c11a`. In the Cloudflare Dashboard:

1. Go to **R2 → Overview**.
2. Verify the bucket name matches exactly: `frontporchweb-uploads`. If
   you renamed it, also update `worker/wrangler.toml` line:
   `bucket_name = "frontporchweb-uploads"`.

## 2. Install Wrangler (the Worker CLI) and log in

On your machine:

```bash
npm install -g wrangler
wrangler login
```

`wrangler login` opens a browser tab — confirm in your Cloudflare
account. Verify with:

```bash
wrangler whoami
```

## 3. Deploy the Worker

From the project root:

```bash
cd worker
wrangler deploy
```

`wrangler` reads `worker/wrangler.toml`, attaches the R2 binding, and
deploys. The output prints the live Worker URL — something like:

```
Published frontporchweb-uploads (X.XX sec)
  https://frontporchweb-uploads.<your-subdomain>.workers.dev
```

**Copy that full URL.** You'll need it in the next step.

If `wrangler deploy` complains that the R2 binding doesn't exist, run:

```bash
wrangler r2 bucket list
```

and confirm `frontporchweb-uploads` appears. If not, the bucket isn't in
the same Cloudflare account you logged into.

## 4. Paste the Worker URL into the frontend

Open `js/r2-upload.js` and change:

```js
const R2_UPLOAD_ENDPOINT = 'https://frontporchweb-uploads.your-account.workers.dev/upload';
```

to your real URL **with `/upload` appended**:

```js
const R2_UPLOAD_ENDPOINT = 'https://frontporchweb-uploads.acme-co.workers.dev/upload';
```

Save the file. Refresh portal.html in the browser.

## 5. Sanity-check the deployment

Hit the health endpoint from your terminal (or just paste it in a
browser tab):

```bash
curl https://frontporchweb-uploads.<your-subdomain>.workers.dev/healthz
```

Expected response:

```json
{"ok":true}
```

## 6. (Optional) Test the upload flow

1. Open the portal in your browser, sign in.
2. Start a questionnaire and add some photos.
3. Submit.

You should see the **"Uploading your photos…"** overlay with a progress
bar, then the success panel. In the Cloudflare dashboard, open the R2
bucket — you'll see a `submissions/<your_user_id>/<submission_id>/...`
folder structure with your photos.

If the overlay shows an error, the message is exact — usually one of:

- *"You are signed out. Please sign in and try again."* — your Supabase
  session expired. Sign out and back in.
- *"Unauthorized — please sign in again."* — the Worker reached
  Supabase but the token wasn't valid.
- *"Network error during upload."* — CORS most likely. Make sure your
  current origin (e.g. `http://localhost:5500`) is in
  `ALLOWED_ORIGINS` inside `wrangler.toml`, then redeploy.

## 7. CORS — do I need to touch the R2 bucket?

**No.** The browser uploads go to the Worker, and the Worker talks to R2
through its binding (internal, no CORS). You'd only need to set
bucket-side CORS if you switched to presigned URLs (browser → R2
direct).

The Worker handles CORS in code — see `ALLOWED_ORIGINS` in
`worker/wrangler.toml`. Add new origins (e.g. your production domain) to
that comma-separated list and run `wrangler deploy` again.

## 8. Production domain checklist

Before you ship:

- [ ] Add your production domain to `ALLOWED_ORIGINS` in
  `worker/wrangler.toml` (e.g. `https://frontporchweb.com`) and
  redeploy.
- [ ] In Supabase Dashboard → **Authentication → URL Configuration →
  Redirect URLs**, add `https://frontporchweb.com/portal.html`.
- [ ] Decide how the owner views uploaded photos. Two options:
  - **Option A (private bucket):** add a `/download?key=...` route to
    the Worker that streams the object after verifying the caller is the
    owner. Most secure.
  - **Option B (public r2.dev or custom domain):** turn on public access
    for the bucket in R2 settings and serve photos directly. Simpler but
    every URL is publicly guessable.

## 9. What's safe to commit, what's not

| File | Commit to git? | Why |
|---|---|---|
| `worker/upload-worker.js` | ✅ | Source code, no secrets |
| `worker/wrangler.toml` | ✅ | URL + publishable key only; binding is a reference, not a secret |
| `js/supabase-client.js` | ✅ | Publishable key only |
| `js/r2-upload.js` | ✅ | Worker URL is public |
| R2 Access Key ID / Secret | ❌ | NOT used anywhere in this code |
| Supabase `service_role` key | ❌ | NOT used anywhere in this code |
| Google OAuth client secret | ❌ | Belongs only in Supabase Dashboard |

If you ever need to use the R2 S3 keys (for backups, migrations, etc.),
keep them in a password manager — never in this repo.
