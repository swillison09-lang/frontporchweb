-- ════════════════════════════════════════════════════════════════════════════
--  Front Porch Web — Supabase schema for the `submissions` table
--
--  HOW TO USE:
--    1. Open your Supabase dashboard for this project.
--    2. Go to: SQL Editor → New query.
--    3. Paste this whole file and click Run.
--    4. IMPORTANT: change the owner email in the "owner reads all" policy
--       below to YOUR email before running (defaulted to swillison09@gmail.com).
--
--  This creates:
--    • public.submissions       — one row per finished questionnaire
--    • RLS policies             — each user sees only their own rows,
--                                 owner email sees all rows
--    • Two indexes              — fast lookup by user and by date
-- ════════════════════════════════════════════════════════════════════════════


-- ─── Table ────────────────────────────────────────────────────────────────
create table if not exists public.submissions (
  -- Client-generated UUID. The same id is used as the R2 folder name
  -- (submissions/{user_id}/{id}/...) so a row and its photos stay linked.
  id            uuid        primary key default gen_random_uuid(),

  -- Who submitted (links to Supabase auth.users)
  user_id       uuid        not null references auth.users(id) on delete cascade,
  user_email    text,                   -- snapshot for owner readability
  user_name     text,                   -- snapshot for owner readability

  -- When
  submitted_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),

  -- High-level fields pulled out for easy filtering/searching
  site_type     text,                   -- 'local-business' | 'adoption-profile' | 'recruiting-profile' | 'personal-other'
  tier          text,                   -- chosen pricing tier name

  -- Owner-only assembled prompt
  build_prompt  text,

  -- Full questionnaire payload and chosen palette
  q_data        jsonb,
  palette       jsonb,

  -- Photo metadata. Binary lives in R2 (frontporchweb-uploads).
  -- Shape:
  --   {
  --     "generic": [ { key, filename, caption, size, type }, ... ],
  --     "adopt":   { "homeOutside": { note, photos: [...] }, "moments": [...] , ... },
  --     "recruit": { "headshot": [...], "actionShots": [...], "teamPhotos": [...] }
  --   }
  -- `key` is the R2 object key, e.g.
  --   submissions/<user_id>/<submission_id>/<category>/<ts>-<filename>
  photos        jsonb
);


-- ─── Indexes ──────────────────────────────────────────────────────────────
create index if not exists submissions_user_id_idx
  on public.submissions (user_id);

create index if not exists submissions_submitted_at_idx
  on public.submissions (submitted_at desc);


-- ─── Row Level Security ───────────────────────────────────────────────────
-- RLS is what actually protects the data: the publishable/anon key shipped
-- to the browser can ONLY perform operations that pass these policies.
alter table public.submissions enable row level security;

-- Drop existing policies first so this script is idempotent
drop policy if exists "users insert own submissions" on public.submissions;
drop policy if exists "users read own submissions"   on public.submissions;
drop policy if exists "owner reads all submissions"  on public.submissions;

-- A signed-in user can INSERT a row only if user_id = their own auth uid
create policy "users insert own submissions"
  on public.submissions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- A signed-in user can SELECT only their own rows
create policy "users read own submissions"
  on public.submissions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- The owner (you) can SELECT every row.
--   👉 REPLACE the email below with YOUR Supabase login email.
create policy "owner reads all submissions"
  on public.submissions
  for select
  to authenticated
  using (auth.jwt() ->> 'email' = 'swillison09@gmail.com');
