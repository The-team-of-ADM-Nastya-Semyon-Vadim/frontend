create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    order_payload jsonb;
    items_payload jsonb;
    new_order_id bigint;
begin
    raise log 'create_order payload: %', payload::text;

    order_payload := jsonb_build_object(
        'customer_first_name', coalesce(payload #>> '{customer,first_name}', ''),
        'customer_last_name', coalesce(payload #>> '{customer,last_name}', ''),
        'customer_name', coalesce(payload #>> '{customer,full_name}', ''),
        'phone', coalesce(payload #>> '{customer,phone}', ''),
        'delivery_address', coalesce(payload #>> '{delivery,address}', ''),
        'delivery_entrance', coalesce(payload #>> '{delivery,entrance}', ''),
        'delivery_apartment', coalesce(payload #>> '{delivery,apartment}', ''),
        'delivery_intercom', coalesce(payload #>> '{delivery,intercom}', ''),
        'delivery_floor', coalesce(payload #>> '{delivery,floor}', ''),
        'items_count', coalesce(payload #>> '{summary,items_count}', '0'),
        'subtotal_amount', coalesce(payload #>> '{summary,subtotal_amount}', '0'),
        'delivery_amount', coalesce(payload #>> '{summary,delivery_amount}', '0'),
        'total_amount', coalesce(payload #>> '{summary,total_amount}', '0'),
        'status', 'new',
        'source', coalesce(payload->>'source', 'website'),
        'raw_payload', coalesce(payload, '{}'::jsonb)
    );

    items_payload := coalesce(payload->'items', '[]'::jsonb);
    new_order_id := public.create_order_with_items(order_payload, items_payload);

    return jsonb_build_object(
        'ok', true,
        'order_id', new_order_id,
        'message', format('Заказ №%s успешно отправлен.', new_order_id)
    );
end;
$$;

grant execute on function public.create_order(jsonb) to anon;
grant execute on function public.create_order(jsonb) to authenticated;
