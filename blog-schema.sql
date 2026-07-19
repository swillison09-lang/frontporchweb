-- ════════════════════════════════════════════════════════════════════════════
--  Front Porch Web — blog schema
--
--  HOW TO USE:
--    1. Open your Supabase dashboard for this project.
--    2. SQL Editor → New query.
--    3. Paste this whole file and click Run. Safe to re-run.
--
--  This creates:
--    • public.posts         — blog posts, one row per post, per client site
--    • public.site_editors  — who may edit which client site's blog
--    • RLS policies         — the public reads published posts only; an editor
--                             touches only their own site; the owner sees all
--
--  PERMISSION MODEL
--    - Anyone (not signed in) can READ posts where status = 'published'.
--    - A signed-in user can WRITE posts only for sites listed for their email
--      in site_editors.
--    - The owner (Sean) can do anything to any site.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── Owner ────────────────────────────────────────────────────────────────
-- Single place to change who the owner is. Used by every policy below.
create or replace function public.fpw_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'swillison09@gmail.com',
    'swillison@motoringlabs.com',
    'frontporchwebllc@gmail.com'
  );
$$;


-- ─── Who can edit which site ──────────────────────────────────────────────
create table if not exists public.site_editors (
  id          uuid        primary key default gen_random_uuid(),
  -- Matches the client site's folder name, e.g. 'hartman-plumbing'
  -- (the site lives at frontporchwebllc.com/clients/<site_slug>/).
  site_slug   text        not null,
  -- Lower-cased email of the person allowed to edit that site's blog.
  user_email  text        not null,
  -- Friendly label shown in the admin site picker.
  site_name   text,
  created_at  timestamptz not null default now(),
  unique (site_slug, user_email)
);

create index if not exists site_editors_email_idx on public.site_editors (user_email);
create index if not exists site_editors_slug_idx  on public.site_editors (site_slug);


-- Helper: may the current user edit this site?
create or replace function public.fpw_can_edit_site(target_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fpw_is_owner()
      or exists (
           select 1
           from public.site_editors se
           where se.site_slug = target_slug
             and lower(se.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         );
$$;


-- ─── Posts ────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id            uuid        primary key default gen_random_uuid(),
  site_slug     text        not null,

  title         text        not null,
  -- URL-safe identifier, unique per site: /clients/<site_slug>/#post/<slug>
  slug          text        not null,
  excerpt       text,

  -- body_md is what the editor types and edits.
  -- body_html is rendered once on save so client sites need no markdown
  -- library and render instantly. Raw HTML is escaped before rendering,
  -- so a post cannot inject script into a client's site.
  body_md       text        not null default '',
  body_html     text        not null default '',

  cover_image   text,       -- full public R2 URL
  author_name   text,

  status        text        not null default 'draft'
                            check (status in ('draft', 'published')),
  published_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (site_slug, slug)
);

create index if not exists posts_site_status_idx
  on public.posts (site_slug, status, published_at desc);


-- Keep updated_at honest without trusting the client.
create or replace function public.fpw_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.fpw_touch_updated_at();


-- ─── Row Level Security ───────────────────────────────────────────────────
alter table public.posts        enable row level security;
alter table public.site_editors enable row level security;

-- Idempotent: drop before create so this file can be re-run.
drop policy if exists "public reads published posts"   on public.posts;
drop policy if exists "editors read own site posts"    on public.posts;
drop policy if exists "editors insert own site posts"  on public.posts;
drop policy if exists "editors update own site posts"  on public.posts;
drop policy if exists "editors delete own site posts"  on public.posts;
drop policy if exists "editors read own assignments"   on public.site_editors;
drop policy if exists "owner manages assignments"      on public.site_editors;

-- Visitors to a client site: published posts only, no sign-in required.
-- This is what makes the blog show up for the public.
create policy "public reads published posts"
  on public.posts for select
  to anon, authenticated
  using (status = 'published');

-- Editors additionally see their own drafts.
create policy "editors read own site posts"
  on public.posts for select
  to authenticated
  using (public.fpw_can_edit_site(site_slug));

create policy "editors insert own site posts"
  on public.posts for insert
  to authenticated
  with check (public.fpw_can_edit_site(site_slug));

create policy "editors update own site posts"
  on public.posts for update
  to authenticated
  using (public.fpw_can_edit_site(site_slug))
  with check (public.fpw_can_edit_site(site_slug));

create policy "editors delete own site posts"
  on public.posts for delete
  to authenticated
  using (public.fpw_can_edit_site(site_slug));

-- A signed-in user may see which sites they were granted, and nothing else.
-- The admin page uses this to build the site picker.
create policy "editors read own assignments"
  on public.site_editors for select
  to authenticated
  using (
    public.fpw_is_owner()
    or lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Only the owner grants or revokes access.
create policy "owner manages assignments"
  on public.site_editors for all
  to authenticated
  using (public.fpw_is_owner())
  with check (public.fpw_is_owner());
