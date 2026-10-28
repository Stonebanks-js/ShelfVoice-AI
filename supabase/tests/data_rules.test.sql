-- Doc 07 "Derived values" (decision K2), doc 01 story 3 and FR-16: the stock
-- trigger keeps counts in step with the movement log, stock never goes below
-- zero, retries can't double-count, and deleting a shop removes all its rows.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'authenticated', 'authenticated');

insert into public.shops (id, owner_id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Sharma Kirana', 'sharma-kirana'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Gupta Store', 'gupta-store');

insert into public.products (id, shop_id, name, stock_qty) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'Maggi', 10),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'Loose sugar', null),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000001', 'Parle-G', 60);

-- Movements are inserted as owner A, as the app will do.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'DELIVERY', 12, 'BILL', 'k1');
select results_eq($$select stock_qty from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$,
  $$values (22)$$, 'a delivery adds to stock');

insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'SALE', 22, 'VOICE', 'k2');
select results_eq($$select stock_qty, is_in_stock from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$,
  $$values (0, false)$$, 'a sale subtracts, and selling the last unit marks the item out of stock');

select throws_ok(
  $$insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'SALE', 1, 'TAP', 'k3')$$,
  '23514', null, 'a sale that would take stock below zero is rejected');
select is_empty($$select 1 from public.stock_movements where idempotency_key = 'k3'$$,
  'the rejected sale left no movement behind');

insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'CORRECTION', 7, 'TAP', 'k4');
select results_eq($$select stock_qty, is_in_stock from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$,
  $$values (7, true)$$, 'a correction applies its signed amount and restores in-stock');

select throws_ok(
  $$insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'DELIVERY', 3, 'TAP', 'k4')$$,
  '23505', null, 'a retried write with the same idempotency key is refused');
select throws_ok(
  $$insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'SALE', 0, 'TAP', 'k5')$$,
  '23514', null, 'a sale must be for at least one unit');

insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000012', 'SALE', 4, 'VOICE', 'k6');
select results_eq($$select stock_qty from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000012'$$,
  $$values (null::integer)$$, 'an item whose count isn''t tracked keeps a null count');
select results_eq($$select count(*)::int from public.stock_movements where product_id = 'aaaaaaaa-0000-0000-0000-000000000012'$$,
  $$values (1)$$, 'the sale of an untracked item is still logged for forecasting');

-- FR-16: deleting a shop (the server does this) removes all of its rows.
reset role;
insert into public.proposals (shop_id, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'SETUP');
insert into public.reviews (shop_id, consent_at) values ('aaaaaaaa-0000-0000-0000-000000000001', now());
insert into public.ai_calls (shop_id, job, model, outcome) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SETUP_EXTRACTION', 'muse-spark-1.3', 'OK');

delete from public.shops where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select is_empty($$
  select 1 from public.products where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.stock_movements where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.proposals where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.reviews where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.ai_calls where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001'
$$, 'deleting a shop removes every row that belongs to it');
select results_eq($$select stock_qty from public.products where id = 'bbbbbbbb-0000-0000-0000-000000000011'$$,
  $$values (60)$$, 'deleting one shop leaves other shops untouched');

delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is_empty($$select 1 from public.shops where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'deleting the owner''s auth user removes their shop');

select * from finish();
rollback;
