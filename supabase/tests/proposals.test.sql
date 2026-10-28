-- Propose-then-confirm (doc 02, ADR-001) and undo (errata E-02).
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'authenticated', 'authenticated');
insert into public.shops (id, owner_id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Sharma Kirana', 'sharma-kirana'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Gupta Store', 'gupta-store');
insert into public.products (id, shop_id, name, price_paise, stock_qty) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'Maggi', 1400, 10),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'Aashirvaad Atta', 24500, 3),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000001', 'Parle-G', 1000, 60);
insert into public.proposals (id, shop_id, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000001', 'COMMAND'),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000001', 'COMMAND'),
  ('bbbbbbbb-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000001', 'COMMAND');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok($$select public.confirm_proposal('aaaaaaaa-0000-0000-0000-000000000021', '[
  {"op":"add_product","name":"Surf Excel","unit":"1 kg","price_paise":14000,"aliases":["surf"]},
  {"op":"update_price","product_id":"aaaaaaaa-0000-0000-0000-000000000011","price_paise":1500},
  {"op":"record_sale","product_id":"aaaaaaaa-0000-0000-0000-000000000011","qty":2},
  {"op":"set_stock_count","product_id":"aaaaaaaa-0000-0000-0000-000000000012","count":5}
]'::jsonb)$$, 'owner A confirms a proposal with four changes');

select results_eq($$select price_paise, stock_qty from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$,
  $$values (1500, 8)$$, 'the price change and the sale were applied');
select results_eq($$select stock_qty from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000012'$$,
  $$values (5)$$, 'the count correction was applied through the movement log');
select results_eq($$select count(*)::int from public.products where name = 'Surf Excel' and archived_at is null$$,
  $$values (1)$$, 'the new product was added');
select results_eq($$select status::text, jsonb_array_length(confirmed_changes) from public.proposals where id = 'aaaaaaaa-0000-0000-0000-000000000021'$$,
  $$values ('CONFIRMED', 4)$$, 'the proposal is confirmed with every change and its before and after values');

select lives_ok($$select public.confirm_proposal('aaaaaaaa-0000-0000-0000-000000000021', '[{"op":"record_sale","product_id":"aaaaaaaa-0000-0000-0000-000000000011","qty":2}]'::jsonb)$$,
  'confirming again succeeds');
select results_eq($$select stock_qty from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$,
  $$values (8)$$, 'a second confirm changes nothing (no double sale)');

select throws_ok($$select public.confirm_proposal('bbbbbbbb-0000-0000-0000-000000000021', '[]'::jsonb)$$,
  'P0002', null, 'owner A cannot confirm shop B''s proposal');
select throws_ok($$select public.confirm_proposal('aaaaaaaa-0000-0000-0000-000000000022', '[
  {"op":"update_price","product_id":"bbbbbbbb-0000-0000-0000-000000000011","price_paise":1}]'::jsonb)$$,
  'P0002', null, 'a change aimed at another shop''s product is refused');
select results_eq($$select status::text from public.proposals where id = 'aaaaaaaa-0000-0000-0000-000000000022'$$,
  $$values ('PENDING')$$, 'a refused confirm leaves the proposal pending');
select throws_ok($$select public.confirm_proposal('aaaaaaaa-0000-0000-0000-000000000022', '[
  {"op":"record_sale","product_id":"aaaaaaaa-0000-0000-0000-000000000012","qty":50}]'::jsonb)$$,
  '23514', null, 'a sale larger than the stock is refused');

select throws_ok($$select public.undo_proposal('aaaaaaaa-0000-0000-0000-000000000021')$$,
  '42501', null, 'owners cannot call undo directly; it goes through the server');
select throws_ok($$select public.hit_rate_limit('k', 60)$$, '42501', null, 'owners cannot touch rate-limit counters');

-- ------------------------------------------------- server (service role)
reset role;

select lives_ok($$select public.undo_proposal('aaaaaaaa-0000-0000-0000-000000000021')$$, 'the server undoes the proposal');
select results_eq($$select price_paise, stock_qty from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$,
  $$values (1400, 10)$$, 'undo restores the old price and the sold stock');
select results_eq($$select stock_qty from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000012'$$,
  $$values (3)$$, 'undo reverses the count correction');
select results_eq($$select count(*)::int from public.products where name = 'Surf Excel' and archived_at is null$$,
  $$values (0)$$, 'undo archives the added product');
select results_eq($$select status::text from public.proposals where id = 'aaaaaaaa-0000-0000-0000-000000000021'$$,
  $$values ('UNDONE')$$, 'the proposal is marked undone');
select results_eq($$select count(*)::int from public.stock_movements where source = 'UNDO'$$,
  $$values (2)$$, 'undo wrote offsetting movements instead of deleting any');

-- A delivery whose stock has already been sold can't be taken back.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.confirm_proposal('aaaaaaaa-0000-0000-0000-000000000022', '[
  {"op":"record_delivery","product_id":"aaaaaaaa-0000-0000-0000-000000000012","qty":4}]'::jsonb);
insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000012', 'SALE', 7, 'TAP', 'sold-out');
reset role;
select results_eq(
  $$select (public.undo_proposal('aaaaaaaa-0000-0000-0000-000000000022') -> 0 ->> 'undo')$$,
  $$values ('skipped: stock already sold')$$, 'undo skips a delivery whose stock was already sold');

update public.proposals set status = 'CONFIRMED', decided_at = now() - interval '2 minutes'
where id = 'aaaaaaaa-0000-0000-0000-000000000022';
select throws_ok($$select public.undo_proposal('aaaaaaaa-0000-0000-0000-000000000022')$$,
  'P0001', null, 'undo is refused after the window closes');

select results_eq($$select public.hit_rate_limit('ip:1', 3600) + public.hit_rate_limit('ip:1', 3600)$$,
  $$values (3)$$, 'the rate-limit counter counts hits in the same window');

select * from finish();
rollback;
