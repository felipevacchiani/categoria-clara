// Test-only process preload. Production imports no fixture.
const reference=new Map();
let approval;
let approvedRequests=0;
globalThis.fetch=async (address,options)=>{
  const url=new URL(address);
  if(url.hostname!=='api.mercadopago.com') throw Error('Unexpected test provider: '+url.hostname);
  if(url.pathname==='/checkout/preferences'){
    const order=JSON.parse(options.body);
    approval=order;
    reference.set(order.external_reference, order);
    return Response.json({sandbox_init_point:'https://sandbox.mercadopago.com.ar/checkout/start?pref_id=fixture'});
  }
  if(url.pathname.startsWith('/v1/payments/')&&approval){
    const {external_reference,items:[item]}=reference.get(approval.external_reference);
    const id=url.pathname.split('/').at(-1);
    if(id==='800') approvedRequests++;
    return Response.json({
      id,external_reference,collector_id:42,live_mode:false,currency_id:'ARS',
      transaction_amount:item.unit_price+(id==='600'?1:0),status:id==='700'?'pending':id==='800'&&approvedRequests>=3?'refunded':'approved'
    });
  }
  return new Response('',{status:404});
};
