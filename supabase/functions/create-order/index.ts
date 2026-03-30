import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json; charset=utf-8',
        },
    });
}

function normalizeText(value: unknown) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeMoney(value: unknown) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return jsonResponse({ message: 'Method not allowed.' }, 405);
    }

    try {
        const payload = await request.json();
        console.log('create-order incoming payload:', JSON.stringify(payload, null, 2));

        const firstName = normalizeText(payload?.customer?.first_name);
        const lastName = normalizeText(payload?.customer?.last_name);
        const phone = normalizeText(payload?.customer?.phone);
        const address = normalizeText(payload?.delivery?.address);
        const entrance = normalizeText(payload?.delivery?.entrance);
        const apartment = normalizeText(payload?.delivery?.apartment);
        const intercom = normalizeText(payload?.delivery?.intercom);
        const floor = normalizeText(payload?.delivery?.floor);
        const source = normalizeText(payload?.source) || 'website';

        const items = Array.isArray(payload?.items)
            ? payload.items
                  .map((item: Record<string, unknown>) => {
                      const quantity = Math.max(1, Math.trunc(Number(item?.quantity) || 0));
                      const unitPrice = normalizeMoney(item?.unit_price);

                      return {
                          product_id: normalizeText(item?.product_id),
                          product_name: normalizeText(item?.product_name) || 'Товар',
                          quantity,
                          unit_price: unitPrice,
                          line_total: normalizeMoney(item?.line_total) || quantity * unitPrice,
                          image_url: normalizeText(item?.image_url),
                      };
                  })
                  .filter((item) => item.quantity > 0)
            : [];

        if (!firstName || !lastName || !phone || !address) {
            return jsonResponse(
                { message: 'Не хватает обязательных данных покупателя или адреса.' },
                400
            );
        }

        if (items.length === 0) {
            return jsonResponse({ message: 'Корзина пуста. Добавьте товары перед отправкой.' }, 400);
        }

        const subtotalAmount = items.reduce(
            (sum, item) => sum + item.unit_price * item.quantity,
            0
        );
        const deliveryAmount = normalizeMoney(payload?.summary?.delivery_amount);
        const totalAmount = subtotalAmount + deliveryAmount;
        const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            console.error('create-order env error: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
            return jsonResponse({ message: 'Сервер заказа не настроен.' }, 500);
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        const orderPayload = {
            customer_first_name: firstName,
            customer_last_name: lastName,
            customer_name: `${firstName} ${lastName}`.trim(),
            phone,
            delivery_address: address,
            delivery_entrance: entrance || null,
            delivery_apartment: apartment || null,
            delivery_intercom: intercom || null,
            delivery_floor: floor || null,
            items_count: itemsCount,
            subtotal_amount: subtotalAmount,
            delivery_amount: deliveryAmount,
            total_amount: totalAmount,
            status: 'new',
            source,
            raw_payload: payload,
        };

        console.log(
            'create-order normalized payload:',
            JSON.stringify({ orderPayload, itemsPayload: items }, null, 2)
        );

        const { data: orderId, error } = await supabaseAdmin.rpc('create_order_with_items', {
            order_payload: orderPayload,
            items_payload: items,
        });

        if (error) {
            console.error('create-order rpc error:', error);
            return jsonResponse({ message: 'Не удалось сохранить заказ в базе данных.' }, 500);
        }

        console.log('create-order success:', orderId);

        return jsonResponse({
            ok: true,
            orderId,
            message: `Заказ №${orderId} успешно отправлен.`,
        });
    } catch (error) {
        console.error('create-order unexpected error:', error);
        return jsonResponse({ message: 'Не удалось обработать заказ.' }, 500);
    }
});
