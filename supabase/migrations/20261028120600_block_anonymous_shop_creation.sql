-- "Try the demo shop" visitors get an anonymous sign-in that owns one demo
-- copy made by the server (doc 03). They may work inside that copy, but must
-- not create shops of their own through the API.
drop policy shops_owner_insert on public.shops;

create policy shops_owner_insert on public.shops for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );
