create table if not exists public.school_state (
  id text primary key check (id = 'default'),
  classes jsonb not null default '[]'::jsonb,
  teachers jsonb not null default '[]'::jsonb,
  catalog jsonb not null default '{}'::jsonb,
  academic_years jsonb not null default '[]'::jsonb,
  current_academic_year_id text not null default '',
  current_term_id text not null default '',
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.school_state enable row level security;

revoke all on table public.school_state from anon, authenticated;
