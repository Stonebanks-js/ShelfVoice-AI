-- Barcodes. A product can carry the barcode printed on its
-- pack, unique within a shop, so scanning it again finds the product. Names
-- for barcodes come from Open Food Facts, a free public database; the
-- answers are cached here (found or not) so each code is asked about once.

alter table public.products
  add column barcode text check (barcode ~ '^[0-9]{8,14}$');

create unique index products_shop_barcode_key on public.products (shop_id, barcode)
  where barcode is not null and archived_at is null;

create table public.barcode_lookups (
  code text primary key check (code ~ '^[0-9]{8,14}$'),
  found boolean not null,
  name text check (char_length(name) <= 120),
  brand text check (char_length(brand) <= 80),
  quantity text check (char_length(quantity) <= 40),
  fetched_at timestamptz not null default now()
);

-- Server only: owners reach it through the API, never directly.
alter table public.barcode_lookups enable row level security;
revoke all on public.barcode_lookups from anon, authenticated;
grant all on public.barcode_lookups to service_role;
