-- Customer orders (V-04, E-36): a customer fills a cart on the shop page and
-- places it with a name and phone number, for pickup or home delivery. The
-- owner sees it in Orders, marks items available or not, and moves it along;
-- completing it logs the sales. Customers don't sign in: the server writes
-- orders after a bot check, and the customer follows one through a secret
-- link (only its hash is kept).

alter table public.shops add column delivers boolean not null default false;
grant update (delivers) on public.shops to authenticated;
grant select (delivers) on public.shops to anon;

-- The storefront also says whether the shop delivers (new column at the end).
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
  s.delivers
from public.shops s
left join public.products p
  on p.shop_id = s.id
  and p.is_published
  and p.archived_at is null
where s.is_published;

create type public.order_status as enum ('NEW', 'ACCEPTED', 'READY', 'COMPLETED', 'CANCELLED');
create type public.order_item_status as enum ('PENDING', 'AVAILABLE', 'UNAVAILABLE');
create type public.fulfilment as enum ('PICKUP', 'DELIVERY');
alter type public.movement_source add value 'ORDER';

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  -- Short code both sides read out ("Order K7Q2").
  code text not null check (code ~ '^[A-Z0-9]{4}$'),
  customer_name text not null check (char_length(customer_name) between 1 and 60),
  customer_phone text not null check (customer_phone ~ '^\+[1-9][0-9]{6,14}$'),
  fulfilment public.fulfilment not null,
  address text check (char_length(address) <= 300),
  note text check (char_length(note) <= 300),
  status public.order_status not null default 'NEW',
  token_hash text not null check (char_length(token_hash) = 64),
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fulfilment = 'PICKUP' or address is not null),
  unique (id, shop_id)
);
create index orders_shop_time on public.orders (shop_id, created_at desc);
create index orders_shop_status on public.orders (shop_id, status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  shop_id uuid not null,
  product_id uuid,
  -- What the customer saw when ordering.
  name text not null check (char_length(name) between 1 and 80),
  unit text check (char_length(unit) <= 40),
  price_paise integer check (price_paise > 0),
  qty integer not null check (qty between 1 and 99),
  status public.order_item_status not null default 'PENDING',
  position smallint not null,
  foreign key (order_id, shop_id) references public.orders (id, shop_id) on delete cascade,
  foreign key (product_id, shop_id) references public.products (id, shop_id) on delete set null (product_id)
);
create index order_items_order on public.order_items (order_id, position);

create trigger orders_touch before update on public.orders
  for each row execute function private.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.orders, public.order_items from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;
-- Owners change only what Orders edits; the server writes the rest.
grant update (status) on public.orders to authenticated;
grant update (status) on public.order_items to authenticated;
grant all on public.orders, public.order_items to service_role;

create policy orders_owner_select on public.orders for select to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy orders_owner_update on public.orders for update to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
  with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy order_items_owner_select on public.order_items for select to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy order_items_owner_update on public.order_items for update to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
  with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));

-- Phones that get a notification for new orders (web push).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_shop on public.push_subscriptions (shop_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;

-- Completing an order logs a sale for each available item that is still a
-- product, at the price the customer saw, once (the idempotency key is the
-- item). Runs as the owner, so RLS and the stock trigger apply as for a tap.
create function public.complete_order(p_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'no_data_found', hint = 'NOT_FOUND';
  end if;
  if v_order.status not in ('ACCEPTED', 'READY') then
    raise exception 'order is %', v_order.status using errcode = 'check_violation', hint = 'ORDER_NOT_OPEN';
  end if;

  insert into public.stock_movements (shop_id, product_id, kind, qty, unit_price_paise, source, idempotency_key)
  select i.shop_id, i.product_id, 'SALE', i.qty, i.price_paise, 'ORDER', 'order-item:' || i.id
  from public.order_items i
  where i.order_id = v_order.id and i.status = 'AVAILABLE' and i.product_id is not null
  order by i.position
  on conflict (shop_id, idempotency_key) do nothing;

  update public.orders set status = 'COMPLETED' where id = v_order.id;
end;
$$;

revoke execute on function public.complete_order(uuid) from public, anon;
grant execute on function public.complete_order(uuid) to authenticated, service_role;

-- Owners may log ORDER sales too (complete_order runs as the owner). The new
-- enum value is compared as text: it can't be used as a value in the same
-- transaction that adds it.
drop policy stock_movements_owner_insert on public.stock_movements;
create policy stock_movements_owner_insert on public.stock_movements for insert to authenticated
  with check (
    source::text in ('VOICE', 'BILL', 'TAP', 'ORDER')
    and shop_id in (select id from public.shops where owner_id = (select auth.uid()))
  );
