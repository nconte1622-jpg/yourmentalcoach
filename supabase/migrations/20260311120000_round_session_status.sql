alter table public.rounds
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists status text not null default 'active';

update public.rounds
set
  created_at = coalesce(created_at, started_at, now()),
  status = case
    when ended_at is null then 'active'
    else 'completed'
  end
where true;
