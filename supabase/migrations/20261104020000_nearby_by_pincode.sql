-- Shops near a pincode by distance. A pincode search had no point to
-- measure from, so every shop read "in your area" in name order and shops
-- just across a district line were missed. Now the middle of the shops that
-- share the pincode is the point: results come nearest first with distances,
-- shops within about 50 km of it count too, and the old three-digit match
-- still finds an area that has no shop with a position. Each result also says
-- whether the shop delivers, so the list can say "Pickup only" before a
-- customer fills a cart (testers, Nov 3); a new column means a new function.

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
  lng double precision,
  delivers boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with centre as (
    select
      coalesce(p_lat, (select avg(c.lat) from public.shops c where c.is_published and not c.is_demo and c.pincode = p_pincode and c.lat is not null)) as lat,
      coalesce(p_lng, (select avg(c.lng) from public.shops c where c.is_published and not c.is_demo and c.pincode = p_pincode and c.lng is not null)) as lng
  )
  select s.slug, s.name, s.category, s.address, s.pincode, s.hours, s.timezone,
    case
      when centre.lat is null or centre.lng is null or s.lat is null then null
      else 2 * 6371 * asin(sqrt(
        power(sin(radians(s.lat - centre.lat) / 2), 2)
        + cos(radians(centre.lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - centre.lng) / 2), 2)
      ))
    end as distance_km,
    round(s.lat::numeric, 3)::double precision as lat,
    round(s.lng::numeric, 3)::double precision as lng,
    s.delivers
  from public.shops s, centre
  where s.is_published
    and not s.is_demo
    and (
      -- About 50 km around the point (the customer, or the pincode's shops).
      (centre.lat is not null and centre.lng is not null and s.lat between centre.lat - 0.45 and centre.lat + 0.45 and s.lng between centre.lng - 0.5 and centre.lng + 0.5)
      or (p_pincode is not null and left(s.pincode, 3) = left(p_pincode, 3))
    )
  order by (s.pincode = p_pincode) desc nulls last, distance_km asc nulls last, s.name
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.nearby_shops(double precision, double precision, text, integer) from public, anon, authenticated;
grant execute on function public.nearby_shops(double precision, double precision, text, integer) to service_role;
