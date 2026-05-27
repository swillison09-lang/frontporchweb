# Front Porch Web — Upload Worker

A Cloudflare Worker that accepts photo uploads from the portal and stores
them in the `frontporchweb-uploads` R2 bucket.

## What lives here

- `upload-worker.js` — the Worker code
- `wrangler.toml` — Worker config (bindings, env vars). **No secrets.**

## Security model

- **R2 access** is granted via the `UPLOADS` binding in `wrangler.toml`.
  The Worker never sees an R2 Access Key ID or Secret. You don't need to
  put those anywhere in this project. (Keep them in 1Password or similar
  if you need them for other tools.)
- **User identity** is verified by forwarding the caller's Supabase access
  token to `${SUPABASE_URL}/auth/v1/user`. If Supabase says it's a valid
  token, we trust the `user.id` it returns and use it as the R2 key prefix.

## One-time setup

You need the Cloudflare CLI (`wrangler`) installed and logged in.

```bash
# from anywhere
npm install -g wrangler
wrangler login        # opens your browser for OAuth
```

## Deploy

```bash
cd worker
wrangler deploy
```

`wrangler` reads `wrangler.toml`, sets up the R2 binding, and prints the
deployed URL — something like:

    https://frontporchweb-uploads.<your-subdomain>.workers.dev

Copy that URL — you'll paste it into `js/r2-upload.js` as `R2_UPLOAD_ENDPOINT`.

## Dev (local)

```bash
cd worker
wrangler dev
```

This starts a local Worker on `http://localhost:8787`. Point
`R2_UPLOAD_ENDPOINT` at it while testing.

## Updating ALLOWED_ORIGINS

`ALLOWED_ORIGINS` in `wrangler.toml` controls the CORS allow-list. Edit
the comma-separated value, then re-deploy. Examples:

```toml
ALLOWED_ORIGINS = "http://localhost:5500,https://frontporchweb.com"
```

Only origins on this list will receive the `Access-Control-Allow-Origin`
header — uploads from other origins fail at the browser before the
Worker even runs the upload logic.

## R2 bucket CORS

If you ONLY hit the bucket through this Worker (which is the case here),
**you do not need to set CORS rules on the R2 bucket itself.** The browser
talks to the Worker, and the Worker talks to R2 in-network. No browser →
R2 cross-origin requests.

You would only need bucket-side CORS if you switch to presigned URLs
later (browser → R2 directly).

## Endpoints

- `POST /upload` — multipart form-data
  - **Headers:** `Authorization: Bearer <supabase access_token>`
  - **Fields:** `file`, `submissionId`, `category`, `filename`
  - **Response:** `{ "key": "submissions/<user>/<submission>/<cat>/...", "bytes": 12345 }`
- `OPTIONS /upload` — CORS preflight
- `GET /healthz` — `{ "ok": true }` for sanity-checking the deployment
