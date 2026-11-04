-- Product photos and MRP (V-11). Additive and nullable: every product keeps
-- working without them.
--
-- MRP is what the owner reads off the pack; the shop's own price stays
-- price_paise. The storefront shows a discount only when the owner's MRP is
-- above their price, worked out in code, never by the AI.
--
-- A photo is either one the owner picked from Open Food Facts (copied into
-- the catalog-images bucket under the shop's own folder) or, when image_path
-- is null, the ready-made list's verified photo for that name and pack, which
-- the app ships itself. image_path must sit in this product's shop folder, so
-- no shop can point at another shop's files or at any other address.
--
-- To undo:
--   alter table public.products drop constraint products_image_path_own_shop,
--     drop column mrp_paise, drop column image_source, drop column image_source_id,
--     drop column image_verified, drop column image_credit, drop column image_checked_at;
--   and re-run the public_storefront view from 20261102090000.

alter table public.products
  add column mrp_paise integer check (mrp_paise > 0 and mrp_paise <= 10000000),
  add column image_source text check (image_source in ('OWNER', 'OPEN_FOOD_FACTS')),
  add column image_source_id text check (char_length(image_source_id) <= 40),
  add column image_verified boolean not null default false,
  add column image_credit text check (char_length(image_credit) <= 120),
  add column image_checked_at timestamptz,
  add constraint products_image_path_own_shop check (
    image_path is null
    or image_path ~ ('^' || shop_id::text || '/[0-9a-f-]{36}-[0-9]{1,13}\.(jpg|webp)$')
  );

-- Customers see the MRP and the photo's credit, like the rest of the card.
grant select (mrp_paise, image_credit) on public.products to anon;

-- New columns last, as before.
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
  s.delivery_radius_km,
  p.mrp_paise,
  p.image_credit
from public.shops s
left join public.products p
  on p.shop_id = s.id
  and p.is_published
  and p.archived_at is null
where s.is_published;
