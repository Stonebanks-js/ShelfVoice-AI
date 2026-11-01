-- Accounts and settings (V-05, E-36). Customers get accounts (Google sign-in,
-- like owners): their details, saved addresses, wishlist and favourite
-- shops, and their orders. Shops get payment modes (cash, UPI ID, pay on
-- delivery) and delivery rules (minimum order, charge, free above, distance).
-- Owners record refunds; the money itself moves outside the app.

-- ------------------------------------------------------------- shop settings
alter table public.shops
  add column upi_id text check (upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,64}$'),
  add column accepts_cash boolean not null default true,
  add column pay_on_delivery boolean not null default true,
  add column delivery_min_paise integer check (delivery_min_paise between 0 and 10000000),
  add column delivery_fee_paise integer check (delivery_fee_paise between 0 and 1000000),
  add column free_delivery_above_paise integer check (free_delivery_above_paise between 0 and 10000000),
  add column delivery_radius_km numeric(4, 1) check (delivery_radius_km between 0.5 and 50);

grant update (upi_id, accepts_cash, pay_on_delivery, delivery_min_paise, delivery_fee_paise, free_delivery_above_paise, delivery_radius_km)
  on public.shops to authenticated;
grant select (upi_id, accepts_cash, pay_on_delivery, delivery_min_paise, delivery_fee_paise, free_delivery_above_paise, delivery_radius_km)
  on public.shops to anon;

-- The storefront shows payment modes and delivery rules (new columns last).
create or replace view public.public_storefront
with (security_invoker = true) as
select
  s.id as shop_id,
  s.slug,
  s.name as shop_name,
  s.category as shop_category,
  s.description as shop_description,
  s.phone,
  s.address,
  s.timezone,
  s.hours,
  s.language,
  p.id as product_id,
  p.name as product_name,
  p.category as product_category,
  p.unit,
  p.price_paise,
  p.is_in_stock as in_stock,
  p.image_path,
  s.delivers,
  s.upi_id,
  s.accepts_cash,
  s.pay_on_delivery,
  s.delivery_min_paise,
  s.delivery_fee_paise,
  s.free_delivery_above_paise,
  s.delivery_radius_km
from public.shops s
left join public.products p
  on p.shop_id = s.id
  and p.is_published
  and p.archived_at is null
where s.is_published;

-- ------------------------------------------------------------------ customers
create table public.customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text check (char_length(name) between 1 and 60),
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  pay_with text not null default 'CASH' check (pay_with in ('CASH', 'UPI')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_touch before update on public.customers
  for each row execute function private.set_updated_at();

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customers (user_id) on delete cascade,
  label text not null default 'Home' check (char_length(label) between 1 and 30),
  address text not null check (char_length(address) between 1 and 300),
  pincode text check (pincode ~ '^[1-9][0-9]{5}$'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);
create index customer_addresses_user on public.customer_addresses (user_id);
create unique index customer_addresses_one_default on public.customer_addresses (user_id) where is_default;

create table public.wishlist_items (
  user_id uuid not null references public.customers (user_id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.favourite_shops (
  user_id uuid not null references public.customers (user_id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.favourite_shops enable row level security;
revoke all on public.customers, public.customer_addresses, public.wishlist_items, public.favourite_shops from anon, authenticated;
grant select, insert, update, delete on public.customers, public.customer_addresses, public.wishlist_items, public.favourite_shops to authenticated;
grant all on public.customers, public.customer_addresses, public.wishlist_items, public.favourite_shops to service_role;

-- Each customer reads and changes only their own rows.
create policy customers_own on public.customers for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy customer_addresses_own on public.customer_addresses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy wishlist_items_own on public.wishlist_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy favourite_shops_own on public.favourite_shops for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- orders
-- A signed-in customer's orders are theirs to see; delivery adds a charge.
alter table public.orders
  add column customer_id uuid references auth.users (id) on delete set null,
  add column delivery_fee_paise integer not null default 0 check (delivery_fee_paise between 0 and 1000000);
create index orders_customer on public.orders (customer_id, created_at desc) where customer_id is not null;

create policy orders_customer_select on public.orders for select to authenticated
  using (customer_id = (select auth.uid()));
create policy order_items_customer_select on public.order_items for select to authenticated
  using (order_id in (select id from public.orders where customer_id = (select auth.uid())));

-- Refunds the owner records on an order (amount and why). Customers see
-- theirs. Written by the server for the owner, after checking the order.
create table public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  shop_id uuid not null,
  amount_paise integer not null check (amount_paise between 1 and 10000000),
  reason text not null check (char_length(reason) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (order_id, shop_id) references public.orders (id, shop_id) on delete cascade
);
create index order_refunds_order on public.order_refunds (order_id);
alter table public.order_refunds enable row level security;
revoke all on public.order_refunds from anon, authenticated;
grant select on public.order_refunds to authenticated;
grant all on public.order_refunds to service_role;
create policy order_refunds_owner_select on public.order_refunds for select to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy order_refunds_customer_select on public.order_refunds for select to authenticated
  using (order_id in (select id from public.orders where customer_id = (select auth.uid())));
