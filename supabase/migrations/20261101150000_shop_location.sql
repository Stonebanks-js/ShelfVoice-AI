-- Shop location (V-03, E-36): where a shop is, so customers can find the
-- ones near them. The owner shares the phone's location during setup, or
-- types the pincode; a shop is a public business, so its location is
-- public once the shop is published.

alter table public.shops
  add column pincode text check (pincode ~ '^[1-9][0-9]{5}$'),
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add constraint shops_lat_lng_together check ((lat is null) = (lng is null));

-- Owners may set them, alongside the other fields the app edits (R-final).
grant update (pincode, lat, lng) on public.shops to authenticated;

create index shops_published_location on public.shops (lat, lng) where is_published;
create index shops_published_pincode on public.shops (pincode) where is_published;

-- Published shops near a point (great-circle distance in km, nearest first)
-- or, without a point, in the same pincode area (same first three digits,
-- the exact pincode first). Demo shops left from before E-36 never show.
-- Called by the server only.
create function public.nearby_shops(p_lat double precision, p_lng double precision, p_pincode text, p_limit integer default 30)
returns table (slug text, name text, category text, address text, pincode text, hours jsonb, timezone text, distance_km double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select s.slug, s.name, s.category, s.address, s.pincode, s.hours, s.timezone,
    case
      when p_lat is null or p_lng is null or s.lat is null then null
      else 2 * 6371 * asin(sqrt(
        power(sin(radians(s.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - p_lng) / 2), 2)
      ))
    end as distance_km
  from public.shops s
  where s.is_published
    and not s.is_demo
    and (
      -- About 50 km around the point.
      (p_lat is not null and p_lng is not null and s.lat between p_lat - 0.45 and p_lat + 0.45 and s.lng between p_lng - 0.5 and p_lng + 0.5)
      or (p_pincode is not null and left(s.pincode, 3) = left(p_pincode, 3))
    )
  order by distance_km asc nulls last, (s.pincode = p_pincode) desc nulls last, s.name
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.nearby_shops(double precision, double precision, text, integer) from public, anon, authenticated;
grant execute on function public.nearby_shops(double precision, double precision, text, integer) to service_role;
