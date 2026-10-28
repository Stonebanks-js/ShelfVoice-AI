-- Migration 6 (doc 07): public storefront view, AI spend view, storage
-- buckets and storage policies.

-- Published shops and their published, non-archived products, with an
-- in-stock flag and never a count (doc 06, errata E-05). security_invoker
-- means the anon role's own policies and column grants apply (doc 03).
create view public.public_storefront
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
  p.image_path
from public.shops s
left join public.products p
  on p.shop_id = s.id
  and p.is_published
  and p.archived_at is null
where s.is_published;

revoke all on public.public_storefront from anon, authenticated;
grant select on public.public_storefront to anon;

-- Daily AI spend by job, for the budget alerts and admin page (doc 05).
create view public.ai_spend_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at)::date as day,
  job,
  count(*) as calls,
  sum(cost_usd) as cost_usd
from public.ai_calls
group by 1, 2;

revoke all on public.ai_spend_daily from anon, authenticated;
grant select on public.ai_spend_daily to service_role;

-- Buckets (doc 02, doc 03 upload limits). Paths start with the shop id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('voice', 'voice', false, 4194304, array['audio/wav', 'audio/x-wav', 'audio/wave']),
  ('photos', 'photos', false, 3145728, array['image/jpeg']),
  ('catalog-images', 'catalog-images', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Owners reach only objects under {shop_id}/ for a shop they own. Customer
-- review uploads and server jobs use signed URLs or the service role.
create policy storage_owner_select on storage.objects for select to authenticated
  using (
    bucket_id in ('voice', 'photos', 'catalog-images')
    and (storage.foldername(name))[1] in (
      select id::text from public.shops where owner_id = (select auth.uid())
    )
  );
create policy storage_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('voice', 'photos', 'catalog-images')
    and (storage.foldername(name))[1] in (
      select id::text from public.shops where owner_id = (select auth.uid())
    )
  );
create policy storage_owner_update on storage.objects for update to authenticated
  using (
    bucket_id in ('voice', 'photos', 'catalog-images')
    and (storage.foldername(name))[1] in (
      select id::text from public.shops where owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id in ('voice', 'photos', 'catalog-images')
    and (storage.foldername(name))[1] in (
      select id::text from public.shops where owner_id = (select auth.uid())
    )
  );
create policy storage_owner_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('voice', 'photos', 'catalog-images')
    and (storage.foldername(name))[1] in (
      select id::text from public.shops where owner_id = (select auth.uid())
    )
  );
