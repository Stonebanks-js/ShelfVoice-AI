-- V-11: a product's photo lives in its own shop's folder and nowhere else;
-- customers see the MRP and the photo credit, never anything new besides.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- The sample shops (V-10) are published too; inside this transaction only.
delete from auth.users where email like '%@shelfvoice.invalid';

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'photo-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'photo-b@test.local', 'authenticated', 'authenticated');
insert into public.shops (id, owner_id, name, slug, is_published) values
  ('aaaaaaaa-1111-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Photo A', 'photo-a', true),
  ('bbbbbbbb-1111-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'Photo B', 'photo-b', true);
insert into public.products (id, shop_id, name, price_paise, mrp_paise) values
  ('aaaaaaaa-1111-0000-0000-000000000011', 'aaaaaaaa-1111-0000-0000-000000000001', 'Tata Salt', 2500, 2800),
  ('bbbbbbbb-1111-0000-0000-000000000011', 'bbbbbbbb-1111-0000-0000-000000000001', 'Tata Salt', 2700, null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$update public.products set image_path = 'aaaaaaaa-1111-0000-0000-000000000001/aaaaaaaa-1111-0000-0000-000000000011-1730000000000.webp'
    where id = 'aaaaaaaa-1111-0000-0000-000000000011'$$,
  'an owner can point a product at a photo in their own shop folder');
select throws_ok(
  $$update public.products set image_path = 'bbbbbbbb-1111-0000-0000-000000000001/bbbbbbbb-1111-0000-0000-000000000011-1730000000000.webp'
    where id = 'aaaaaaaa-1111-0000-0000-000000000011'$$,
  '23514', null, 'not at a photo in another shop''s folder');
select throws_ok(
  $$update public.products set image_path = 'https://evil.example/a.jpg' where id = 'aaaaaaaa-1111-0000-0000-000000000011'$$,
  '23514', null, 'and not at any other address');
select throws_ok(
  $$update public.products set mrp_paise = 0 where id = 'aaaaaaaa-1111-0000-0000-000000000011'$$,
  '23514', null, 'an MRP is a positive amount');
select is_empty(
  $$update public.products set mrp_paise = 1 where id = 'bbbbbbbb-1111-0000-0000-000000000011' returning id$$,
  'an owner cannot change another shop''s product');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select results_eq(
  $$select mrp_paise, image_credit from public.public_storefront where product_id = 'aaaaaaaa-1111-0000-0000-000000000011'$$,
  $$values (2800, null::text)$$,
  'customers see the MRP and the photo credit');
select throws_ok(
  $$select image_source_id from public.products limit 1$$,
  '42501', null, 'but not where an owner found the photo');

select * from finish();
rollback;
