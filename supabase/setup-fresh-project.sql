-- ===========================================================================
-- Your Mental Coach — full schema for a fresh Supabase project.
-- Consolidates every migration under supabase/migrations/ into one idempotent
-- script. Safe to run (and re-run) on an empty project via the SQL Editor.
-- Order matters: profiles + helpers first, then the tables that reference them.
-- ===========================================================================

-- 1) profiles + shared helpers + auto-create-profile-on-signup --------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text,
  is_anonymous boolean default false,
  is_pro boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = user_id);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, display_name, is_anonymous)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', null),
    new.is_anonymous
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) memories ----------------------------------------------------------------
create table if not exists public.memories (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  category text not null check (category in ('pattern','cue','success','breakdown')),
  content text not null,
  confidence float not null default 0.5,
  created_at timestamptz not null default now()
);
alter table public.memories enable row level security;
drop policy if exists "Users can view their own memories" on public.memories;
create policy "Users can view their own memories"
  on public.memories for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own memories" on public.memories;
create policy "Users can insert their own memories"
  on public.memories for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own memories" on public.memories;
create policy "Users can update their own memories"
  on public.memories for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own memories" on public.memories;
create policy "Users can delete their own memories"
  on public.memories for delete using (auth.uid() = user_id);
create index if not exists idx_memories_user_id on public.memories(user_id);
create index if not exists idx_memories_category on public.memories(category);
create index if not exists idx_memories_user_created on public.memories(user_id, created_at desc);

-- 3) rounds + round_events (status/created_at included up-front) -------------
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_type text not null,
  environment text not null,
  course_location text,
  goal text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  post_round_best text,
  post_round_cost text,
  post_round_adjustment text,
  created_at timestamptz not null default now(),
  status text not null default 'active'
);
create index if not exists idx_rounds_user_started on public.rounds(user_id, started_at desc);
alter table public.rounds enable row level security;
drop policy if exists "Users can view their own rounds" on public.rounds;
create policy "Users can view their own rounds"
  on public.rounds for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own rounds" on public.rounds;
create policy "Users can insert their own rounds"
  on public.rounds for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own rounds" on public.rounds;
create policy "Users can update their own rounds"
  on public.rounds for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own rounds" on public.rounds;
create policy "Users can delete their own rounds"
  on public.rounds for delete using (auth.uid() = user_id);

create table if not exists public.round_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  event_type text not null,
  label text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_round_events_round_created on public.round_events(round_id, created_at asc);
create index if not exists idx_round_events_user_created on public.round_events(user_id, created_at desc);
alter table public.round_events enable row level security;
drop policy if exists "Users can view their own round events" on public.round_events;
create policy "Users can view their own round events"
  on public.round_events for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own round events" on public.round_events;
create policy "Users can insert their own round events"
  on public.round_events for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own round events" on public.round_events;
create policy "Users can update their own round events"
  on public.round_events for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own round events" on public.round_events;
create policy "Users can delete their own round events"
  on public.round_events for delete using (auth.uid() = user_id);

-- 4) user_entitlements (source of truth for PRO) -----------------------------
create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  plan text not null default 'free' check (plan in ('free','pro')),
  entitlement_source text not null default 'free'
    check (entitlement_source in ('free','apple','test_override','stripe_web')),
  apple_entitlement_active boolean not null default false,
  apple_product_id text,
  apple_original_transaction_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.user_entitlements enable row level security;
drop policy if exists "Users can view their own entitlements" on public.user_entitlements;
create policy "Users can view their own entitlements"
  on public.user_entitlements for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own entitlements" on public.user_entitlements;
create policy "Users can insert their own entitlements"
  on public.user_entitlements for insert with check (auth.uid() = user_id);
-- Restrictive UPDATE: users may edit their row but NOT change plan/source
-- (only the service_role key, used by edge functions, can change those).
drop policy if exists "Users can update their own entitlements" on public.user_entitlements;
drop policy if exists "Users can update own entitlements (non-plan fields only)" on public.user_entitlements;
create policy "Users can update own entitlements (non-plan fields only)"
  on public.user_entitlements for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and plan = (select ue.plan from public.user_entitlements ue where ue.user_id = auth.uid())
    and entitlement_source = (select ue.entitlement_source from public.user_entitlements ue where ue.user_id = auth.uid())
  );
create index if not exists idx_user_entitlements_user_id on public.user_entitlements(user_id);
drop trigger if exists update_user_entitlements_updated_at on public.user_entitlements;
create trigger update_user_entitlements_updated_at
  before update on public.user_entitlements
  for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user_entitlements()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.user_entitlements (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_entitlements on auth.users;
create trigger on_auth_user_created_entitlements
  after insert on auth.users
  for each row execute function public.handle_new_user_entitlements();
