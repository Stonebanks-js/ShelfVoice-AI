-- Migration 4 (doc 07): reviews, product_forecasts, ai_calls.

-- Customer voice reviews. The server inserts them (customers never sign in),
-- and the review id is the client UUID created when the page opens, so a
-- retried submit can't create a second row (doc 07, idempotency).
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  audio_path text,
  audio_deleted_at timestamptz,
  transcript text check (char_length(transcript) <= 1000),
  status public.review_status not null default 'PENDING',
  sentiment public.sentiment,
  summary text check (char_length(summary) <= 200),
  mentioned_product_ids uuid[] not null default '{}',
  stockout_product_ids uuid[] not null default '{}',
  is_hidden boolean not null default false,
  consent_at timestamptz not null,
  -- Hashed with a rotating salt; the daily job clears it after 7 days (E-08).
  ip_hash text,
  created_at timestamptz not null default now()
);

create index reviews_shop_time on public.reviews (shop_id, created_at desc);
create index reviews_pending on public.reviews (status) where status = 'PENDING';

-- One row per product, rewritten on each forecast refresh (doc 02 formula).
create table public.product_forecasts (
  product_id uuid primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  level numeric not null check (level >= 0),
  sigma numeric not null check (sigma >= 0),
  days_left numeric check (days_left >= 0),
  reorder_point integer check (reorder_point >= 0),
  order_qty integer check (order_qty >= 0),
  stockout_boost_until date,
  explanation text check (char_length(explanation) <= 300),
  explanation_lang text check (explanation_lang in ('hi', 'en', 'hinglish')),
  explanation_on date,
  computed_at timestamptz not null default now(),
  foreign key (product_id, shop_id) references public.products (id, shop_id) on delete cascade
);

-- One row per Meta API call (doc 05, "AI observability"). No prompts,
-- transcripts or outputs are stored here (doc 03).
create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  shop_id uuid references public.shops (id) on delete cascade,
  proposal_id uuid references public.proposals (id) on delete set null,
  review_id uuid references public.reviews (id) on delete set null,
  job public.ai_job not null,
  model text not null,
  prompt_version text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_tokens integer not null default 0 check (cached_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  audio_seconds integer not null default 0 check (audio_seconds >= 0),
  images integer not null default 0 check (images >= 0),
  cost_usd numeric(10, 6) not null default 0 check (cost_usd >= 0),
  latency_ms integer check (latency_ms >= 0),
  retries integer not null default 0 check (retries >= 0),
  outcome public.ai_outcome not null,
  owner_action public.owner_action,
  created_at timestamptz not null default now()
);

create index ai_calls_time on public.ai_calls (created_at);
create index ai_calls_shop_time on public.ai_calls (shop_id, created_at);

alter table public.reviews enable row level security;
alter table public.product_forecasts enable row level security;
alter table public.ai_calls enable row level security;

revoke all on public.reviews, public.product_forecasts, public.ai_calls from anon, authenticated;
grant select on public.reviews, public.product_forecasts, public.ai_calls to authenticated;
-- Owners can hide a review but never edit what a customer said (doc 03).
grant update (is_hidden) on public.reviews to authenticated;
grant all on public.reviews, public.product_forecasts, public.ai_calls to service_role;

create policy reviews_owner_select on public.reviews for select to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy reviews_owner_hide on public.reviews for update to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
  with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));

-- Forecasts are computed by code, so owners only read them.
create policy product_forecasts_owner_select on public.product_forecasts for select to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));

create policy ai_calls_owner_select on public.ai_calls for select to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
