-- Migration 2 (doc 07): shops and products, with RLS, grants and indexes.
-- Tenancy rule (doc 03): an owner reaches only rows whose shop_id is a shop
-- they own. Customers never sign in; the public storefront reads published
-- rows as the anon role, limited to safe columns by column grants (E-29).

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  category text check (char_length(category) <= 80),
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  address text check (char_length(address) <= 300),
  description text check (char_length(description) <= 500),
  timezone text not null default 'Asia/Kolkata',
  hours jsonb,
  language text not null default 'hi' check (language in ('hi', 'en')),
  is_published boolean not null default false,
  is_demo boolean not null default false,
  demo_expires_at timestamptz,
  lead_time_days integer not null default 2 check (lead_time_days between 1 and 30),
  review_period_days integer not null default 7 check (review_period_days between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_copies_expire check (not is_demo or demo_expires_at is not null)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  aliases text[] not null default '{}' check (cardinality(aliases) <= 10),
  category text check (char_length(category) <= 80),
  unit text check (char_length(unit) <= 40),
  -- Null price: not spoken yet. Null stock: the owner doesn't track counts.
  price_paise integer check (price_paise > 0),
  stock_qty integer check (stock_qty >= 0),
  is_in_stock boolean not null default true,
  low_stock_level integer not null default 5 check (low_stock_level >= 0),
  pack_size integer not null default 1 check (pack_size >= 1),
  image_path text,
  is_published boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets child tables prove a product belongs to the same shop.
  unique (id, shop_id)
);

create trigger shops_updated_at before update on public.shops
  for each row execute function private.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- Indexes (doc 07, "Indexes, derived values and RLS"). shops(owner_id) and
-- shops(slug) are covered by their unique constraints.
create index products_shop_category_name on public.products (shop_id, category, name);
create index products_name_trgm on public.products using gin (lower(name) extensions.gin_trgm_ops);
create index products_aliases on public.products using gin (aliases);

alter table public.shops enable row level security;
alter table public.products enable row level security;

-- Explicit grants replace Supabase's broad defaults.
revoke all on public.shops, public.products from anon, authenticated;
grant select, insert, update on public.shops to authenticated;
grant select, insert, update, delete on public.products to authenticated;
-- is_published and archived_at are readable because the public policies test
-- them; every row anon can see has is_published = true and archived_at = null.
grant select (id, slug, name, category, phone, address, description, timezone, hours, language, is_published)
  on public.shops to anon;
grant select (id, shop_id, name, category, unit, price_paise, is_in_stock, image_path, is_published, archived_at)
  on public.products to anon;
grant all on public.shops, public.products to service_role;

-- Shops: owners read and change their own. Deleting a shop goes through the
-- server function for FR-16, which also removes storage and the auth user.
create policy shops_owner_select on public.shops for select to authenticated
  using (owner_id = (select auth.uid()));
create policy shops_owner_insert on public.shops for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy shops_owner_update on public.shops for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy shops_public_select on public.shops for select to anon
  using (is_published);

create policy products_owner_select on public.products for select to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy products_owner_insert on public.products for insert to authenticated
  with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy products_owner_update on public.products for update to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
  with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy products_owner_delete on public.products for delete to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy products_public_select on public.products for select to anon
  using (
    is_published
    and archived_at is null
    and shop_id in (select id from public.shops where is_published)
  );
