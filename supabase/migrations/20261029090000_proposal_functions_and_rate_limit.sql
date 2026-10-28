-- Migration 8: confirm and undo for proposals (doc 02 propose-then-confirm,
-- errata E-02), and the fixed-window rate-limit counter (decision P4).

-- ---------------------------------------------------------------- rate limit
-- Counts one hit for a key in the current fixed window and returns the new
-- count. Server-only: called with the service role.
create function public.hit_rate_limit(p_key text, p_window_seconds integer)
returns integer
language sql
set search_path = ''
as $$
  insert into public.rate_limits as r (key, window_start, count)
  values (
    p_key,
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds),
    1
  )
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count;
$$;

revoke all on function public.hit_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer) to service_role;

-- ----------------------------------------------------------- confirm proposal
-- Applies an owner-approved list of changes in one transaction, as the owner
-- (SECURITY INVOKER, so RLS decides what they may touch). Every change is
-- returned with its before and after values, which undo needs. Confirming an
-- already-confirmed proposal returns the stored result (idempotent).
--
-- Change shapes (validated by the server with Zod before this is called):
--   {op: update_shop, name?, category?, phone?, address?, description?, hours?}
--   {op: add_product, name, unit?, category?, price_paise?, aliases?, stock_qty?}
--   {op: update_price, product_id, price_paise}
--   {op: set_in_stock, product_id, in_stock}
--   {op: set_stock_count, product_id, count}
--   {op: record_sale | record_delivery, product_id, qty, unit_price_paise?}
create function public.confirm_proposal(p_proposal_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_prop public.proposals;
  v_change jsonb;
  v_idx integer := 0;
  v_out jsonb := '[]'::jsonb;
  v_shop public.shops;
  v_product public.products;
  v_product_id uuid;
  v_movement_id uuid;
  v_qty integer;
  v_source public.movement_source;
  v_after_stock integer;
begin
  -- Locking needs the owner's update policy, which only covers PENDING rows.
  -- If the lock finds nothing, a plain read tells "already decided" (return
  -- the stored result for a confirmed one) from "not this owner's".
  select * into v_prop from public.proposals where id = p_proposal_id for update;
  if not found then
    select * into v_prop from public.proposals where id = p_proposal_id;
    if not found then
      raise exception 'proposal % not found', p_proposal_id using errcode = 'P0002', hint = 'PROPOSAL_NOT_FOUND';
    end if;
    if v_prop.status = 'CONFIRMED' then
      return v_prop.confirmed_changes;
    end if;
    raise exception 'proposal % is %', p_proposal_id, v_prop.status using errcode = 'P0001', hint = 'PROPOSAL_NOT_PENDING';
  end if;
  if jsonb_typeof(p_changes) <> 'array' then
    raise exception 'changes must be an array' using errcode = '22023', hint = 'INVALID_CHANGES';
  end if;

  v_source := case v_prop.kind when 'BILL' then 'BILL'::public.movement_source else 'VOICE'::public.movement_source end;

  for v_change in select value from jsonb_array_elements(p_changes) loop
    v_idx := v_idx + 1;

    if v_change->>'op' = 'update_shop' then
      select * into v_shop from public.shops where id = v_prop.shop_id;
      update public.shops set
        name = case when v_change ? 'name' then v_change->>'name' else name end,
        category = case when v_change ? 'category' then v_change->>'category' else category end,
        phone = case when v_change ? 'phone' then v_change->>'phone' else phone end,
        address = case when v_change ? 'address' then v_change->>'address' else address end,
        description = case when v_change ? 'description' then v_change->>'description' else description end,
        hours = case when v_change ? 'hours' then v_change->'hours' else hours end
      where id = v_prop.shop_id;
      v_out := v_out || jsonb_build_object(
        'op', 'update_shop',
        'before', jsonb_build_object('name', v_shop.name, 'category', v_shop.category, 'phone', v_shop.phone,
          'address', v_shop.address, 'description', v_shop.description, 'hours', v_shop.hours),
        'after', v_change - 'op');

    elsif v_change->>'op' = 'add_product' then
      insert into public.products (shop_id, name, unit, category, price_paise, aliases, stock_qty, is_in_stock)
      values (
        v_prop.shop_id,
        v_change->>'name',
        v_change->>'unit',
        v_change->>'category',
        (v_change->>'price_paise')::integer,
        coalesce(array(select jsonb_array_elements_text(v_change->'aliases')), '{}'),
        (v_change->>'stock_qty')::integer,
        coalesce((v_change->>'stock_qty')::integer > 0, true)
      )
      returning id into v_product_id;
      v_out := v_out || jsonb_build_object('op', 'add_product', 'product_id', v_product_id, 'after', v_change - 'op');

    elsif v_change->>'op' in ('update_price', 'set_in_stock', 'set_stock_count', 'record_sale', 'record_delivery') then
      select * into v_product from public.products
      where id = (v_change->>'product_id')::uuid and shop_id = v_prop.shop_id
      for update;
      if not found then
        raise exception 'product % is not in this shop', v_change->>'product_id'
          using errcode = 'P0002', hint = 'PRODUCT_NOT_FOUND';
      end if;

      if v_change->>'op' = 'update_price' then
        update public.products set price_paise = (v_change->>'price_paise')::integer where id = v_product.id;
        v_out := v_out || jsonb_build_object('op', 'update_price', 'product_id', v_product.id,
          'before', jsonb_build_object('price_paise', v_product.price_paise),
          'after', jsonb_build_object('price_paise', (v_change->>'price_paise')::integer));

      elsif v_change->>'op' = 'set_in_stock' then
        update public.products set is_in_stock = (v_change->>'in_stock')::boolean where id = v_product.id;
        v_out := v_out || jsonb_build_object('op', 'set_in_stock', 'product_id', v_product.id,
          'before', jsonb_build_object('in_stock', v_product.is_in_stock),
          'after', jsonb_build_object('in_stock', (v_change->>'in_stock')::boolean));

      elsif v_change->>'op' = 'set_stock_count' then
        v_qty := (v_change->>'count')::integer;
        v_movement_id := null;
        if v_product.stock_qty is null then
          -- Starting to track this item: set the count directly.
          update public.products set stock_qty = v_qty, is_in_stock = v_qty > 0 where id = v_product.id;
        elsif v_qty <> v_product.stock_qty then
          insert into public.stock_movements (shop_id, product_id, kind, qty, source, proposal_id, idempotency_key)
          values (v_prop.shop_id, v_product.id, 'CORRECTION', v_qty - v_product.stock_qty, v_source, v_prop.id,
            'proposal:' || v_prop.id || ':' || v_idx)
          returning id into v_movement_id;
        end if;
        v_out := v_out || jsonb_build_object('op', 'set_stock_count', 'product_id', v_product.id,
          'movement_id', v_movement_id,
          'before', jsonb_build_object('stock_qty', v_product.stock_qty),
          'after', jsonb_build_object('stock_qty', v_qty));

      else
        v_qty := (v_change->>'qty')::integer;
        insert into public.stock_movements
          (shop_id, product_id, kind, qty, unit_price_paise, source, proposal_id, idempotency_key)
        values (
          v_prop.shop_id, v_product.id,
          case v_change->>'op' when 'record_sale' then 'SALE'::public.movement_kind else 'DELIVERY'::public.movement_kind end,
          v_qty, (v_change->>'unit_price_paise')::integer, v_source, v_prop.id,
          'proposal:' || v_prop.id || ':' || v_idx
        )
        returning id into v_movement_id;
        select stock_qty into v_after_stock from public.products where id = v_product.id;
        v_out := v_out || jsonb_build_object('op', v_change->>'op', 'product_id', v_product.id,
          'movement_id', v_movement_id, 'qty', v_qty,
          'before', jsonb_build_object('stock_qty', v_product.stock_qty),
          'after', jsonb_build_object('stock_qty', v_after_stock));
      end if;

    else
      raise exception 'unknown change op %', v_change->>'op' using errcode = '22023', hint = 'INVALID_CHANGES';
    end if;
  end loop;

  update public.proposals
  set status = 'CONFIRMED', confirmed_changes = v_out, decided_at = now()
  where id = p_proposal_id;

  return v_out;
end;
$$;

revoke all on function public.confirm_proposal(uuid, jsonb) from public, anon;
grant execute on function public.confirm_proposal(uuid, jsonb) to authenticated, service_role;

-- -------------------------------------------------------------- undo proposal
-- Reverses a confirmed proposal within the undo window (errata E-02) by
-- writing offsetting changes; nothing is deleted. Server-only (service role),
-- called after the server has checked the caller owns the proposal. A change
-- that no longer matches what was confirmed (edited since, or stock already
-- sold) is skipped and reported, never forced.
create function public.undo_proposal(p_proposal_id uuid, p_window_seconds integer default 60)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_prop public.proposals;
  v_change jsonb;
  v_idx integer;
  v_out jsonb := '[]'::jsonb;
  v_result text;
  v_current public.products;
  v_qty integer;
begin
  select * into v_prop from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'proposal % not found', p_proposal_id using errcode = 'P0002', hint = 'PROPOSAL_NOT_FOUND';
  end if;
  if v_prop.status = 'UNDONE' then
    return v_prop.confirmed_changes;
  end if;
  if v_prop.status <> 'CONFIRMED' or v_prop.decided_at < now() - make_interval(secs => p_window_seconds) then
    raise exception 'proposal % can no longer be undone', p_proposal_id using errcode = 'P0001', hint = 'UNDO_WINDOW_CLOSED';
  end if;

  -- Reverse in the opposite order to confirmation.
  for v_idx in reverse jsonb_array_length(v_prop.confirmed_changes) - 1 .. 0 loop
    v_change := v_prop.confirmed_changes -> v_idx;
    v_result := 'reverted';

    if v_change->>'op' = 'update_shop' then
      update public.shops set
        name = coalesce(v_change->'before'->>'name', name),
        category = v_change->'before'->>'category',
        phone = v_change->'before'->>'phone',
        address = v_change->'before'->>'address',
        description = v_change->'before'->>'description',
        hours = v_change->'before'->'hours'
      where id = v_prop.shop_id;

    elsif v_change->>'op' = 'add_product' then
      update public.products set archived_at = now() where id = (v_change->>'product_id')::uuid;

    else
      select * into v_current from public.products where id = (v_change->>'product_id')::uuid for update;

      if v_change->>'op' = 'update_price' then
        if v_current.price_paise is not distinct from (v_change->'after'->>'price_paise')::integer then
          update public.products set price_paise = (v_change->'before'->>'price_paise')::integer where id = v_current.id;
        else
          v_result := 'skipped: price changed since';
        end if;

      elsif v_change->>'op' = 'set_in_stock' then
        if v_current.is_in_stock = (v_change->'after'->>'in_stock')::boolean then
          update public.products set is_in_stock = (v_change->'before'->>'in_stock')::boolean where id = v_current.id;
        else
          v_result := 'skipped: availability changed since';
        end if;

      elsif v_change->>'op' in ('record_sale', 'record_delivery', 'set_stock_count') then
        if v_change->>'op' = 'set_stock_count' and v_change->>'movement_id' is null then
          -- Tracking started by this proposal, or the count was unchanged.
          if (v_change->'before'->>'stock_qty') is null
            and v_current.stock_qty is not distinct from (v_change->'after'->>'stock_qty')::integer then
            update public.products set stock_qty = null where id = v_current.id;
          end if;
        else
          v_qty := case v_change->>'op'
            when 'record_sale' then (v_change->>'qty')::integer
            when 'record_delivery' then -(v_change->>'qty')::integer
            else (v_change->'before'->>'stock_qty')::integer - (v_change->'after'->>'stock_qty')::integer
          end;
          begin
            insert into public.stock_movements (shop_id, product_id, kind, qty, source, proposal_id, idempotency_key)
            values (v_prop.shop_id, v_current.id, 'CORRECTION', v_qty, 'UNDO', v_prop.id,
              'undo:' || v_prop.id || ':' || v_idx);
          exception when check_violation then
            v_result := 'skipped: stock already sold';
          end;
        end if;
      end if;
    end if;

    v_out := jsonb_build_array(v_change || jsonb_build_object('undo', v_result)) || v_out;
  end loop;

  update public.proposals
  set status = 'UNDONE', confirmed_changes = v_out
  where id = p_proposal_id;

  return v_out;
end;
$$;

revoke all on function public.undo_proposal(uuid, integer) from public, anon, authenticated;
grant execute on function public.undo_proposal(uuid, integer) to service_role;

-- -------------------------------------------------------------- AI spend
-- Spend so far for the budget caps (doc 05, errata E-06): all time, today in
-- India time, and today for one shop. Server-only.
create function public.ai_spend(p_shop_id uuid default null)
returns table (total_usd numeric, today_usd numeric, shop_today_usd numeric)
language sql
stable
set search_path = ''
as $$
  with today as (
    select (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as start
  )
  select
    coalesce(sum(c.cost_usd), 0),
    coalesce(sum(c.cost_usd) filter (where c.created_at >= today.start), 0),
    coalesce(sum(c.cost_usd) filter (where c.created_at >= today.start and c.shop_id = p_shop_id), 0)
  from public.ai_calls c, today;
$$;

revoke all on function public.ai_spend(uuid) from public, anon, authenticated;
grant execute on function public.ai_spend(uuid) to service_role;
