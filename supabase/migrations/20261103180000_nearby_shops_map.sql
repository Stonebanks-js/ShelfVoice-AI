-- Shops near you on a map: nearby_shops also returns each shop's
-- position, rounded to three decimals (about 100 m), enough for a pin on a
-- map and no more. Only published, non-demo shops, as before. The return
-- type changes, so the function is dropped and created again.

drop function if exists public.nearby_shops(double precision, double precision, text, integer);

create function public.nearby_shops(p_lat double precision, p_lng double precision, p_pincode text, p_limit integer default 30)
returns table (
  slug text,
  name text,
  category text,
  address text,
  pincode text,
  hours jsonb,
  timezone text,
  distance_km double precision,
  lat double precision,
  lng double precision
)
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
    end as distance_km,
    round(s.lat::numeric, 3)::double precision as lat,
    round(s.lng::numeric, 3)::double precision as lng
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
