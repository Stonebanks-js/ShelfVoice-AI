-- Admin page (W-20b, F-12): a manual breaker switch, whether the owner
-- changed a proposal before confirming, and today's numbers in one call.

-- Set by the admin page; keeps AI paused until switched back, unlike an
-- automatic OPEN, which half-opens after a minute.
alter table public.ai_breaker add column manual boolean not null default false;

-- Null until confirmed; true when the owner edited or dropped any change
-- the AI proposed. Written by the server only.
alter table public.proposals add column owner_edited boolean;

-- Today in India (as ai_spend counts it). Service role only.
create function public.admin_today()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with today as (
    select (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as start
  ),
  calls as (
    select c.* from public.ai_calls c, today where c.created_at >= today.start
  ),
  jobs as (
    select
      job,
      count(*) as calls,
      count(*) filter (where outcome = 'OK') as ok,
      round(percentile_cont(0.95) within group (order by latency_ms))::integer as p95_ms,
      sum(cost_usd) as cost_usd
    from calls
    group by job
  ),
  confirmed as (
    select p.owner_edited
    from public.proposals p, today
    where p.decided_at >= today.start and p.status in ('CONFIRMED', 'UNDONE') and p.owner_edited is not null
  )
  select jsonb_build_object(
    'spent_total_usd', (select coalesce(sum(cost_usd), 0) from public.ai_calls),
    'spent_today_usd', (select coalesce(sum(cost_usd), 0) from calls),
    'jobs', coalesce((select jsonb_agg(to_jsonb(jobs) order by jobs.calls desc) from jobs), '[]'::jsonb),
    'confirmed', (select count(*) from confirmed),
    'confirmed_unedited', (select count(*) from confirmed where not owner_edited),
    'shops', (select count(*) from public.shops where not is_demo),
    'shops_today', (select count(*) from public.shops, today where not is_demo and created_at >= today.start),
    'products', (select count(*) from public.products p join public.shops s on s.id = p.shop_id where not s.is_demo and p.archived_at is null),
    'reviews', (select count(*) from public.reviews r join public.shops s on s.id = r.shop_id where not s.is_demo),
    'reviews_today', (select count(*) from public.reviews r join public.shops s on s.id = r.shop_id, today where not s.is_demo and r.created_at >= today.start),
    'demo_sign_ins_today', (select count(*) from public.shops, today where is_demo and created_at >= today.start)
  );
$$;

revoke all on function public.admin_today() from public, anon, authenticated;
grant execute on function public.admin_today() to service_role;
