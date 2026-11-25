import {TABLE as MONO_TABLE,RECATEGORIZACION} from './monotributo.js';
import {createServer} from 'node:http';
import {createHash,randomBytes,randomUUID,scrypt,timingSafeEqual,createCipheriv,createDecipheriv} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {promisify} from 'node:util';
import {openDatabase,atomic} from './db.js';
import {startIndices} from './indices.js';
import {services,listed as catalog,getService,evaluate} from './services.js';
import {pitch,cases,site} from './marketing.js';
import {CONSUMO,ENVIO,VUELO} from './reclamos.js';
import {matchesPayment,mp,validSignature} from './payments.js';
import {sources} from './sources.js';
import {pdf} from './pdf.js';

const env=process.env;
const origin=new URL(env.PUBLIC_ORIGIN||'http://localhost:3000').origin;
const secure=origin.startsWith('https:');
const live=env.MP_MODE==='live';
const token=env.MP_ACCESS_TOKEN;
const mode=live?'live':'test';
const adminEmail=env.ADMIN_EMAIL?.toLowerCase();
const release=env.RELEASE_FILE?JSON.parse(readFileSync(env.RELEASE_FILE,'utf8')):{};
const legacyDbPath='data/resolveya.sqlite';
const dbPath=env.DB_PATH||(existsSync(legacyDbPath)?legacyDbPath:'data/gestion-clara.sqlite');
if(env.DATA_KEY&&!/^[a-f0-9]{64}$/i.test(env.DATA_KEY)) throw Error('DATA_KEY debe contener 64 caracteres hexadecimales');
const key=env.DATA_KEY?Buffer.from(env.DATA_KEY,'hex'):null;
const retention=Number(env.RETENTION_DAYS||0);
if(env.RETENTION_DAYS&&!(Number.isInteger(retention)&&retention>=30)) throw Error('RETENTION_DAYS debe ser un entero de 30 o más.');
if(live&&(!secure||!key||!token||!env.MP_WEBHOOK_SECRET||!env.MP_COLLECTOR_ID||!release.policyVersion||!release.terms||!release.privacy||!release.business||!release.support||!env.RESEND_KEY||!env.MAIL_FROM)) throw Error('Configuración comercial incompleta. Consultá README.md.');
if(dbPath!==':memory:') mkdirSync(dirname(dbPath),{recursive:true,mode:0o700});
process.umask(0o077);
const db=openDatabase(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS deliveries(order_id TEXT PRIMARY KEY REFERENCES orders(id),attempts INTEGER DEFAULT 0,next INTEGER DEFAULT 0,state TEXT DEFAULT 'pending');`);
const sql=(query,...args)=>db.prepare(query).run(...args);
const one=(query,...args)=>db.prepare(query).get(...args);
const all=(query,...args)=>db.prepare(query).all(...args);
const time=()=>new Date().toISOString();
const hash=text=>createHash('sha256').update(text).digest('hex');
const adapt=promisify(scrypt);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ars=cents=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(cents/100);
const pathFor=s=>'/servicios/'+s.slug;
const policy=release.policyVersion||'local-v1';
const failures=new Map();
const statuses={pending:'Pendiente de pago',ready:'Informe disponible',refunded:'Devuelto',disputed:'Pago en revisión'};
const price=s=>{
  const entry=release.products?.[s.slug];
  if(!s.sellable||!token||!env.MP_COLLECTOR_ID||!env.MP_WEBHOOK_SECRET||!secure||!key) return 0;
  if(!Number.isSafeInteger(entry?.cents)||entry.cents<100||entry.cents>100000000) return 0;
  if(live&&(entry.version!==s.version||!entry.approval||!entry.approvedBy)) return 0;
  return entry.cents;
};
// Un servicio pago sin precio habilitado (credenciales o aprobación faltantes) no se muestra: nunca se entrega gratis.
const isReclamo=s=>['consumo-defensa','envio-reclamo','vuelo-reclamo'].includes(s?.slug);
const shown=()=>catalog.filter(s=>!s.sellable||price(s));
const event=(kind,slug,id=randomUUID(),source=null)=>sql('INSERT OR IGNORE INTO events(id,kind,slug,created,source) VALUES (?,?,?,?,?)',id,kind,slug,time(),source);
const sourceOf=value=>value==='ficha'||cases.some(c=>c.path===value)?value:'ficha';
function seal(value) {
  if(!key) return Buffer.concat([Buffer.from('0'),Buffer.from(value)]);
  const nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,nonce);
  const bytes=Buffer.concat([cipher.update(value),cipher.final()]);
  return Buffer.concat([Buffer.from('1'),nonce,cipher.getAuthTag(),bytes]);
}
function unseal(value) {
  const bytes=Buffer.from(value);
  if(bytes[0]===48&&!live) return bytes.subarray(1);
  if(bytes[0]!==49||!key) throw Error('Datos cifrados sin clave');
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(1,13));
  decipher.setAuthTag(bytes.subarray(13,29));
  return Buffer.concat([decipher.update(bytes.subarray(29)),decipher.final()]);
}
async function password(value,salt=randomBytes(16).toString('hex')) {
  return salt+':'+(await adapt(value,salt,64)).toString('hex');
}
function identity(req) {
  const raw=req.headers.cookie?.match(/(?:^|;\s*)ry=([a-f0-9]{64})(?:;|$)/)?.[1];
  return raw?one('SELECT users.*,sessions.token FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND expires>?',hash(raw),Date.now()):null;
}
const cookie=(value,age)=>`ry=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
const admin=user=>Boolean(user&&one('SELECT 1 FROM admins WHERE user_id=?',user.id));
const link=(href,label)=>`<a class="button" href="${esc(href)}">${esc(label)}</a>`;
const post=(url,inner)=>`<form method="post" action="${esc(url)}">${inner}</form>`;
async function jsonBody(req,max=1048576){
  if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json')) fail(403,'Solicitud inválida.');
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>max) fail(413,'Demasiados datos de una vez.');chunks.push(chunk);}
  try {return JSON.parse(Buffer.concat(chunks).toString()||'{}');} catch {fail(400,'Datos inválidos.');}
}
const sendJson=(res,data,code=200)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
async function startSession(res,account,days=30){
  const session=randomBytes(32).toString('hex');
  sql('DELETE FROM sessions WHERE expires<=?',Date.now());
  sql('INSERT INTO sessions VALUES (?,?,?)',hash(session),account.id,Date.now()+days*86400000);
  res.setHeader('Set-Cookie',cookie(session,days*86400));
}
async function checkPassword(account,candidatePlain){
  const usable=account&&account.password&&account.password!=='!';
  const stored=usable?account.password:'0'.repeat(32)+':'+'0'.repeat(128);
  const candidate=await password(String(candidatePlain||'').slice(0,128),stored.split(':')[0]);
  return usable&&stored.length===candidate.length&&timingSafeEqual(Buffer.from(stored),Buffer.from(candidate));
}
async function sendAccountLink(account,purpose){
  const raw=randomBytes(32).toString('hex');
  sql('DELETE FROM account_tokens WHERE expires<=? OR (user_id=? AND purpose=?)',Date.now(),account.id,purpose);
  sql('INSERT INTO account_tokens VALUES (?,?,?,?)',hash(raw),account.id,purpose,Date.now()+(purpose==='reset'?3600000:7*86400000));
  const url=`${origin}/cuenta/${purpose==='reset'?'restablecer':'verificar'}?t=${raw}`;
  const [subject,text]=purpose==='reset'
    ?['Restablecer tu contraseña · Categoría Clara','Pediste cambiar la contraseña de tu cuenta de Categoría Clara. Entrá a este enlace dentro de la próxima hora. Si no fuiste vos, ignorá este correo: tu contraseña no cambia.']
    :['Confirmá tu correo · Categoría Clara','Bienvenido a Categoría Clara. Confirmá tu correo entrando a este enlace (vale 7 días). Así podés recuperar tu cuenta si olvidás la contraseña.'];
  try {await mailLink(account.email,subject,text,url);} catch {console.error('Error al enviar correo de cuenta');}
}
function takeToken(raw,purpose,consume=true){
  if(!/^[a-f0-9]{64}$/.test(String(raw||''))) return null;
  const row=one('SELECT * FROM account_tokens WHERE digest=? AND purpose=? AND expires>?',hash(raw),purpose,Date.now());
  if(row&&consume) sql('DELETE FROM account_tokens WHERE digest=?',row.digest);
  return row?one('SELECT * FROM users WHERE id=?',row.user_id):null;
}
const hasPortal=account=>Boolean(account&&(admin(account)||one('SELECT 1 FROM orders WHERE user_id=? AND approved_payment IS NOT NULL LIMIT 1',account.id)));
function portalInvite(order){
  const owner=one('SELECT email,password FROM users WHERE id=?',order.user_id);
  if(!owner) return '';
  const active=owner.password!=='!';
  return `<div class="portal-invite"><h2>Tu portal para gestionar el Monotributo</h2><p>Con tu compra tenés acceso a <b>Mi facturación</b>: cargá tus facturas durante el año y seguí en tiempo real tu categoría y cuánto te falta para el tope.</p><a class="button" href="/mi-facturacion?email=${encodeURIComponent(owner.email)}#${active?'ingresar':'crear'}">${active?'Ir a mi portal':'Activar mi portal'}</a></div>`;
}
const verified=account=>Boolean(one('SELECT 1 FROM verified_emails WHERE user_id=?',account.id));
function portalData(account){
  const perfil=one('SELECT actividad,categoria FROM portal_profiles WHERE user_id=?',account.id)||{actividad:'servicios',categoria:''};
  const facturas=all('SELECT id,fecha,tipo,cents,detail FROM invoices WHERE user_id=? ORDER BY fecha DESC,created DESC',account.id).map(r=>{
    let d={};try{d=JSON.parse(unseal(r.detail).toString());}catch{}
    return {id:r.id,fecha:r.fecha,tipo:r.tipo,monto:r.cents/100,numero:d.numero||'',cliente:d.cliente||''};
  });
  return {email:account.email,perfil,facturas};
}
const ISO=/^\d{4}-\d{2}-\d{2}$/;
function cleanInvoice(f){
  const fecha=String(f?.fecha||'');
  const cents=Math.round(Number(f?.monto)*100);
  if(!ISO.test(fecha)||!Number.isFinite(Date.parse(fecha))||fecha<'2015-01-01'||fecha>'2100-01-01') return null;
  if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000000) return null;
  return {fecha,tipo:f.tipo==='NC'?'NC':'F',cents,numero:String(f.numero||'').slice(0,40),cliente:String(f.cliente||'').slice(0,80),key:f.key?String(f.key).slice(0,200):null};
}

const button=label=>`<button type="submit">${esc(label)}</button>`;
function page(res, title, body, {user,status=200,canonical,description='Calculá tu categoría del Monotributo, sabé si te tenés que recategorizar y llevá tu facturación al día. Tabla oficial de ARCA.',jsonld}={}) {
  res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':canonical&&!user?'public, max-age=60':'private, no-store','Vary':'Cookie'});
  res.end(`<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#16181d"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><title>${esc(title)} · Categoría Clara</title><meta name="description" content="${esc(description)}">${canonical?`<link rel="canonical" href="${esc(origin+canonical)}"><meta property="og:title" content="${esc(title+' · Categoría Clara')}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(origin+canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="es_AR"><meta property="og:site_name" content="Categoría Clara"><meta property="og:image" content="${esc(origin)}/og.png"><meta name="twitter:card" content="summary_large_image">${jsonld?`<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g,'\\u003c')}</script>`:''}`:'<meta name="robots" content="noindex,nofollow">'}<link rel="stylesheet" href="/style.css"><script defer src="/site.js"></script></head>
  <body><header><nav aria-label="Principal"><a class="brand" href="/">Categoría <b>Clara</b></a>${user&&user.password!=='!'?'<a href="/mi-facturacion">Mi facturación</a>':''}<a href="/#servicios">Servicios</a><a href="/guias">Guías</a><a href="/arrepentimiento">Botón de arrepentimiento</a><a href="/mis-reclamos">Mis informes</a>${admin(user)?'<a href="/admin">Administración</a>':''}${user&&user.password!=='!'?'':'<a class="nav-cta" href="/mi-facturacion">Ingresar</a>'}</nav></header>
  <main>${body}</main><footer><span>Categoría Clara</span><a href="/guias">Guías</a><a href="/terminos">Términos</a><a href="/privacidad">Privacidad</a>${release.support?`<a href="mailto:${esc(release.support)}">Soporte</a>`:''}</footer></body></html>`);
}
function plain(res,code,message,type='text/plain; charset=utf-8') {
  res.writeHead(code,{'Content-Type':type}); res.end(message);
}
function redirect(res,location) {res.writeHead(303,{Location:location,'Cache-Control':'no-store'});res.end();}
function fail(status,message) {throw Object.assign(Error(message),{status});}
async function form(req) {
  if(req.headers.origin!==origin || !req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) fail(403,'Solicitud de formulario inválida.');
  const chunks=[];let size=0;
  for await(const chunk of req) {size+=chunk.length;if(size>16384) fail(413,'Formulario demasiado extenso.');chunks.push(chunk);}
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
}
function limit(req,route,max) {
  const address=env.TRUST_PROXY==='1'?req.headers['x-real-ip']||req.socket.remoteAddress:req.socket.remoteAddress;
  const id=route+':'+address;
  const now=Date.now();
  const row=failures.get(id)??{reset:0,hits:0};
  if(row.reset<now){row.hits=0;row.reset=now+600000;}
  row.hits++;
  failures.set(id,row);
  if(row.hits>max) fail(429,'Demasiados intentos. Probá más tarde.');
}
setInterval(()=>{for(const [id,row] of failures) if(row.reset<Date.now()) failures.delete(id);},600000).unref();
const resultLines=(service,lines,id)=>[
  `Servicio: ${service.name} · Motor ${service.version}`,
  `Referencia: ${id} · ${time().slice(0,10)} UTC`,
  'Informe privado basado en datos ingresados por el cliente.',
  service.description,'',...lines
];
function acceptPayment(payment, order) {
  atomic(db,()=>{
    const current=one('SELECT * FROM orders WHERE id=?',order.id);
    const paymentId=String(payment.id);
    const old=one('SELECT * FROM payments WHERE id=?',paymentId);
    if(old&&old.order_id!==order.id) return;
    if(old&&['refunded','charged_back'].includes(old.status)&&payment.status==='approved') return;
    sql('INSERT INTO payments VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status',paymentId,order.id,payment.status);
    const partial=Number(payment.transaction_amount_refunded||0)>0;
    if(payment.status==='approved'&&!partial&&current.state==='pending'&&!current.purged_at){
      const {title,lines}=JSON.parse(unseal(current.result));
      const report=pdf(title,lines);
      sql('INSERT INTO reports VALUES (?,?,?)',order.id,seal(report),time());
      sql("UPDATE orders SET state='ready', approved_payment=? WHERE id=?",paymentId,order.id);
      sql('INSERT INTO deliveries(order_id) VALUES (?)',order.id);
      event('purchase',order.slug,'purchase:'+order.id,order.source);
      event('report_delivered',order.slug,'report:'+order.id,order.source);
    }
    const next=payment.status==='refunded'?'refunded':
      partial||['charged_back','in_mediation'].includes(payment.status)?'disputed':null;
    if(!next&&payment.status==='approved'&&current.state==='disputed'&&current.approved_payment===paymentId){
      sql("UPDATE orders SET state='ready' WHERE id=?",order.id);
      sql("UPDATE deliveries SET state='pending' WHERE order_id=? AND state='held'",order.id);
    }
    if(next&&current.approved_payment===paymentId&&current.state!==next){
      sql('UPDATE orders SET state=? WHERE id=?',next,order.id);
      sql("UPDATE deliveries SET state='held' WHERE order_id=? AND state!='sent'",order.id);
      event(next,order.slug,next+':'+order.id);
    }
  });
}
async function reconcile(paymentId) {
  if(!/^\d{1,24}$/.test(paymentId)||!token||!env.MP_COLLECTOR_ID) throw Error('Configuración o ID inválido');
  const payment=await mp(token,'/v1/payments/'+paymentId);
  if(String(payment.id)!==paymentId) throw Error('Referencia inválida');
  const order=one('SELECT * FROM orders WHERE id=?',String(payment.external_reference));
  if(!order||order.mode!==mode||!matchesPayment(payment,order,env.MP_COLLECTOR_ID,live)) return false;
  acceptPayment(payment,order);
  return true;
}
// Consulta activa a Mercado Pago: no depender solo del webhook.
const lastSync=new Map();
async function syncOrder(order){
  if(!order||order.state!=='pending'||order.mode!==mode||!token) return false;
  const now=Date.now();
  if((lastSync.get(order.id)||0)>now-15000) return false;
  lastSync.set(order.id,now);
  const found=await mp(token,'/v1/payments/search?external_reference='+encodeURIComponent(order.id)+'&sort=date_created&criteria=desc');
  let changed=false;
  for(const p of (found.results||[]).slice(0,10)) if(await reconcile(String(p.id)).catch(()=>false)) changed=true;
  return changed;
}
async function sweepPending(){
  const since=new Date(Date.now()-3*86400000).toISOString();
  for(const order of all("SELECT * FROM orders WHERE state='pending' AND mode=? AND created>? ORDER BY created DESC LIMIT 50",mode,since))
    await syncOrder(order).catch(()=>console.error('Error al consultar un pago pendiente'));
}
function sendMail(to,subject,text,id) {
  const headers={Authorization:'Bearer '+env.RESEND_KEY,'Content-Type':'application/json'};
  if(id) headers['Idempotency-Key']=id;
  return fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),redirect:'error',headers,
    body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject,text})});
}
async function mailLink(to,subject,text,url,id) {
  if(env.RESEND_KEY&&env.MAIL_FROM){
    const response=await sendMail(to,subject,text+'\n\n'+url,id);
    if(!response.ok) throw Error('mail '+response.status);
    return;
  }
  if(live) throw Error('Correo no configurado');
  console.log(`[desarrollo] ${subject}: ${url}`);
}
function purge() {
  if(!retention) return 0;
  const cutoff=new Date(Date.now()-retention*86400000).toISOString();
  const old=all('SELECT id FROM orders WHERE created<? AND purged_at IS NULL',cutoff);
  for(const {id} of old) atomic(db,()=>{
    sql('DELETE FROM reports WHERE order_id=?',id);
    sql('UPDATE orders SET result=?, purged_at=? WHERE id=?',seal(JSON.stringify({title:'',lines:[]})),time(),id);
  });
  return old.length;
}
const CATALOGS={'consumo-defensa':CONSUMO,'envio-reclamo':ENVIO,'vuelo-reclamo':VUELO};
let delivering=false;
async function deliver() {
  if(delivering||!env.RESEND_KEY||!env.MAIL_FROM) return;
  delivering=true;
  try {
    const job=one(`SELECT d.*,u.email,o.access_sealed FROM deliveries d JOIN orders o ON o.id=d.order_id JOIN users u ON u.id=o.user_id WHERE d.state='pending' AND d.next<=? AND o.state='ready' AND o.mode='live' ORDER BY d.next LIMIT 1`,Date.now());
    if(!job) return;
    try {
      const response=await sendMail(job.email,'Tu informe de Categoría Clara está listo',
        'Tu informe está listo. Descargalo desde este enlace privado (no lo compartas): '+origin+'/p/'+unseal(job.access_sealed).toString()+'\n\nCon tu compra también tenés acceso a Mi facturación, el portal para gestionar tu Monotributo durante el año. Activalo creando tu contraseña con este mismo correo: '+origin+'/mi-facturacion?email='+encodeURIComponent(job.email)+'#crear','report-'+job.order_id);
      if(!response.ok) throw Error('mail '+response.status);
      sql("UPDATE deliveries SET state='sent' WHERE order_id=?",job.order_id);
    } catch {
      sql("UPDATE deliveries SET attempts=attempts+1, next=?, state=CASE WHEN attempts>=4 THEN 'failed' ELSE state END WHERE order_id=?",Date.now()+60000*2**job.attempts,job.order_id);
    }
  } finally {delivering=false;}
}
setInterval(()=>deliver().catch(()=>console.error('Error en cola de correo')),15000).unref();
const INDEXNOW_KEY='e1199d0c7bb97c888b899f433ad9bf21';
async function pingIndexNow(){
  if(env.INDEX_PUBLIC!=='1'||env.NODE_ENV==='test') return;
  const marker=dbPath===':memory:'?null:join(dirname(dbPath),'indexnow-'+SEO_UPDATED);
  if(marker&&existsSync(marker)) return;
  const urls=['/','/guias',...shown().map(pathFor),...visibleCases().map(caseUrl)].map(p=>origin+p);
  const host=new URL(origin).host;
  const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({host,key:INDEXNOW_KEY,keyLocation:origin+'/'+INDEXNOW_KEY+'.txt',urlList:urls}),signal:AbortSignal.timeout(20000)});
  console.log('IndexNow',r.status,urls.length,'URLs');
  if(marker&&r.status<300) writeFileSync(marker,new Date().toISOString());
}
if(!process.argv[2]&&env.NODE_ENV!=='test') setTimeout(()=>pingIndexNow().catch(e=>console.error('IndexNow:',e.message)),30000).unref();
if(!process.argv[2]&&env.NODE_ENV!=='test') startIndices(dbPath===':memory:'?null:join(dirname(dbPath),'indices.json')).catch(()=>{});
if(!process.argv[2]&&env.NODE_ENV!=='test') setInterval(()=>sweepPending().catch(()=>console.error('Error en el barrido de pagos')),120000).unref();
if(!process.argv[2]) setInterval(()=>{try {purge();} catch {console.error('Error en la depuración');}},3600000).unref();
function noteBlock(order) {
  let lines;
  try {lines=JSON.parse(unseal(order.result)).lines;} catch {return '';}
  const start=lines.findIndex(line=>/^--- NOTA DE RECLAMO/.test(line));
  if(start<0) return '';
  const end=lines.findIndex((line,i)=>i>start&&/^--- /.test(line));
  const note=lines.slice(start+1,end<0?undefined:end).filter(line=>!/^(Atención|Plazos de protesta|En vuelos de cabotaje)/.test(line)).join('\n');
  return `<section class="panel"><h2>Texto de la nota</h2><p class="muted small">Copialo para pegarlo en un mail o en el formulario de reclamos de la empresa. Completá tus datos donde dice [Tu nombre...].</p><pre class="note" id="nota">${esc(note)}</pre><button type="button" data-copy="#nota">Copiar nota</button></section>`;
}
async function startCheckout(order,secret) {
  const currentService=getService(order.slug);
  if(order.state!=='pending'||order.mode!==mode||order.policy!==policy||order.version!==currentService?.version||!price(currentService)) fail(409,'El pedido no admite un pago en este momento.');
  if(Date.parse(order.created)+86400000<=Date.now()) fail(409,'El plazo para pagar este pedido venció. Volvé a armar el reclamo.');
  if(order.preference) return order.preference;
  const attempt=sql('INSERT OR IGNORE INTO checkout_attempts VALUES (?,?)',order.id,time());
  if(!attempt.changes) fail(409,'El inicio del pago está pendiente de confirmación. Contactá a soporte con la referencia de tu pedido.');
  try {
    const back=origin+'/p/'+secret;
    const result=await mp(token,'/checkout/preferences',{
      items:[{id:order.slug,title:currentService.name,quantity:1,currency_id:'ARS',unit_price:order.cents/100}],
      external_reference:order.id,back_urls:{success:back,pending:back,failure:back},auto_return:'approved',
      expires:true,expiration_date_to:new Date(Date.parse(order.created)+86400000).toISOString()
    });
    const destination=new URL(live?result.init_point:result.sandbox_init_point);
    if(destination.protocol!=='https:'||!['www.mercadopago.com.ar','sandbox.mercadopago.com.ar','www.mercadopago.com','sandbox.mercadopago.com'].includes(destination.hostname)) throw Error('Destino inválido');
    atomic(db,()=>{
      sql('UPDATE orders SET preference=? WHERE id=?',destination.href,order.id);
      event('begin_checkout',order.slug,'checkout:'+order.id,order.source);
    });
    return destination.href;
  } catch(error) {
    if([400,401,403,422].includes(error.providerStatus)){
      sql('DELETE FROM checkout_attempts WHERE order_id=?',order.id);
      fail(502,'Mercado Pago rechazó la solicitud. Probá nuevamente o contactá a soporte.');
    }
    fail(502,'Mercado Pago no confirmó el inicio del pago. Contactá a soporte con la referencia de tu pedido.');
  }
}
const validEmail=email=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)&&email.length<=254;
function customer(email) {
  let account=one('SELECT * FROM users WHERE email=?',email);
  if(!account){
    sql('INSERT OR IGNORE INTO users VALUES (?,?,?)',randomUUID(),email,'!');
    account=one('SELECT * FROM users WHERE email=?',email);
  }
  sql('INSERT INTO policy_reads VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version, created=excluded.created',account.id,policy,time());
  return account;
}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba'}).format(new Date());
const checks=items=>`<ul class="checks">${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;
const stepsHtml=info=>`<section class="block"><h2>Cómo funciona</h2><ol class="steps">${info.steps.map(([title,text])=>`<li><strong>${esc(title)}</strong><span>${esc(text)}</span></li>`).join('')}</ol></section>`;
const faqHtml=info=>`<section class="block"><h2>Preguntas frecuentes</h2><div class="faq">${info.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>`;
const mock=(s,info)=>`<div class="mock" aria-hidden="true"><div class="mock-band"><span>Categoría Clara</span><strong>${esc(s.name)}</strong></div><div class="mock-body">${info.mock.map(label=>`<b>${esc(label)}</b><i></i><i class="short"></i>`).join('')}</div></div>`;
const faqLd=info=>({'@context':'https://schema.org','@type':'FAQPage',mainEntity:info.faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))});
const caseUrl=c=>(['consumo-defensa','envio-reclamo','vuelo-reclamo'].includes(c.service)?'/reclamos/':'/guias/')+c.path;
const visibleCases=()=>cases.filter(c=>shown().some(s=>s.slug===c.service));
const SEO_UPDATED='2026-11-25';
const crumbsLd=items=>({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map(([name,path],i)=>({'@type':'ListItem',position:i+1,name,item:origin+path}))});
const articleLd=(title,description,path)=>({'@context':'https://schema.org','@type':'Article',headline:title,description,inLanguage:'es-AR',dateModified:SEO_UPDATED,mainEntityOfPage:origin+path,author:{'@type':'Organization',name:'Categoría Clara'},publisher:{'@type':'Organization',name:'Categoría Clara',logo:{'@type':'ImageObject',url:origin+'/og.png'}},image:origin+'/og.png'});
const monoGuides=()=>visibleCases().filter(c=>c.service==='monotributocheck');
const pesos=n=>'$ '+Math.round(n).toLocaleString('es-AR');
const categoriasTable=()=>`<div class="table cat-table"><table><caption>Tabla vigente desde el ${MONO_TABLE.vigencia.split('-').reverse().join('/')} (${esc(MONO_TABLE.id)})</caption><thead><tr><th>Categoría</th><th class="right">Ingresos brutos anuales</th><th class="right">Superficie</th><th class="right">Energía anual</th><th class="right">Alquileres anuales</th><th class="right">Cuota servicios</th><th class="right">Cuota productos</th></tr></thead><tbody>${MONO_TABLE.categorias.map(c=>`<tr><th>${c.cat}</th><td class="right">${pesos(c.ingresos)}</td><td class="right">${c.superficie} m²</td><td class="right">${c.energia.toLocaleString('es-AR')} kWh</td><td class="right">${pesos(c.alquileres)}</td><td class="right">${pesos(c.servicios)}</td><td class="right">${pesos(c.bienes)}</td></tr>`).join('')}</tbody></table></div><p class="muted small">Fuente: ARCA. La cuota incluye impuesto integrado, aporte jubilatorio y obra social.</p>`;
const relatedGuides=(current,service='monotributocheck')=>{const list=visibleCases().filter(c=>c.service===service&&c.path!==current).slice(0,8);return list.length?`<section class="block"><h2>Otras guías${service==='monotributocheck'?' de Monotributo':''}</h2><ul class="related">${list.map(c=>`<li><a href="${caseUrl(c)}">${esc(c.title)}</a></li>`).join('')}</ul></section>`:'';};
const serviceLd=(name,description,path,cents)=>({'@context':'https://schema.org','@type':'Service',name,description,url:origin+path,areaServed:{'@type':'Country',name:'Argentina'},provider:{'@type':'Organization',name:'Categoría Clara'},...(cents?{offers:{'@type':'Offer',price:(cents/100).toFixed(2),priceCurrency:'ARS'}}:{})});
const casesOf=s=>s.fields.find(f=>f.key==='tipo')?.options.map(o=>o.label)??[];
function fieldHtml(f,value='',placeholder='') {
  const ph=placeholder?` placeholder="${esc(placeholder)}"`:'';
  let control;
  if(f.type==='select') control=`<select name="${f.key}" required><option value="">Elegí una opción</option>${f.options.map(o=>`<option value="${esc(o.value)}"${o.value===value?' selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
  else if(f.type==='textarea') control=`<textarea name="${f.key}" maxlength="2400" required${ph}>${esc(value)}</textarea>`;
  else if(f.type==='number'&&f.key==='plazo') control=`<input name="${f.key}" type="number" min="1" max="30" step="1" value="${esc(value)}" required${ph}>`;
  else if(f.type==='number') {
    const unit=f.unit==='pesos'?'$':f.unit||'';
    const input=`<input name="${f.key}" type="text" inputmode="decimal" autocomplete="off" maxlength="20" data-num="${f.unit==='pesos'?'money':'qty'}" value="${esc(value)}" required${ph}>`;
    control=unit?`<span class="num ${f.unit==='pesos'?'pre':'post'}" data-unit="${esc(unit)}">${input}</span>`:input;
  }
  else control=`<input name="${f.key}" type="${f.type}" ${f.type==='text'?'maxlength="120"':''} value="${esc(value)}" required${ph}>`;
  const hint=f.hint?`<span class="hint">${esc(f.hint)}</span>`:'';
  const show=f.show?` data-show="${esc(f.show)}"`:'';
  return `<label${show}>${esc(f.label)}${control}${hint}</label>${f.help==='meses'?monthsHelp(f.key):''}`;
}
const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre'];
const monthsHelp=target=>`<details class="helper"><summary>¿No sabés cuánto facturaste? Te ayudamos</summary>
<div class="helper-body"><p><b>Dónde verlo en ARCA:</b> entrá con tu clave fiscal a <b>Mis Comprobantes</b> → <b>Emitidos</b>, elegí del 01/01/2026 al 30/11/2026 y buscá. Sumá la columna <b>Imp. Total</b> (o descargala en Excel). Las notas de crédito restan.</p>
<p><b>O cargalo mes a mes</b> y lo sumamos por vos:</p>
<div class="months" data-sum-into="${esc(target)}">${MESES.map(m=>`<label>${m}<span class="num pre" data-unit="$"><input type="text" inputmode="decimal" autocomplete="off" data-num="money" data-month placeholder="0"></span></label>`).join('')}</div>
<p class="months-total">Total: <b data-sum-total>$ 0</b> <button type="button" class="ghost" data-sum-apply>Usar este total</button></p></div></details>`;
function renderLines(lines) {
  let html='',list=null;
  const close=()=>{if(list){html+=`</${list}>`;list=null;}};
  for(const line of lines){
    const heading=line.match(/^--- (.+?) ---$/);
    if(heading){close();html+=`<h3>${esc(heading[1])}</h3>`;continue;}
    const bullet=line.match(/^- (.*)$/);
    if(bullet){if(list!=='ul'){close();html+='<ul>';list='ul';}html+=`<li>${esc(bullet[1])}</li>`;continue;}
    const item=line.match(/^\d+\. (.*)$/);
    if(item){if(list!=='ol'){close();html+='<ol>';list='ol';}html+=`<li>${esc(item[1])}</li>`;continue;}
    close();
    const pair=line.match(/^(Fecha|Para|Asunto|De|Hechos|Solicito|Firma):\s?(.*)$/);
    html+=pair?`<p><strong>${esc(pair[1])}:</strong> ${esc(pair[2])}</p>`:`<p>${esc(line)}</p>`;
  }
  close();
  return html;
}
function summary(lines) {
  const get=prefix=>lines.find(line=>line.startsWith(prefix))?.slice(prefix.length).trim()??'';
  const counts={normas:0,pruebas:0,pasos:0,avisos:0};
  let section='';
  for(const line of lines){
    const heading=line.match(/^--- (.+?) ---$/);
    if(heading){section=heading[1];continue;}
    if(line.startsWith('- ')) counts.normas++;
    else if(/^\d+\. /.test(line)){if(section.startsWith('PRUEBAS')) counts.pruebas++; else if(section.startsWith('PRÓXIMOS')) counts.pasos++;}
    else if(/^(Atención|Plazos de protesta|En vuelos de cabotaje)/.test(line)) counts.avisos++;
  }
  return {para:get('Para:'),asunto:get('Asunto:'),limite:lines.join(' ').match(/hasta el (\d{2}\/\d{2}\/\d{4})/)?.[1]??'',...counts};
}
const table=(columns,rows)=>`<div class="table"><table><thead><tr>${columns.map(label=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const authFields=`<label>Correo<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>Contraseña<input name="password" type="password" minlength="12" maxlength="128" required></label>`;
async function route(req,res) {
  const url=new URL(req.url,origin);
  const path=url.pathname;
  const method=req.method;
  if(!['GET','POST'].includes(method)) return plain(res,405,'Método no permitido');
  if(method==='POST'&&path==='/webhooks/mercadopago'){
    const paymentId=url.searchParams.get('data.id');
    if(!validSignature(env.MP_WEBHOOK_SECRET,paymentId,req.headers)){console.warn('Webhook de Mercado Pago con firma inválida (revisar la clave secreta del modo '+mode+')');return plain(res,401,'Firma inválida');}
    if(url.searchParams.has('type')&&url.searchParams.get('type')!=='payment') return plain(res,200,'Evento fuera de alcance');
    try {await reconcile(paymentId);return plain(res,200,'Recibido');}
    catch {return plain(res,503,'Reintentar más tarde');}
  }
  const icons={'/favicon.ico':'image/x-icon','/favicon.svg':'image/svg+xml','/apple-touch-icon.png':'image/png','/icon-192.png':'image/png','/icon-512.png':'image/png'};
  if(method==='GET'&&icons[path]) {res.writeHead(200,{'Content-Type':icons[path],'Cache-Control':'public, max-age=604800'});return res.end(readFileSync(new URL('./public'+path,import.meta.url)));}
  if(method==='GET'&&path==='/e1199d0c7bb97c888b899f433ad9bf21.txt') return plain(res,200,'e1199d0c7bb97c888b899f433ad9bf21');
  if(method==='GET'&&path==='/manifest.webmanifest') return plain(res,200,JSON.stringify({name:'Categoría Clara',short_name:'Categoría Clara',start_url:'/',display:'browser',background_color:'#f6f2ea',theme_color:'#16181d',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'}]}),'application/manifest+json');
  if(method==='GET'&&path==='/og.png') {res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});return res.end(readFileSync(new URL('./public/og.png',import.meta.url)));}
  if(method==='GET'&&['/style.css','/site.js','/portal.js'].includes(path)) return plain(res,200,readFileSync(new URL('./public'+path,import.meta.url)),path.endsWith('css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
  const user=identity(req);
  const show=(title,body,options)=>page(res,title,body,{user,...options});
  if(method==='GET'&&path==='/health') return plain(res,200,'ok');
  if(method==='GET'&&path==='/robots.txt') return plain(res,200,env.INDEX_PUBLIC==='1'?`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /pedido/\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
  if(method==='GET'&&path==='/tabla.json'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=3600'});return res.end(JSON.stringify({id:MONO_TABLE.id,vigencia:MONO_TABLE.vigencia,categorias:MONO_TABLE.categorias.map(({cat,ingresos})=>({cat,ingresos})),recategorizacion:RECATEGORIZACION}));}
  if(method==='GET'&&path==='/mi-facturacion'){
    event('view_item','portal',undefined,user?'portal':'portal-login');
    const head=`<div class="svc-head"><a href="/">Inicio</a><p class="eyebrow dark">Portal incluido con tu informe</p><h1>Mi facturación</h1><p class="lead">Gestioná tu Monotributo todo el año: cargá tus facturas a medida que las hacés y mirá en tiempo real cuánto llevás facturado y en qué categoría vas a quedar.</p></div>`;
    const prefill=String(url.searchParams.get('email')||'').slice(0,254);
    if(!user) return show('Mi facturación',head+`<div class="svc-grid auth">
<section class="panel" id="crear"><h2>Activá tu portal</h2><p class="muted small">Si compraste tu informe, creá tu contraseña con el <b>mismo correo de la compra</b>. Nunca te pedimos clave fiscal.</p>
${post('/cuenta/crear',`<label>Correo<input name="email" type="email" autocomplete="email" maxlength="254" value="${esc(prefill)}" required></label><label>Contraseña <small>(mínimo 10 caracteres)</small><input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label><label>Repetí la contraseña<input name="password2" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label><label class="consent"><input type="checkbox" name="consent" value="${esc(policy)}" required> Acepto los <a href="/terminos">términos</a> y leí el <a href="/privacidad">aviso de privacidad</a>.</label><button>Crear cuenta</button>`)}</section>
<aside class="panel aside" id="ingresar"><h2>Ingresar</h2>${post('/cuenta/ingresar',`<label>Correo<input name="email" type="email" autocomplete="email" maxlength="254" value="${esc(prefill)}" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" maxlength="128" required></label><button>Ingresar</button>`)}<p class="small"><a href="/cuenta/olvide">Olvidé mi contraseña</a></p>
<h3>Qué incluye el portal</h3>${checks(['Cargar facturas y notas de crédito, o importar el CSV de Mis Comprobantes','Ver cuánto llevás facturado y en qué categoría quedarías','Saber cuánto te falta para el tope de tu categoría','Tener todo guardado y verlo desde el celu o la compu'])}<p class="small">¿Todavía no compraste? El portal viene incluido con el <a href="/servicios/monotributocheck">informe de recategorización</a>.</p></aside></div>`,{canonical:'/mi-facturacion',description:'Portal para gestionar tu Monotributo: cargá tus facturas y mirá en tiempo real cuánto llevás facturado y en qué categoría quedarías.'});
    const pending=!verified(user)?`<div class="panel wide note-box verify"><p><b>Confirmá tu correo.</b> Te mandamos un enlace a ${esc(user.email)}. Sirve para recuperar la cuenta si olvidás la contraseña.</p>${post('/cuenta/reenviar','<button class="ghost">Reenviar el correo</button>')}</div>`:'';
    if(!hasPortal(user)) return show('Mi facturación',head+`<div class="account-bar"><span>Cuenta: <b>${esc(user.email)}</b></span>${post('/salir','<button class="link">Salir</button>')}</div>${pending}<section class="panel wide note-box"><h2>El portal viene con tu informe</h2><p>Esta cuenta todavía no tiene una compra. Al comprar el informe de recategorización (${ars(price('monotributocheck'))}) con este mismo correo, se activa el portal para gestionar tu Monotributo todo el año.</p><a class="button" href="/servicios/monotributocheck">Calcular mi categoría</a><p class="small muted">¿Compraste con otro correo? Salí e ingresá con ese.</p></section>`,{canonical:'/mi-facturacion'});
    const cats=MONO_TABLE.categorias.map(c=>`<option value="${c.cat}">Categoría ${c.cat}</option>`).join('');
    return show('Mi facturación',head+`<div class="account-bar"><span>Cuenta: <b>${esc(user.email)}</b></span>${post('/salir','<button class="link">Salir</button>')}</div>${pending}
<div id="portal" data-account="1"><div id="migrate" class="panel wide note-box" hidden><p id="migrate-txt"></p><button type="button" id="migrate-btn">Pasarlos a mi cuenta</button> <button type="button" class="link" id="migrate-skip">No, gracias</button></div>
<section class="kpis">
  <div class="kpi"><span>Facturado en el período</span><b id="k-total">$ 0,00</b><small id="k-periodo"></small></div>
  <div class="kpi accent"><span>Por ingresos te corresponde</span><b id="k-cat">…</b><small id="k-cat-note"></small></div>
  <div class="kpi"><span>Vence la recategorización</span><b id="k-vence">—</b><small>Últimos 12 meses: <span id="k-rolling">$ 0,00</span></small></div>
</section>
<div class="panel wide"><div class="progress"><div id="k-bar"></div></div><p id="k-bar-txt" class="small"></p>
  <div class="cfg"><label>¿A qué te dedicás?<select id="cfg-actividad"><option value="servicios">Servicios</option><option value="bienes">Venta de productos</option></select></label>
  <label>Tu categoría actual<select id="cfg-categoria"><option value="">Elegí</option>${cats}</select></label></div>
  <h3>Por mes</h3><div id="chart" class="chart" aria-hidden="true"></div><p class="muted small" id="k-tabla"></p></div>
<div class="svc-grid">
<section class="panel"><h2>Cargar un comprobante</h2>
  <form id="add" class="inline-form" novalidate><div class="row2"><label>Fecha<input name="fecha" type="date" required></label><label>Tipo<select name="tipo"><option value="F">Factura</option><option value="NC">Nota de crédito (resta)</option></select></label></div>
  <label>Monto total<span class="num pre" data-unit="$"><input name="monto" type="text" inputmode="decimal" autocomplete="off" data-num="money" placeholder="Ej.: 150.000"></span></label>
  <div class="row2"><label>Número <small>(opcional)</small><input name="numero" maxlength="40" placeholder="00001-00000123"></label><label>Cliente <small>(opcional)</small><input name="cliente" maxlength="80"></label></div>
  <button>Agregar</button> <span id="add-msg" class="small muted" role="status"></span></form>
  <h3>O importá todo de ARCA</h3><p class="small muted">En ARCA entrá a <b>Mis Comprobantes → Emitidos</b>, elegí las fechas, buscá y descargá el archivo CSV. Subilo acá: sumamos facturas y restamos notas de crédito, sin repetir.</p>
  <label class="file">Subir CSV de Mis Comprobantes<input id="csv" type="file" accept=".csv,text/csv"></label><p id="csv-msg" class="small" role="status"></p>
</section>
<aside class="panel aside"><h2>¿Querés el informe completo?</h2><p class="small">Esto mira solo tus ingresos. El informe suma superficie, luz y alquileres, te calcula la cuota nueva, las alertas y el paso a paso, en PDF.</p><a id="to-report" class="button" href="/servicios/monotributocheck">Pasar mis números al informe</a><p id="to-report-note" class="small muted"></p>
<h3>Tu cuenta</h3><p class="small muted">Tus comprobantes quedan guardados en tu cuenta, cifrados, y los ves desde cualquier dispositivo. Podés descargarlos o borrarlos cuando quieras.</p>
<div class="btns"><button type="button" class="ghost" id="export">Descargar respaldo</button><label class="file ghost-file">Subir respaldo<input id="import" type="file" accept=".json,application/json"></label></div><p id="backup-msg" class="small" role="status"></p>
<p class="small"><a href="/guias/como-hacer-factura-c-arca">¿Cómo se hace una factura en ARCA?</a></p></aside>
</div>
<section class="panel wide"><div class="list-head"><h2>Tus comprobantes</h2><span id="count" class="muted small"></span><button type="button" class="link" id="wipe">Borrar todo</button></div>
<p id="empty" class="muted">Todavía no cargaste comprobantes.</p>
<div class="table"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Número</th><th>Cliente</th><th class="right">Monto</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></section>
</div><script src="/portal.js" defer></script>
<details class="danger"><summary>Eliminar mi cuenta</summary>${post('/cuenta/eliminar',`<p class="small">Se borran tu cuenta y todos tus comprobantes. No se puede deshacer. Escribí <b>ELIMINAR</b> para confirmar.</p><label>Confirmación<input name="confirm" maxlength="10" required></label><button>Eliminar cuenta y datos</button>`)}</details>`,{canonical:'/mi-facturacion'});
  }
  if(method==='POST'&&path==='/cuenta/crear'){
    limit(req,'signup',8);
    const input=await form(req);
    const email=String(input.email||'').trim().toLowerCase();
    const pass=String(input.password||'');
    if(!EMAIL.test(email)||email.length>254) fail(422,'Revisá el correo.');
    if(pass.length<10||pass.length>128) fail(422,'La contraseña tiene que tener entre 10 y 128 caracteres.');
    if(pass!==String(input.password2||'')) fail(422,'Las contraseñas no coinciden.');
    if(input.consent!==policy) fail(422,'Para crear la cuenta tenés que aceptar los términos.');
    let account=one('SELECT * FROM users WHERE email=?',email);
    if(account&&account.password!=='!') fail(409,'Ya existe una cuenta con ese correo. Ingresá con tu contraseña.');
    const stored=await password(pass);
    if(account) sql('UPDATE users SET password=? WHERE id=?',stored,account.id);
    else {sql('INSERT INTO users VALUES (?,?,?)',randomUUID(),email,stored);}
    account=one('SELECT * FROM users WHERE email=?',email);
    sql('INSERT INTO policy_reads VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version, created=excluded.created',account.id,policy,time());
    event('sign_up','portal',undefined,'portal');
    sql('DELETE FROM sessions WHERE user_id=?',account.id);
    await startSession(res,account);
    await sendAccountLink(account,'verify');
    return redirect(res,'/mi-facturacion');
  }
  if(method==='POST'&&path==='/cuenta/ingresar'){
    limit(req,'login',15);
    const input=await form(req);
    const account=one('SELECT * FROM users WHERE email=?',String(input.email||'').trim().toLowerCase());
    if(!(await checkPassword(account,input.password))) fail(401,'Correo o contraseña incorrectos.');
    await startSession(res,account);
    return redirect(res,'/mi-facturacion');
  }
  if(method==='GET'&&path==='/cuenta/verificar'){
    const raw=url.searchParams.get('t');
    const account=takeToken(raw,'verify',false);
    if(!account) fail(410,'El enlace venció o ya se usó. Ingresá y pedí uno nuevo.');
    return show('Confirmar correo',`<h1>Confirmá tu correo</h1><section class="panel"><p>Tocá el botón para confirmar <b>${esc(account.email)}</b>.</p>${post('/cuenta/verificar',`<input type="hidden" name="t" value="${esc(raw)}"><button>Confirmar mi correo</button>`)}</section>`);
  }
  if(method==='POST'&&path==='/cuenta/verificar'){
    const input=await form(req);
    const account=takeToken(input.t,'verify');
    if(!account) fail(410,'El enlace venció o ya se usó. Ingresá y pedí uno nuevo.');
    sql('INSERT OR IGNORE INTO verified_emails VALUES (?)',account.id);
    return show('Correo confirmado','<h1>Correo confirmado</h1><section class="panel"><p>Listo, tu correo quedó confirmado.</p><a class="button" href="/mi-facturacion">Ir a Mi facturación</a></section>');
  }
  if(method==='POST'&&path==='/cuenta/reenviar'){
    await form(req);
    if(!user) fail(401,'Ingresá a tu cuenta.');
    limit(req,'reset',8);
    if(!verified(user)) await sendAccountLink(user,'verify');
    return show('Revisá tu correo',`<h1>Revisá tu correo</h1><section class="panel"><p>Te mandamos el enlace a ${esc(user.email)}. Si no llega en unos minutos, mirá en spam.</p><a href="/mi-facturacion">Volver</a></section>`);
  }
  if(method==='GET'&&path==='/cuenta/olvide') return show('Recuperar contraseña',`<h1>Recuperar contraseña</h1><section class="panel">${post('/cuenta/olvide','<label>Tu correo<input name="email" type="email" autocomplete="email" maxlength="254" required></label><button>Mandame el enlace</button>')}</section>`);
  if(method==='POST'&&path==='/cuenta/olvide'){
    limit(req,'reset',8);
    const input=await form(req);
    const account=one('SELECT * FROM users WHERE email=?',String(input.email||'').trim().toLowerCase());
    if(account&&account.password!=='!') await sendAccountLink(account,'reset');
    return show('Revisá tu correo','<h1>Revisá tu correo</h1><section class="panel"><p>Si hay una cuenta con ese correo, te mandamos un enlace para cambiar la contraseña. Vence en una hora.</p></section>');
  }
  if(method==='GET'&&path==='/cuenta/restablecer'){
    const raw=url.searchParams.get('t');
    if(!takeToken(raw,'reset',false)) fail(410,'El enlace venció o ya se usó. Pedí uno nuevo.');
    return show('Nueva contraseña',`<h1>Elegí una contraseña nueva</h1><section class="panel">${post('/cuenta/restablecer',`<input type="hidden" name="t" value="${esc(raw)}"><label>Contraseña nueva <small>(mínimo 10 caracteres)</small><input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label><label>Repetila<input name="password2" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label><button>Guardar contraseña</button>`)}</section>`);
  }
  if(method==='POST'&&path==='/cuenta/restablecer'){
    limit(req,'reset',8);
    const input=await form(req);
    const pass=String(input.password||'');
    if(pass.length<10||pass.length>128) fail(422,'La contraseña tiene que tener entre 10 y 128 caracteres.');
    if(pass!==String(input.password2||'')) fail(422,'Las contraseñas no coinciden.');
    const account=takeToken(input.t,'reset');
    if(!account) fail(410,'El enlace venció o ya se usó. Pedí uno nuevo.');
    sql('UPDATE users SET password=? WHERE id=?',await password(pass),account.id);
    sql('INSERT OR IGNORE INTO verified_emails VALUES (?)',account.id);
    sql('DELETE FROM sessions WHERE user_id=?',account.id);
    await startSession(res,account);
    return redirect(res,'/mi-facturacion');
  }
  if(method==='POST'&&path==='/cuenta/eliminar'){
    const input=await form(req);
    if(!user) fail(401,'Ingresá a tu cuenta.');
    if(String(input.confirm||'').trim()!=='ELIMINAR') fail(422,'Escribí ELIMINAR para confirmar.');
    if(admin(user)) fail(403,'La cuenta administrativa no se elimina desde acá.');
    atomic(db,()=>{
      sql('DELETE FROM invoices WHERE user_id=?',user.id);
      sql('DELETE FROM portal_profiles WHERE user_id=?',user.id);
      sql('DELETE FROM sessions WHERE user_id=?',user.id);
      sql('DELETE FROM account_tokens WHERE user_id=?',user.id);
      sql('DELETE FROM verified_emails WHERE user_id=?',user.id);
      if(one('SELECT 1 FROM orders WHERE user_id=?',user.id)) sql("UPDATE users SET password='!' WHERE id=?",user.id);
      else {sql('DELETE FROM policy_reads WHERE user_id=?',user.id);sql('DELETE FROM users WHERE id=?',user.id);}
    });
    res.setHeader('Set-Cookie',cookie('',0));
    return show('Cuenta eliminada','<h1>Cuenta eliminada</h1><section class="panel"><p>Borramos tu cuenta y tus comprobantes.</p><a href="/">Ir al inicio</a></section>');
  }
  if(path.startsWith('/api/facturacion')){
    if(!user) fail(401,'Ingresá a tu cuenta.');
    if(!hasPortal(user)) fail(403,'El portal se activa con la compra del informe.');
    if(method==='GET'&&path==='/api/facturacion') return sendJson(res,portalData(user));
    if(method==='POST'&&path==='/api/facturacion/perfil'){
      const body=await jsonBody(req,4096);
      const actividad=body.actividad==='bienes'?'bienes':'servicios';
      const categoria=MONO_TABLE.categorias.some(c=>c.cat===body.categoria)?body.categoria:'';
      sql('INSERT INTO portal_profiles VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET actividad=excluded.actividad,categoria=excluded.categoria,updated=excluded.updated',user.id,actividad,categoria,time());
      return sendJson(res,{ok:true});
    }
    if(method==='POST'&&path==='/api/facturacion/facturas'){
      const body=await jsonBody(req);
      const list=Array.isArray(body.facturas)?body.facturas.slice(0,5000):[];
      const current=one('SELECT COUNT(*) n FROM invoices WHERE user_id=?',user.id).n;
      if(current+list.length>20000) fail(413,'Llegaste al máximo de comprobantes guardados.');
      let added=0,skipped=0;
      const insert=db.prepare('INSERT OR IGNORE INTO invoices VALUES (?,?,?,?,?,?,?,?)');
      atomic(db,()=>{for(const raw of list){
        const f=cleanInvoice(raw); if(!f){skipped++;continue;}
        const r=insert.run(randomUUID(),user.id,f.fecha,f.tipo,f.cents,seal(JSON.stringify({numero:f.numero,cliente:f.cliente})),f.key?hash(f.key):null,time());
        if(r.changes) added++; else skipped++;
      }});
      return sendJson(res,{added,skipped});
    }
    if(method==='POST'&&path==='/api/facturacion/borrar'){
      const body=await jsonBody(req,4096);
      if(body.todo===true) sql('DELETE FROM invoices WHERE user_id=?',user.id);
      else sql('DELETE FROM invoices WHERE user_id=? AND id=?',user.id,String(body.id||''));
      return sendJson(res,{ok:true});
    }
    fail(404,'No encontrado.');
  }
  if(method==='GET'&&path==='/guias'){
    const list=visibleCases().filter(c=>!isReclamo(getService(c.service)));
    const groups=shown().map(sv=>[sv,list.filter(c=>c.service===sv.slug)]).filter(([,g])=>g.length);
    return show('Guías prácticas',`<nav class="crumbs" aria-label="Migas"><a href="/">Inicio</a> › <span>Guías</span></nav><div class="svc-head"><h1>Guías prácticas</h1><p class="lead">Monotributo, sueldo y despido, alquileres, préstamos, Ganancias y compras al exterior, explicados sin vueltas y con datos oficiales.</p></div>${groups.map(([sv,g])=>`<section class="block"><h2>${esc(pitch[sv.slug].title)}</h2><div class="guide-grid">${g.map(c=>`<a class="card guide-card" href="${caseUrl(c)}"><h3>${esc(c.title)}</h3><p>${esc(c.description||c.intro)}</p><span>Leer guía →</span></a>`).join('')}</div></section>`).join('')}`,{canonical:'/guias',description:'Guías prácticas para Argentina: Monotributo, aguinaldo, liquidación final, aumento de alquiler, costo de préstamos, Ganancias y compras al exterior.',jsonld:[crumbsLd([['Inicio','/'],['Guías','/guias']]),{'@context':'https://schema.org','@type':'ItemList',itemListElement:list.map((c,i)=>({'@type':'ListItem',position:i+1,url:origin+caseUrl(c),name:c.title}))}]});
  }
  if(method==='GET'&&path==='/sitemap.xml') return plain(res,200,`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[['/','1.0'],['/guias','0.9'],...shown().map(x=>[pathFor(x),'0.9']),...visibleCases().map(c=>[caseUrl(c),'0.8']),['/mi-facturacion','0.5']].map(([path,prio])=>`<url><loc>${esc(origin+path)}</loc><lastmod>${SEO_UPDATED}</lastmod><priority>${prio}</priority></url>`).join('')}</urlset>`,'application/xml; charset=utf-8');
  if(method==='GET'&&path==='/'){
    const main=getService(site.service)&&shown().includes(getService(site.service))?getService(site.service):shown()[0];
    const info=pitch[main.slug];
    const cards=shown().length>1?`<section id="servicios" class="block"><h2>Elegí tu caso</h2><div class="grid three">${shown().map(s=>{const p=pitch[s.slug];const cents=price(s);return `<article class="card" data-card><h3>${esc(p.title)}</h3><p>${esc(p.tagline)}</p><p class="price-sm">${cents?ars(cents):'Gratis'}</p><a class="button" href="${pathFor(s)}">Empezar</a></article>`;}).join('')}</div></section>`:'';
    const guides=visibleCases();
    return show(site.title,`<section class="hero"><p class="eyebrow">${esc(site.eyebrow)}</p><h1>${esc(site.title)}</h1><p>${esc(site.lead)}</p>${link(pathFor(main),site.cta)}<ul class="trust">${site.trust.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section>
    ${cards}${guides.length?`<section class="block"><h2>Guías rápidas</h2><div class="case-links">${shown().map(s=>`<div><h3>${esc(pitch[s.slug].title)}</h3><ul>${guides.filter(c=>c.service===s.slug).map(c=>`<li><a href="${caseUrl(c)}">${esc(c.title)}</a></li>`).join('')}</ul></div>`).join('')}</div></section>`:''}
    ${stepsHtml(info)}
    <section class="block split"><div><h2>Qué incluye tu informe</h2>${checks(info.includes)}</div>${mock(main,info)}</section>
    ${faqHtml(info)}`,{canonical:'/',description:site.description,jsonld:[faqLd(info),{'@context':'https://schema.org','@type':'Organization',name:'Categoría Clara',url:origin,logo:origin+'/icon-512.png',email:'soporte@categoriaclara.com.ar',sameAs:['https://www.instagram.com/categoriaclara/'],areaServed:'AR'},{'@context':'https://schema.org','@type':'WebSite',name:'Categoría Clara',url:origin,inLanguage:'es-AR'}]});
  }
  const service=shown().find(s=>s.slug===path.match(/^\/servicios\/([a-z-]+)$/)?.[1]);
  if(service){
    const s=service;
    const [sourceName,sourceUrl]=sources[s.slug];
    const cents=price(s);
    const info=pitch[s.slug];
    if(method==='POST'){
      limit(req,'service',50);
      const values=await form(req);
      let result;
      try {result=evaluate(s,values);} catch(error){fail(422,error.message);}
      const origen=sourceOf(values.origen);
      if(values.action!=='order') event('preview',s.slug,undefined,origen);
      if(values.action==='order'){
        if(!cents||values.consent!==policy) fail(409,'La compra no está habilitada o falta aceptar las condiciones.');
        const email=String(values.email||'').trim().toLowerCase();
        if(!validEmail(email)) fail(422,'Revisá el correo.');
        if(email!==String(values.email2||'').trim().toLowerCase()) fail(422,'Los dos correos no coinciden.');
        if(email===adminEmail) fail(409,'Usá otro correo para comprar.');
        const account=customer(email);
        const id=randomUUID();
        const secret=randomBytes(32).toString('hex');
        const document={title:'Categoría Clara · '+s.name,lines:resultLines(s,result.lines,id)};
        sql('INSERT INTO orders(id,user_id,slug,version,cents,state,result,created,policy,mode,access_digest,access_sealed,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',id,account.id,s.slug,s.version,cents,'pending',seal(JSON.stringify(document)),time(),policy,mode,hash(secret),seal(secret),origen);
        try {return redirect(res,await startCheckout(one('SELECT * FROM orders WHERE id=?',id),secret));}
        catch {return redirect(res,'/p/'+secret);}
      }
      if(!cents) return show(info.title,`<a href="${path}">Volver al formulario</a><h1>${esc(info.title)}</h1><section class="panel result">${renderLines(result.lines)}</section>${info.next&&shown().some(x=>pathFor(x)===info.next[2])?`<section class="panel note-box"><h2>${esc(info.next[0])}</h2><p>${esc(info.next[1])}</p><a class="button" href="${esc(info.next[2])}">${esc(info.next[3])}</a></section>`:''}`);
      const preview=s.teaser?s.teaser(result.lines):(()=>{const f=summary(result.lines);return {facts:[['Para',f.para],['Asunto','Reclamo por '+f.asunto.replace(/^Reclamo por /,'')],['Respuesta hasta',f.limite]],includes:['Nota formal lista para firmar y enviar',`${f.normas} referencias normativas para tu caso`,`${f.pruebas} pruebas para adjuntar`,`${f.pasos} próximos pasos, incluido a qué organismo escalarlo`,...(f.avisos?['Aviso sobre plazos importantes de tu caso']:[])]};})();
      const hidden=s.fields.map(f=>`<input type="hidden" name="${f.key}" value="${esc(values[f.key])}">`).join('')+`<input type="hidden" name="origen" value="${esc(origen)}">`;
      const buy=post(path,hidden+`<label>Tu correo<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>Repetí tu correo<input name="email2" type="email" autocomplete="email" maxlength="254" required></label>${release.withdrawalNotice?`<p class="muted small">${esc(release.withdrawalNotice)}</p>`:''}<label class="consent"><input type="checkbox" name="consent" value="${esc(policy)}" required> Acepto los <a href="/terminos">términos</a> y leí el <a href="/privacidad">aviso de privacidad</a>.</label><button name="action" value="order">Pagar y descargar</button>`);
      return show(info.title,`<a href="${path}">Editar los datos</a><h1>${!isReclamo(s)?'Tu resultado':'Tu reclamo está listo'}</h1><div class="svc-grid"><section class="panel"><h2>Vista previa</h2><dl class="facts">${preview.facts.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <h3>${!isReclamo(s)?'El informe completo incluye':'El PDF completo incluye'}</h3>${checks(preview.includes)}
        <div class="locked" aria-hidden="true"><i></i><i></i><i class="short"></i><i></i><i class="short"></i></div></section>
        <aside class="panel aside buy"><p class="price">${ars(cents)}</p><p class="muted">Pago único con Mercado Pago${live?'':' (ambiente de prueba)'}. Sin crear cuenta: descargás el PDF apenas se acredita y te llega el enlace por correo.</p>${buy}</aside></div>`);
    }
    event('view_item',s.slug,undefined,'ficha');
    const defaults={envio:today(),plazo:'10'};
    return show(info.title,`<div class="svc-head"><a href="/">Inicio</a><p class="eyebrow dark">${esc(s.name)}</p><h1>${esc(info.title)}</h1><p class="lead">${esc(info.tagline)}</p></div>
    <div class="svc-grid"><section class="panel"><h2>${!isReclamo(s)?'Cargá tus números':'Contanos qué pasó'}</h2><p class="muted">${!isReclamo(s)?'No te pedimos clave fiscal, DNI ni datos personales. Escribí los montos como siempre: 1.250.000,50.':'No incluyas DNI ni datos de otras personas: tus datos personales los completás vos en la nota antes de enviarla.'}</p>
    ${post(path,'<input type="hidden" name="origen" value="ficha">'+s.fields.map(f=>fieldHtml(f,defaults[f.key]??'',info.placeholders?.[f.key])).join('')+`<button name="action" value="preview">${cents?(!isReclamo(s)?'Ver resultado gratis':'Ver vista previa gratis'):'Ver resultado'}</button>`)}${s.slug==='monotributocheck'?'<p class="muted small">¿Ya sabés tu categoría y querés hacer el trámite? <a href="/guias/como-recategorizarse-en-arca-paso-a-paso">Mirá el instructivo paso a paso</a>.</p>':''}</section>
    <aside class="panel aside"><h2>Qué recibís</h2>${checks(info.includes)}${cents?`<p class="price">${ars(cents)}</p><p class="muted small">Ves la vista previa gratis y pagás solo si querés el PDF.</p>`:''}${mock(s,info)}<p class="muted small">Fuente: <a href="${esc(sourceUrl)}">${esc(sourceName)}</a></p></aside></div>
    ${stepsHtml(info)}${faqHtml(info)}`,{canonical:path,description:info.tagline,jsonld:[serviceLd(info.title,info.tagline,path,cents),faqLd(info)]});
  }
  const caseRoute=path.match(/^\/(?:reclamos|guias)\/([a-z0-9-]+)$/);
  const landing=caseRoute&&cases.find(c=>c.path===caseRoute[1]&&caseUrl(c)===path);
  if(landing&&method==='GET'&&shown().some(x=>x.slug===landing.service)){
    const s=shown().find(x=>x.slug===landing.service);
    const info=pitch[s.slug];
    const cents=price(s);
    const caso=landing.tipo&&CATALOGS[s.slug]?.[landing.tipo];
    const aside=caso?`<h2>Qué dice la normativa</h2>${checks([...caso.normas,...(caso.internacional?[caso.internacional]:[])])}<h3>Qué podés pedir</h3><p>${esc(caso.opciones.charAt(0).toUpperCase()+caso.opciones.slice(1))}.</p><h3>Pruebas para juntar</h3>${checks(caso.pruebas)}`
      :`<h2>Lo que tenés que saber</h2>${checks(landing.points||[])}<h3>El informe completo incluye</h3>${checks(info.includes)}`;
    event('view_item',s.slug,undefined,landing.path);
    const defaults={...(landing.tipo?{tipo:landing.tipo}:{}),envio:today(),plazo:'10'};
    const isMono=s.slug==='monotributocheck';
    const article=(landing.table==='categorias'?categoriasTable():'')+(landing.sections||[]).map(([h,ps])=>`<h2>${esc(h)}</h2>${ps.map(p=>`<p>${esc(p)}</p>`).join('')}`).join('');
    const guideFaq=landing.faq?{faq:landing.faq}:info;
    const description=landing.description||landing.intro;
    return show(landing.title,`<nav class="crumbs" aria-label="Migas"><a href="/">Inicio</a> › ${!isReclamo(s)?'<a href="/guias">Guías</a>':`<a href="${pathFor(s)}">${esc(info.title)}</a>`} › <span>${esc(landing.title)}</span></nav><div class="svc-head"><h1>${esc(landing.title)}</h1><p class="lead">${esc(landing.intro)}</p></div>${article?`<article class="guide">${article}</article>`:''}
    <div class="svc-grid"><section class="panel"><h2>${caso?'Armá tu reclamo':'Calculá tu caso'}</h2><p class="muted">${caso?'No incluyas DNI ni datos de otras personas: tus datos personales los completás vos en la nota antes de enviarla.':'No te pedimos clave fiscal ni datos personales.'}</p>
    ${post(pathFor(s),`<input type="hidden" name="origen" value="${esc(landing.path)}">`+s.fields.map(f=>fieldHtml(f,defaults[f.key]??'',info.placeholders?.[f.key])).join('')+`<button name="action" value="preview">${cents?'Ver resultado gratis':'Ver resultado'}</button>`)}</section>
    <aside class="panel aside">${aside}${cents?`<p class="price">${ars(cents)}</p><p class="muted small">Ves el resultado gratis y pagás solo si querés el informe completo.</p>`:''}</aside></div>
    ${landing.steps?`<section class="block"><h2>Paso a paso en ARCA</h2><ol class="howto">${landing.steps.map(([t,d])=>`<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol></section>`:''}${stepsHtml(info)}${faqHtml(guideFaq)}${relatedGuides(landing.path,s.slug)}`,{canonical:path,description,jsonld:[articleLd(landing.title,description,path),crumbsLd([['Inicio','/'],...(!isReclamo(s)?[['Guías','/guias']]:[]),[landing.title,path]]),serviceLd(landing.title,description,path,cents),faqLd(guideFaq)]});
  }
  if(method==='POST'&&path==='/eventos/inicio'){
    limit(req,'beacon',120);
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>1024) return plain(res,413,'');chunks.push(chunk);}
    const values=Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
    if(shown().some(x=>x.slug===values.slug)) event('start_form',values.slug,undefined,sourceOf(values.origen));
    return plain(res,204,'');
  }
  if(path==='/mis-reclamos'){
    if(method==='GET') return show('Mis informes',`<h1>Mis informes</h1><section class="panel"><p>Ingresá el correo que usaste al comprar y te reenviamos los enlaces de tus compras.</p>${post('/mis-reclamos','<label>Correo<input name="email" type="email" autocomplete="email" maxlength="254" required></label>'+button('Reenviar mis enlaces'))}</section>`);
    limit(req,'links',5);
    const input=await form(req);
    const account=one('SELECT * FROM users WHERE email=?',String(input.email||'').trim().toLowerCase());
    if(account&&!admin(account)){
      const orders=all("SELECT * FROM orders WHERE user_id=? AND purged_at IS NULL AND access_sealed IS NOT NULL ORDER BY created DESC LIMIT 20",account.id);
      if(orders.length){
        const lines=orders.map(o=>`${getService(o.slug)?.name||o.slug} (${o.created.slice(0,10)}, ${statuses[o.state]}): ${origin}/p/${unseal(o.access_sealed).toString()}`);
        try {await mailLink(account.email,'Tus compras en Categoría Clara','Estos son los enlaces privados de tus compras. No los compartas.',lines.join('\n'));}
        catch {console.error('Error al reenviar enlaces');}
      }
    }
    return show('Revisá tu correo','<h1>Revisá tu correo</h1><section class="panel"><p>Si hay compras con ese correo, te enviamos sus enlaces.</p></section>');
  }
  if(method==='POST'&&path==='/admin/ingresar'){
    limit(req,'identity',12);
    const input=await form(req);
    const email=String(input.email||'').trim().toLowerCase();
    const account=one('SELECT * FROM users WHERE email=?',email);
    const stored=account&&admin(account)?account.password:'0'.repeat(32)+':'+'0'.repeat(128);
    const candidate=await password(String(input.password||'').slice(0,128),stored.split(':')[0]);
    if(stored.length!==candidate.length||!timingSafeEqual(Buffer.from(stored),Buffer.from(candidate))||!account||!admin(account)) fail(401,'Correo o contraseña incorrectos.');
    const session=randomBytes(32).toString('hex');
    sql('DELETE FROM sessions WHERE expires<=?',Date.now());
    sql('INSERT INTO sessions VALUES (?,?,?)',hash(session),account.id,Date.now()+86400000);
    res.setHeader('Set-Cookie',cookie(session,86400));
    return redirect(res,'/admin');
  }
  if(method==='POST'&&path==='/salir'){
    await form(req);
    if(user) sql('DELETE FROM sessions WHERE token=?',user.token);
    res.setHeader('Set-Cookie',cookie('',0));
    return redirect(res,'/');
  }
  const orderRoute=path.match(/^\/p\/([a-f0-9]{64})(\/pdf|\/checkout)?$/);
  if(orderRoute){
    const secret=orderRoute[1];
    const order=one('SELECT * FROM orders WHERE access_digest=?',hash(secret));
    if(!order) fail(404,'No encontramos esa compra. Revisá el enlace o pedilo de nuevo desde «Mis informes».');
    const subpath=orderRoute[2];
    if(method==='GET'&&order.state==='pending'){
      const back=url.searchParams.get('payment_id')||url.searchParams.get('collection_id');
      if(back&&/^\d{1,24}$/.test(back)) await reconcile(back).catch(()=>false);
      else await syncOrder(order).catch(()=>false);
      Object.assign(order,one('SELECT * FROM orders WHERE id=?',order.id));
    }
    const self='/p/'+secret;
    if(method==='GET'&&subpath==='/pdf'){
      if(order.purged_at) fail(410,'El contenido de este pedido se eliminó por la política de conservación de datos.');
      if(order.state!=='ready') fail(409,'El PDF todavía no está disponible.');
      const report=one('SELECT body FROM reports WHERE order_id=?',order.id);
      sql('UPDATE orders SET accessed_at=COALESCE(accessed_at,?) WHERE id=?',time(),order.id);
      res.setHeader('Cache-Control','private, no-store');
      res.setHeader('Content-Disposition',`attachment; filename="categoria-clara-${order.id.slice(0,8)}.pdf"`);
      return plain(res,200,unseal(report.body),'application/pdf');
    }
    if(method==='POST'&&subpath==='/checkout'){
      limit(req,'checkout',30);
      await form(req);
      return redirect(res,await startCheckout(order,secret));
    }
    if(method!=='GET'||subpath) fail(405,'Método no permitido');
    const ready=order.state==='ready'&&!order.purged_at;
    if(ready) sql('UPDATE orders SET accessed_at=COALESCE(accessed_at,?) WHERE id=?',time(),order.id);
    const name=getService(order.slug)?.name||'Pedido';
    const body=order.purged_at?'<p>El contenido de este pedido se eliminó por la política de conservación de datos.</p>'
      :ready?`<p class="status">Pago acreditado</p><p>${!isReclamo(getService(order.slug))?'Tu informe está listo':'Tu nota está lista'}. También te enviamos este enlace por correo.</p>${link(self+'/pdf','Descargar PDF')}${order.slug==='monotributocheck'?portalInvite(order):''}`
      :order.state==='pending'?`<div data-autorefresh><p>Estamos esperando la confirmación de Mercado Pago. Esta página se actualiza sola.</p></div><p class="muted small">Si todavía no pagaste, podés hacerlo ahora.</p>${post(self+'/checkout',button('Pagar con Mercado Pago'))}`
      :`<p>${esc(statuses[order.state])}</p>`;
    return show(name,`<h1>${!isReclamo(getService(order.slug))?'Tu informe':'Tu reclamo'}</h1><section class="panel"><p class="muted small">${esc(name)} · Pedido ${esc(order.id)} · ${ars(order.cents)}${order.mode==='test'?' · Ambiente de prueba':''}</p>${body}<p class="muted small">Guardá este enlace: es privado y te da acceso a tu compra.</p></section>${ready?noteBlock(order):''}`);
  }
  if(method==='GET'&&path==='/admin'){
    if(!admin(user)) return show('Administración',`<h1>Administración</h1><section class="panel">${post('/admin/ingresar',authFields+button('Ingresar'))}</section>`,{status:403});
    const rows=all('SELECT o.*,u.email,d.state delivery FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN deliveries d ON d.order_id=o.id ORDER BY o.created DESC LIMIT 200');
    const metrics=all('SELECT slug,kind,COUNT(*) quantity FROM events GROUP BY slug,kind');
    const funnel=all(`SELECT slug,COALESCE(source,'ficha') source,SUM(kind='view_item') views,SUM(kind='start_form') starts,SUM(kind='preview') previews,SUM(kind='begin_checkout') checkouts,SUM(kind='purchase') purchases FROM events WHERE kind IN ('view_item','start_form','preview','begin_checkout','purchase') GROUP BY slug,COALESCE(source,'ficha') ORDER BY purchases DESC, views DESC`);
    const rate=(a,b)=>b?Math.round(a*1000/b)/10+'%':'—';
    const sales=all("SELECT state,mode,COUNT(*) quantity,SUM(cents) cents FROM orders WHERE approved_payment IS NOT NULL GROUP BY state,mode");
    const review=all("SELECT o.id,o.slug,a.created FROM orders o JOIN checkout_attempts a ON a.order_id=o.id WHERE o.preference IS NULL AND o.state='pending' ORDER BY a.created DESC LIMIT 100");
    const duplicates=all("SELECT p.order_id,p.id,p.status FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.approved_payment IS NOT NULL AND o.approved_payment!=p.id AND p.status IN ('approved','in_mediation','charged_back') LIMIT 100");
    const requests=all('SELECT w.*,o.accessed_at FROM withdrawals w LEFT JOIN orders o ON o.id=w.reference ORDER BY w.created DESC LIMIT 100');
    return show('Administración',`<h1>Administración</h1><h2>Importes de pedidos con pago aprobado</h2>${table(['Ambiente','Estado','Pedidos','Importe bruto'],sales.map(r=>[esc(r.mode),esc(statuses[r.state]),r.quantity,ars(r.cents)]))}
      <h2>Pedidos recientes</h2>${table(['Referencia','Correo','Servicio','Importe','Estado','Aviso','Contenido entregado'],rows.map(o=>[esc(o.id),esc(o.email),esc(o.slug),ars(o.cents),esc(statuses[o.state]),esc(o.delivery||'—'),esc(o.accessed_at?.slice(0,16).replace('T',' ')||'No')]))}
      <h2>Preferencias pendientes de verificar</h2>${table(['Pedido','Servicio','Intento'],review.map(r=>[esc(r.id),esc(r.slug),esc(r.created)]))}
      <h2>Pagos adicionales para conciliar</h2>${table(['Pedido','ID en Mercado Pago','Estado'],duplicates.map(r=>[esc(r.order_id),esc(r.id),esc(r.status)]))}
      <h2>Embudo por servicio y página de entrada</h2>${table(['Servicio','Entrada','Visitas','Inicios de formulario','Vistas previas','Inicios de pago','Compras','Visita → compra','Vista previa → compra'],funnel.map(r=>[esc(r.slug),esc(r.source==='ficha'?'Ficha del servicio':(c=>c?caseUrl(c):r.source)(cases.find(x=>x.path===r.source))),r.views,r.starts,r.previews,r.checkouts,r.purchases,rate(r.purchases,r.views),rate(r.purchases,r.previews)]))}
      <p class="muted small">Conteos de eventos: una persona puede generar varias visitas o vistas previas.</p>
      <h2>Eventos de conversión</h2>${table(['Servicio','Evento','Cantidad'],metrics.map(r=>[esc(r.slug),esc(r.kind),r.quantity]))}
      <h2>Solicitudes de arrepentimiento</h2>${table(['Código','Pedido','Correo','Contenido entregado','Estado','Acción'],requests.map(r=>[esc(r.id),esc(r.reference),esc(r.email),esc(r.accessed_at?.slice(0,16).replace('T',' ')||'No'),esc(r.status),r.status==='received'?post('/admin/arrepentimiento',`<input type="hidden" name="id" value="${esc(r.id)}">`+button('Marcar atendida')):'—']))}`);
  }
  if(method==='POST'&&path==='/admin/arrepentimiento'){
    if(!admin(user)) fail(403,'Área restringida.');
    const {id}=await form(req);
    sql("UPDATE withdrawals SET status='handled' WHERE id=?",String(id));
    return redirect(res,'/admin');
  }
  if(path==='/arrepentimiento'){
    if(method==='GET') return show('Botón de arrepentimiento',`<h1>Botón de arrepentimiento</h1><p>Podés enviar tu solicitud sin iniciar sesión. Guardá el código de recepción.</p>${post(path,'<label>Referencia de pedido o comprobante<input name="reference" maxlength="100" required></label><label>Correo de contacto<input name="email" type="email" maxlength="254" required></label>'+button('Enviar solicitud'))}`);
    limit(req,'withdrawal',10);
    const {reference,email}=await form(req);
    if(!reference?.trim()||reference.length>100||!email||email.length>254||!/^\S+@\S+\.\S+$/.test(email)) fail(422,'Revisá la referencia y el correo.');
    const id=randomUUID();
    sql("INSERT INTO withdrawals VALUES (?,?,?,'received',?)",id,reference,email,time());
    return show('Solicitud recibida',`<h1>Solicitud recibida</h1><p>Código de recepción <strong>${id}</strong></p>`,{status:201});
  }
  if(method==='GET'&&['/privacidad','/terminos'].includes(path)){
    const privacy=path==='/privacidad';
    const content=privacy?release.privacy:release.terms;
    return show(privacy?'Privacidad':'Términos',`<h1>${privacy?'Privacidad':'Términos'}</h1><section class="panel">${content?String(content).split('\n').map(p=>`<p>${esc(p)}</p>`).join(''):'<p>Instancia de desarrollo. Usá únicamente datos de prueba. La documentación comercial requiere aprobación antes del lanzamiento.</p>'}</section>`);
  }
  fail(404,'No encontramos esa página.');
}

if(process.argv[2]==='admin'){
  if(!adminEmail||one('SELECT id FROM users WHERE email=?',adminEmail)) throw Error('Configurá un ADMIN_EMAIL nuevo. Si la cuenta existe, requiere revisión.');
  let secret='';
  for await(const chunk of process.stdin) secret+=chunk;
  secret=secret.trim();
  if(secret.length<16||secret.length>128) throw Error('Usá una contraseña administrativa de 16 a 128 caracteres.');
  const id=randomUUID();
  const encoded=await password(secret);
  atomic(db,()=>{
    sql('INSERT INTO users VALUES (?,?,?)',id,adminEmail,encoded);
    sql('INSERT INTO admins VALUES (?)',id);
  });
  console.log('Cuenta administrativa creada.');
} else if(process.argv[2]==='respaldo'){
  const target=process.argv[3]||`respaldo-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.sqlite`;
  if(!/^[\w./-]+\.sqlite$/.test(target)||existsSync(target)) throw Error('Indicá un archivo .sqlite nuevo, sin espacios ni comillas.');
  db.exec(`VACUUM INTO '${target}'`);
  console.log(`Respaldo creado en ${target}. Guardá aparte la DATA_KEY: sin ella no se pueden leer los reclamos.`);
} else if(process.argv[2]==='depurar'){
  if(!retention) throw Error('Configurá RETENTION_DAYS para depurar.');
  console.log(`${purge()} pedidos depurados.`);
} else if(process.argv[2]==='conciliar'){
  if(!await reconcile(process.argv[3]||'')){
    console.error('El pago no coincide con un pedido de este ambiente.');
    process.exitCode=1;
  } else console.log('Pago conciliado con la API de Mercado Pago.');
} else {
  createServer((req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'none'; connect-src 'self'; style-src 'self'; script-src 'self'; form-action 'self' https://*.mercadopago.com.ar https://*.mercadopago.com; base-uri 'none'; frame-ancestors 'none'");
    if(secure) res.setHeader('Strict-Transport-Security','max-age=31536000');
    route(req,res).catch(error=>{
      if(res.headersSent){res.destroy();return;}
      if(!error.status) console.error('Error interno:',error.code||error.name);
      if(req.url.startsWith('/api/')){res.writeHead(error.status||500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify({error:error.status?error.message:'No se pudo procesar la solicitud.'}));}
      page(res,error.status===404?'Página no encontrada':'Error',`<section class="panel error"><h1>${error.status||500}</h1><p>${esc(error.status?error.message:'No se pudo procesar la solicitud.')}</p><a href="/">Ir al inicio</a></section>`,{status:error.status||500});
    });
  }).listen(Number(env.PORT||3000),env.HOST||'127.0.0.1',()=>console.log('Categoría Clara en '+origin));
}
