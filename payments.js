import {createHmac,timingSafeEqual} from 'node:crypto';
export function validSignature(secret, paymentId, headers) {
  const id=headers['x-request-id'];
  const parts=Object.fromEntries((headers['x-signature']??'').split(',').map(part=>part.trim().split('=')));
  if (!secret || !id || !/^\d+$/.test(paymentId??'') || !/^\d+$/.test(parts.ts??'') || !/^[a-f0-9]{64}$/i.test(parts.v1??'')) return false;
  const expected=createHmac('sha256',secret).update(`id:${paymentId};request-id:${id};ts:${parts.ts};`).digest();
  return timingSafeEqual(expected,Buffer.from(parts.v1,'hex'));
}
export function matchesPayment(payment, order, collector, live) {
  return String(payment.collector_id)===String(collector) && payment.live_mode===live &&
    payment.external_reference===order.id && payment.currency_id==='ARS' &&
    /^\d+(\.\d{1,2})?$/.test(String(payment.transaction_amount)) &&
    Math.round(Number(payment.transaction_amount)*100)===order.cents;
}
export async function mp(token, path, payload) {
  const response=await fetch('https://api.mercadopago.com'+path,{
    method:payload?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(8000),redirect:'error'
  });
  if(!response.ok) throw Object.assign(new Error(`Mercado Pago devolvió HTTP ${response.status}`),{providerStatus:response.status});
  return response.json();
}
