-- Migration 3 (doc 07): proposals, stock_movements and the trigger that keeps
-- products.stock_qty in step with the movement log (decision K2).

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind public.proposal_kind not null,
  status public.proposal_status not null default 'PENDING',
  input_path text,
  transcript text check (char_length(transcript) <= 4000),
  changes jsonb not null default '[]' check (jsonb_typeof(changes) = 'array'),
  -- Each confirmed change keeps its before and after values, so undo can
  -- restore them (errata E-02).
  confirmed_changes jsonb check (jsonb_typeof(confirmed_changes) = 'array'),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (id, shop_id),
  -- The same clip never creates two proposals (doc 07, idempotency).
  unique (shop_id, input_path)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null,
  kind public.movement_kind not null,
  qty integer not null,
  unit_price_paise integer check (unit_price_paise > 0),
  occurred_at timestamptz not null default now(),
  source public.movement_source not null,
  proposal_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 100),
  created_at timestamptz not null default now(),
  -- The product and proposal must belong to the movement's own shop.
  foreign key (product_id, shop_id) references public.products (id, shop_id) on delete cascade,
  foreign key (proposal_id, shop_id) references public.proposals (id, shop_id) on delete set null (proposal_id),
  unique (shop_id, idempotency_key),
  constraint qty_matches_kind check (
    (kind in ('SALE', 'DELIVERY') and qty > 0) or (kind = 'CORRECTION' and qty <> 0)
  )
);

create index stock_movements_shop_product_time
  on public.stock_movements (shop_id, product_id, occurred_at desc);
create index proposals_shop_status_time on public.proposals (shop_id, status, created_at desc);

-- SALE subtracts, DELIVERY adds, CORRECTION applies its signed amount. Items
-- whose count isn't tracked (stock_qty null) keep a null count; the movement
-- still counts toward forecasts. A result below zero fails the insert, and the
-- app asks the owner to correct the count first (doc 01 story 3).
create function private.apply_stock_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  delta integer := case new.kind
    when 'SALE' then -new.qty
    else new.qty
  end;
  current_qty integer;
begin
  select stock_qty into current_qty
  from public.products
  where id = new.product_id
  for update;

  if current_qty is null then
    return new;
  end if;

  if current_qty + delta < 0 then
    raise exception 'stock for product % would go below zero (% + %)', new.product_id, current_qty, delta
      using errcode = 'check_violation', hint = 'STOCK_NEGATIVE';
  end if;

  update public.products
  set stock_qty = current_qty + delta,
      is_in_stock = current_qty + delta > 0
  where id = new.product_id;

  return new;
end;
$$;

create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function private.apply_stock_movement();

alter table public.proposals enable row level security;
alter table public.stock_movements enable row level security;

revoke all on public.proposals, public.stock_movements from anon, authenticated;
grant select, insert on public.proposals, public.stock_movements to authenticated;
-- Owners may only decide a pending proposal (doc 07 RLS summary).
grant update (status, confirmed_changes, decided_at) on public.proposals to authenticated;
grant all on public.proposals, public.stock_movements to service_role;

create policy proposals_owner_select on public.proposals for select to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy proposals_owner_insert on public.proposals for insert to authenticated
  with check (
    status = 'PENDING'
    and shop_id in (select id from public.shops where owner_id = (select auth.uid()))
  );
create policy proposals_owner_decide on public.proposals for update to authenticated
  using (
    status = 'PENDING'
    and shop_id in (select id from public.shops where owner_id = (select auth.uid()))
  )
  with check (
    status in ('PENDING', 'CONFIRMED', 'CANCELLED')
    and shop_id in (select id from public.shops where owner_id = (select auth.uid()))
  );

-- Movements are append-only for owners: corrections are new rows. UNDO and
-- SEED rows come only from the server.
create policy stock_movements_owner_select on public.stock_movements for select to authenticated
  using (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy stock_movements_owner_insert on public.stock_movements for insert to authenticated
  with check (
    source in ('VOICE', 'BILL', 'TAP')
    and shop_id in (select id from public.shops where owner_id = (select auth.uid()))
  );
