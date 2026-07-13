/*
  Front Porch Web — Cloudflare Worker upload endpoint
  ─────────────────────────────────────────────────────────────────────
  Receives photo uploads from the portal and stores them in R2.

  Security model:
    • R2 access is via the `UPLOADS` binding (see wrangler.toml). The
      Worker does NOT hold any S3 keys — Cloudflare wires up the binding
      at deploy time. The R2 Access Key ID and Secret Access Key never
      leave Cloudflare's control panel.
    • User identity is verified by forwarding the user's Supabase access
      token to Supabase's /auth/v1/user endpoint. The endpoint only
      succeeds if the token is valid and unexpired. If it succeeds we get
      back the user_id, which becomes part of the R2 key prefix.

  Routes:
    POST /upload         multipart/form-data → uploads one file
    OPTIONS /upload      CORS preflight
    GET  /healthz        simple health check

  Required env (set in wrangler.toml [vars] — these are NOT secrets):
    SUPABASE_URL                 e.g. https://hxxtsthfqwyvkyuwnnsu.supabase.co
    SUPABASE_PUBLISHABLE_KEY     the public/anon key (safe to expose)
    ALLOWED_ORIGINS              comma-separated list, e.g.
                                   http://localhost:5500,https://frontporchweb.com

  Required binding (also wrangler.toml):
    UPLOADS                      R2 bucket binding → frontporchweb-uploads
*/

function parseAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, allowList) {
  const allow = allowList.includes(origin) ? origin : allowList[0] || '*';
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin',
  };
}

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// Allow letters, numbers, dot, dash, underscore. Everything else → underscore.
// Trim to 80 chars so we never produce overly long R2 keys.
function sanitizeSegment(name, fallback) {
  const safe = String(name || '').replace(/[^\w.\-]/g, '_').slice(0, 80);
  return safe || fallback;
}

// Photo uploads only. Caps storage abuse from an authenticated account.
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB — generous for a phone photo
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']);

async function verifyUser(authHeader, env) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey:        env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const url        = new URL(request.url);
    const origin     = request.headers.get('Origin') || '';
    const allowList  = parseAllowedOrigins(env);
    const baseCors   = corsHeaders(origin, allowList);

    // ── CORS preflight ─────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: baseCors });
    }

    // ── Health check ───────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/healthz') {
      return json({ ok: true }, 200, baseCors);
    }

    // ── Only POST /upload from here on ─────────────────────────────────
    if (request.method !== 'POST' || url.pathname !== '/upload') {
      return json({ error: 'Not found' }, 404, baseCors);
    }

    // 1) Verify caller
    const user = await verifyUser(request.headers.get('Authorization'), env);
    if (!user || !user.id) {
      return json({ error: 'Unauthorized — please sign in again.' }, 401, baseCors);
    }

    // 2) Fast-reject oversized bodies before buffering them into memory
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength && declaredLength > MAX_FILE_BYTES * 1.5) {
      return json({ error: 'File is too large. Max 15 MB per photo.' }, 413, baseCors);
    }

    // 3) Parse multipart form
    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: 'Invalid form data' }, 400, baseCors);
    }

    const file         = form.get('file');
    const submissionId = String(form.get('submissionId') || '').trim();
    const category     = sanitizeSegment(form.get('category'), 'misc');
    const filename     = sanitizeSegment(
      form.get('filename') || (file && file.name),
      'photo.bin'
    );

    if (!file || typeof file === 'string') {
      return json({ error: 'Missing file field.' }, 400, baseCors);
    }
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(submissionId)) {
      return json({ error: 'Invalid or missing submissionId.' }, 400, baseCors);
    }
    if (file.size > MAX_FILE_BYTES) {
      return json({ error: 'File is too large. Max 15 MB per photo.' }, 413, baseCors);
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return json({ error: 'Only photo uploads (JPEG, PNG, WEBP, HEIC, GIF) are allowed.' }, 415, baseCors);
    }

    // 4) Build key and upload to R2
    //    Key layout: submissions/{user_id}/{submission_id}/{category}/{ts}-{filename}
    const ts  = Date.now();
    const key = `submissions/${user.id}/${submissionId}/${category}/${ts}-${filename}`;

    try {
      await env.UPLOADS.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
        customMetadata: {
          userId:       user.id,
          submissionId,
          originalName: (file.name || filename).slice(0, 200),
        },
      });
    } catch (e) {
      return json({ error: `R2 upload failed: ${e.message}` }, 502, baseCors);
    }

    return json({ key, bytes: file.size }, 200, baseCors);
  },
};
