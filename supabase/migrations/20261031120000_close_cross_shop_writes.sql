-- R-final security fixes.
--
-- 1. Undo only touches the proposal's own shop. Owners may write a pending
--    proposal's confirmed_changes (the confirm function runs as them), and
--    undo runs as the server, so it must not trust the product ids in that
--    list: each product is now looked up within the proposal's shop, and one
--    from another shop is skipped. Before this, a forged list could archive
--    or reprice any shop's product.
-- 2. Owners can change only the shop fields the app edits. A demo visitor
--    could otherwise clear is_demo to keep the shop past its 24 hours, or
--    pick any slug for its public page.

create or replace function public.undo_proposal(p_proposal_id uuid, p_window_seconds integer default 60)
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
      update public.products set archived_at = now()
      where id = (v_change->>'product_id')::uuid and shop_id = v_prop.shop_id;
      if not found then
        v_result := 'skipped: not in this shop';
      end if;

    else
      select * into v_current from public.products
      where id = (v_change->>'product_id')::uuid and shop_id = v_prop.shop_id
      for update;

      if not found then
        v_result := 'skipped: not in this shop';

      elsif v_change->>'op' = 'update_price' then
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

-- The fields My shop, the publish switch and voice setup change. slug,
-- is_demo, demo_expires_at, owner_id and the forecast settings are the
-- server's.
revoke update on public.shops from authenticated;
grant update (name, category, phone, address, description, hours, language, is_published) on public.shops to authenticated;
