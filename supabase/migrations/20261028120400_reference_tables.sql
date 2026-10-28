-- Migration 5 (doc 07): festival calendar, rate limits, shared AI breaker.
-- The festival rows are seeded with W-19 (FR-12), once each 2026-27 date has
-- been checked against a source; this migration creates the table only.

create table public.festival_calendar (
  id smallint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 80),
  starts_on date not null,
  ends_on date not null,
  factor numeric not null check (factor between 1.0 and 3.0),
  categories text[] not null default '{}',
  check (ends_on >= starts_on)
);

-- Fixed-window counters written only by server code (decision P4).
create table public.rate_limits (
  key text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (key, window_start)
);

-- Circuit-breaker state shared by every function instance (doc 05).
create table public.ai_breaker (
  provider text primary key,
  state public.breaker_state not null default 'CLOSED',
  failures integer not null default 0 check (failures >= 0),
  opened_at timestamptz
);

alter table public.festival_calendar enable row level security;
alter table public.rate_limits enable row level security;
alter table public.ai_breaker enable row level security;

revoke all on public.festival_calendar, public.rate_limits, public.ai_breaker from anon, authenticated;
grant select on public.festival_calendar to anon, authenticated;
grant all on public.festival_calendar, public.rate_limits, public.ai_breaker to service_role;

create policy festival_calendar_read on public.festival_calendar for select to anon, authenticated
  using (true);
-- rate_limits and ai_breaker have no policies: only the service role reaches them.
