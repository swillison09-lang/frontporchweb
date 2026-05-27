/*
  Front Porch Web — Supabase client initialization
  Loaded BEFORE portal.js so window.sbClient is available everywhere.

  ─────────────────────────────────────────────────────────────────────
  What is safe to expose in this file (frontend / git)?
  ─────────────────────────────────────────────────────────────────────
  SAFE — these values are intended for frontend code:
    • SUPABASE_URL .................. public project URL
    • SUPABASE_PUBLISHABLE_KEY ...... a.k.a. anon key. Only allows the
                                     operations your Row Level Security
                                     policies permit. RLS is what
                                     actually protects your data.

  NEVER PUT IN FRONTEND CODE:
    • service_role key (sb_secret_...) — bypasses RLS, full admin
    • Postgres connection password ..... direct DB access
    • Google OAuth client_secret ....... lives ONLY in
                                         Supabase Dashboard → Auth →
                                         Providers → Google
  ─────────────────────────────────────────────────────────────────────
*/

const SUPABASE_URL              = 'https://hxxtsthfqwyvkyuwnnsu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY  = 'sb_publishable_PfXE01_bSpA1CnTKg7nbHA_5w7_iJJR';

// The CDN script exposes `window.supabase` as the namespace
// (containing `createClient`). We make the actual client instance
// available globally as `window.sbClient` so portal.js can use it.
window.sbClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession:     true,   // keep session in localStorage across reloads
      autoRefreshToken:   true,   // refresh JWTs before they expire
      detectSessionInUrl: true,   // parse OAuth callback (?code=... or #access_token=...)
    },
  }
);
