-- Doc 04 "Database and authorization tests" and doc 03 TH-01: one owner can
-- never read or change another owner's rows; anonymous visitors see only
-- published shops and safe columns (errata E-05, E-29).
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

-- Fixture: owner A has a published shop, owner B an unpublished one.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'authenticated', 'authenticated');

insert into public.shops (id, owner_id, name, slug, is_published) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Sharma Kirana', 'sharma-kirana', true),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Gupta Store', 'gupta-store', false);

insert into public.products (id, shop_id, name, price_paise, stock_qty, is_in_stock) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'Maggi', 1400, 18, true),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'Aashirvaad Atta', 24500, 0, false),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000001', 'Parle-G', 1000, 60, true);

insert into public.proposals (id, shop_id, kind, status) values
  ('aaaaaaaa-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000001', 'COMMAND', 'PENDING'),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000001', 'COMMAND', 'CONFIRMED'),
  ('bbbbbbbb-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000001', 'COMMAND', 'PENDING');

insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000011', 'SALE', 2, 'TAP', 'b-sale-1');

insert into public.reviews (id, shop_id, transcript, consent_at) values
  ('aaaaaaaa-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000001', 'Atta khatam tha', now()),
  ('bbbbbbbb-0000-0000-0000-000000000031', 'bbbbbbbb-0000-0000-0000-000000000001', 'Achha laga', now());

insert into public.ai_calls (shop_id, job, model, outcome) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'COMMAND', 'muse-spark-1.3', 'OK');

-- ---------------------------------------------------------------- owner A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select results_eq('select id from public.shops', $$values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid)$$,
  'owner A sees only their own shop');
select is_empty($$select 1 from public.products where shop_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'owner A sees none of shop B''s products');
select is_empty($$select 1 from public.stock_movements where shop_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'owner A sees none of shop B''s stock movements');
select is_empty($$select 1 from public.proposals where shop_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'owner A sees none of shop B''s proposals');
select is_empty($$select 1 from public.reviews where shop_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'owner A sees none of shop B''s reviews');
select is_empty($$select 1 from public.ai_calls where shop_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'owner A sees none of shop B''s AI calls');

select throws_ok(
  $$insert into public.products (shop_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Injected')$$,
  '42501', null, 'owner A cannot add a product to shop B');
select throws_ok(
  $$insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000011', 'DELIVERY', 5, 'TAP', 'cross')$$,
  '23503', null, 'owner A cannot log a movement against shop B''s product from their own shop');
select throws_ok(
  $$insert into public.stock_movements (shop_id, product_id, kind, qty, source, idempotency_key)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'CORRECTION', 5, 'UNDO', 'undo-1')$$,
  '42501', null, 'UNDO movements come only from the server');
select throws_ok(
  $$insert into public.shops (owner_id, name, slug) values ('00000000-0000-0000-0000-00000000000a', 'Second', 'second-shop')$$,
  '23505', null, 'one owner account owns one shop');
select throws_ok('select count(*) from public.rate_limits', '42501', null,
  'owners cannot read rate-limit counters');

update public.products set price_paise = 1 where shop_id = 'bbbbbbbb-0000-0000-0000-000000000001';
delete from public.products where shop_id = 'bbbbbbbb-0000-0000-0000-000000000001';

select lives_ok($$update public.reviews set is_hidden = true where id = 'aaaaaaaa-0000-0000-0000-000000000031'$$,
  'owner A can hide a review of their shop');
select throws_ok($$update public.reviews set transcript = 'edited' where id = 'aaaaaaaa-0000-0000-0000-000000000031'$$,
  '42501', null, 'owner A cannot edit what a customer said');
select lives_ok($$update public.proposals set status = 'CONFIRMED', decided_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000021'$$,
  'owner A can confirm a pending proposal');
update public.proposals set status = 'CANCELLED' where id = 'aaaaaaaa-0000-0000-0000-000000000022';
select throws_ok($$update public.proposals set changes = '[]' where id = 'aaaaaaaa-0000-0000-0000-000000000021'$$,
  '42501', null, 'owner A cannot rewrite a proposal''s proposed changes');

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('voice', 'aaaaaaaa-0000-0000-0000-000000000001/owner/clip.wav')$$,
  'owner A can upload under their own shop folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('voice', 'bbbbbbbb-0000-0000-0000-000000000001/owner/clip.wav')$$,
  '42501', null, 'owner A cannot upload under shop B''s folder');

-- ------------------------------------------- anonymous demo sign-in (doc 03)
reset role;
insert into auth.users (id, email, aud, role, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000dd', null, 'authenticated', 'authenticated', true);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000dd","role":"authenticated","is_anonymous":true}', true);

select throws_ok(
  $$insert into public.shops (owner_id, name, slug) values ('00000000-0000-0000-0000-0000000000dd', 'Spam', 'spam-shop')$$,
  '42501', null, 'an anonymous demo visitor cannot create shops');
select is_empty('select 1 from public.shops', 'an anonymous demo visitor sees no other owner''s shop');

-- -------------------------------------------------------------- anonymous
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select results_eq('select distinct shop_id from public.public_storefront',
  $$values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid)$$,
  'the storefront view shows only published shops');
select results_eq(
  $$select in_stock from public.public_storefront where product_name = 'Aashirvaad Atta'$$,
  $$values (false)$$,
  'out-of-stock products stay listed with in_stock false (E-05)');
select results_eq('select id from public.shops', $$values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid)$$,
  'anon reads only published shops from the base table (E-29)');
select throws_ok('select stock_qty from public.products', '42501', null,
  'anon can never read stock counts');
select throws_ok('select owner_id from public.shops', '42501', null,
  'anon can never read shop owners');
select throws_ok('select 1 from public.reviews', '42501', null, 'anon cannot read reviews');
select throws_ok('select 1 from public.proposals', '42501', null, 'anon cannot read proposals');
select is_empty($$select 1 from storage.objects where bucket_id in ('voice', 'photos')$$,
  'anon sees no private voice or photo objects');

-- ------------------------------------------------- checks as the superuser
reset role;
select results_eq(
  $$select price_paise from public.products where id = 'bbbbbbbb-0000-0000-0000-000000000011'$$,
  $$values (1000)$$, 'owner A''s update and delete left shop B''s product untouched');
select results_eq(
  $$select status::text from public.proposals where id = 'aaaaaaaa-0000-0000-0000-000000000022'$$,
  $$values ('CONFIRMED')$$, 'a decided proposal cannot be changed by its owner');

select * from finish();
rollback;
