import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {services,getService,evaluate} from '../services.js';
import {validSignature,matchesPayment} from '../payments.js';
import {pdf} from '../pdf.js';

const formValues={
  'multaradar':{zona:'Córdoba',consulta:'2026-01-01',intervalo:'10'},
  'vtv-facil':{zona:'Córdoba',vence:'2026-01-21',referencia:'2026-01-01'},
  'calculo-indemnizacion':{base:'1000',unidades:'4'},
  'sueldocheck':{bruto:'1000',descuentos:'200',extras:'100',neto:'900'},
  'jubilacheck':{aportes:'30',objetivo:'120'},
  'creditocheck':{capital:'500',cuotaA:'300',cuotaB:'290',plazoA:'2',plazoB:'2',cargoA:'10',cargoB:'5'},
  'facturacheck':{cuit:'30-61234567-5',cae:'12345678912345',emision:'2026-01-01',vence:'2026-01-20'},
  'monotributocheck':{actividad:'servicios',categoria:'C',ingresos:'25000000',diciembre:'2500000',local:'no',superficie:'0',energia:'0',alquileres:'0',precio:'0',billeteras:'si'},
  'liquidacion-final':{motivo:'sin_causa',ingreso:'2019-03-10',egreso:'2026-11-20',sueldo:'1.500.000',tomadas:'5',preaviso:'no',tope:'no'},
  'aguinaldo':{sueldo:'1.200.000',ingreso:'2026-09-01',pago:'2026-12-31'},
  'importafacil':{mercaderia:'100',flete:'20',seguro:'5',cambio:'1000',cargos:'1000'},
  'mi-partida':{zona:'Córdoba',tipo:'nacimiento',anio:'1980'},
  'apostilla-express':{documento:'Acta',destino:'España',emisor:'Registro Civil'},
  'pasaporte-listo':{tramite:'renovación',lugar:'Córdoba',edad:'12'},
  'visa-check':{destino:'EEUU',nacionalidad:'argentina',motivo:'turismo',viaje:'2026-04-01'},
  'ruta-ciudadania':{pais:'Italia',cadena:'Abuelo\nMadre'},
  'vuelo-reclamo':{tipo:'cancelacion',empresa:'Línea A',vuelo:'AR1500',fecha:'2026-01-01',ruta:'Córdoba a Ezeiza',internacional:'no',hechos:'Se canceló.',pedido:'un reintegro',envio:'2026-01-03',plazo:'10'},
  'expensa-check':{filas:'Limpieza | 300 | 240\nServicios | 300 | 0'},
  'herencia-check':{zona:'Córdoba',bienes:'3',tasas:'1000',otras:'2000'},
  'seguro-check':{riesgo:'hogar',primaA:'5000',primaB:'4000',franquiciaA:'2500',franquiciaB:'3000'},
  'envio-reclamo':{tipo:'no_entregado',empresa:'Operador A',promesa:'2026-01-01',revision:'2026-01-07',hechos:'Sin entrega.',pedido:'entrega',envio:'2026-01-08',plazo:'10'},
  'consumo-defensa':{tipo:'garantia',empresa:'Local A',fecha:'2026-01-01',hechos:'Se entregó con una falla.',pedido:'reposición',envio:'2026-01-05',plazo:'10'}
};
const expected=['2026-01-11','20.','4.000','Diferencia','90.','Oferta B','14 dígitos','subís de la categoría C a la D','12.000.000,00','397.826,09','126.000','1980','España','menor','EEUU','Madre','Se canceló','25.00%','3.000','-','6 días','reposición'];
for(const [i, service] of services.entries()){
  test(service.name+' procesa y valida sus datos',()=>{
    const {lines}=evaluate(service,formValues[service.slug]);
    assert.ok(lines.join(' ').includes(expected[i]));
    assert.throws(()=>evaluate(service,{}),/Completá/);
  });
}
test('Fechas inexistentes, cargos negativos, duplicados y umbrales inválidos',()=>{
  assert.throws(()=>evaluate(getService('vtv-facil'),{...formValues['vtv-facil'],vence:'2026-02-30'}),/fecha válida/);
  assert.throws(()=>evaluate(getService('expensa-check'),{filas:'Agua | 1 | 2\nagua | 2 | 1'}),/una sola vez/);
  assert.throws(()=>evaluate(getService('creditocheck'),{...formValues.creditocheck,cargoA:'-1'}),/positivos/);
});
test('Motor de reclamos: tipo de caso, normativa, plazos y avisos',()=>{
  const consumo=getService('consumo-defensa'), vuelo=getService('vuelo-reclamo'), envio=getService('envio-reclamo');
  const base=evaluate(consumo,formValues['consumo-defensa']).lines.join('\n');
  assert.match(base,/art\. 17/);
  assert.match(base,/hasta el 15\/01\/2026/);
  assert.match(base,/Ventanilla Federal Única/);
  assert.doesNotMatch(base,/COPREC/);
  assert.throws(()=>evaluate(consumo,{...formValues['consumo-defensa'],tipo:'otro'}),/opción válida/);
  assert.throws(()=>evaluate(consumo,{...formValues['consumo-defensa'],plazo:'45'}),/1 a 30/);
  assert.throws(()=>evaluate(consumo,{...formValues['consumo-defensa'],envio:'2025-12-01'}),/anterior/);
  const tarde=evaluate(consumo,{...formValues['consumo-defensa'],tipo:'arrepentimiento',envio:'2026-01-20'}).lines.join('\n');
  assert.match(tarde,/pasan 19 días/);
  const baja=evaluate(consumo,{...formValues['consumo-defensa'],tipo:'baja'}).lines.join('\n');
  assert.match(baja,/954\/2025/);
  const valija=evaluate(vuelo,{...formValues['vuelo-reclamo'],tipo:'equipaje',internacional:'si'}).lines.join('\n');
  assert.match(valija,/Montreal/);
  assert.match(valija,/hasta el 08\/01\/2026/);
  const cabotaje=evaluate(vuelo,{...formValues['vuelo-reclamo'],tipo:'equipaje'}).lines.join('\n');
  assert.doesNotMatch(cabotaje,/Montreal/);
  assert.match(evaluate(envio,{...formValues['envio-reclamo'],tipo:'danado'}).lines.join('\n'),/art\. 11/);
  for(const service of [consumo,vuelo,envio]) for(const line of evaluate(service,formValues[service.slug]).lines) assert.match(line,/^[\x20-\x7e\xa0-\xff]*$/);
});
test('MonotributoCheck: categoría por parámetro, margen, exclusión y resumen gratuito',()=>{
  const mono=getService('monotributocheck');
  const base=formValues.monotributocheck;
  const text=values=>evaluate(mono,{...base,...values}).lines.join('\n');
  const up=text({});
  assert.match(up,/Categoría D: \$ 84\.612,93 por mes/);
  assert.match(up,/quedás a \$ 3\.128\.651,43 del tope de la categoría D/);
  assert.match(up,/ARCA cruza/);
  assert.match(text({categoria:'D',ingresos:'20000000',diciembre:'1000000',billeteras:'no'}),/podés facturar hasta \$ 10\.628\.651,43/);
  assert.match(text({categoria:'A',ingresos:'9000000',diciembre:'800000',local:'si',superficie:'50'}),/subís de la categoría A a la C[\s\S]*define el parámetro más alto: superficie/);
  assert.match(text({categoria:'E',ingresos:'9000000',diciembre:'800000'}),/bajás de la categoría E a la A/);
  assert.match(text({categoria:'C',ingresos:'20000000',diciembre:'1000000'}),/No tenés que recategorizarte: seguís en la categoría C/);
  assert.match(text({ingresos:'130000000'}),/fuera del Monotributo[\s\S]*supera el máximo de la categoría K/);
  assert.match(text({actividad:'bienes',precio:'800000'}),/fuera del Monotributo[\s\S]*precio unitario/);
  assert.match(text({actividad:'servicios',precio:'800000',ingresos:'20000000',diciembre:'1000000'}),/seguís en la categoría C/);
  assert.match(text({actividad:'bienes',categoria:'D',ingresos:'20000000',diciembre:'1000000'}),/\$ 82\.564,81 por mes/);
  assert.throws(()=>evaluate(mono,{...base,categoria:'Z'}),/opción válida/);
  // Formato argentino y campos que dependen de otra respuesta
  assert.equal(evaluate(mono,{...base,ingresos:'25.000.000',diciembre:'2.500.000,00'}).input.ingresos,25000000);
  assert.equal(evaluate(mono,{...base,diciembre:'1.234,56'}).input.diciembre,1234.56);
  assert.equal(evaluate(mono,{...base,local:'no',superficie:'500'}).input.superficie,0);
  assert.equal(evaluate(mono,{...base,local:'si',superficie:'500'}).input.superficie,500);
  assert.equal(evaluate(mono,{...base,actividad:'servicios',precio:'999999999'}).input.precio,0);
  assert.throws(()=>evaluate(mono,{...base,ingresos:'abc'}),/Ejemplo: 1\.250\.000,50/);
  const preview=mono.teaser(evaluate(mono,base).lines);
  assert.equal(preview.facts[0][1],'Sí, tenés que recategorizarte (subís de categoría).');
  assert.doesNotMatch(JSON.stringify(preview),/categoría D|84\.612/);
  for(const line of evaluate(mono,base).lines) assert.match(line,/^[\x20-\x7e\xa0-\xff]*$/);
});
function signed(id,secret='secret'){
  const ts='1700000000';
  const v1=createHmac('sha256',secret).update(`id:${id};request-id:sample;ts:${ts};`).digest('hex');
  return {'x-signature':`ts=${ts},v1=${v1}`,'x-request-id':'sample'};
}
test('Liquidación final y aguinaldo: reforma 2026, tope del 67%, período de prueba y renuncia',()=>{
  const liq=getService('liquidacion-final');
  const base={motivo:'sin_causa',ingreso:'2019-03-10',egreso:'2026-11-20',sueldo:'1.500.000',tomadas:'5',preaviso:'no',tope:'no'};
  const all=v=>evaluate(liq,{...base,...v}).lines.join('\n');
  // Tope de convenio: la base no baja del 67% del sueldo (1.005.000 x 8 = 8.040.000).
  assert.match(all({tope:'si',topeMonto:'500.000'}),/art\. 245\): \$\s8\.040\.000,00/);
  assert.match(all({tope:'si',topeMonto:'1.200.000'}),/art\. 245\): \$\s9\.600\.000,00/);
  // Con preaviso trabajado no hay sustitutiva ni integración.
  assert.doesNotMatch(all({preaviso:'si'}),/- Integración del mes de despido: |- Indemnización sustitutiva del preaviso: /);
  // Período de prueba y renuncia: sin antigüedad ni preaviso.
  for(const motivo of ['prueba','renuncia']){const t=all({motivo});assert.doesNotMatch(t,/art\. 245|preaviso: \$/);assert.match(t,/Vacaciones no gozadas/);}
  // Fracción de 3 meses exactos no suma un período; más de 3 meses sí; mínimo un sueldo.
  assert.match(all({ingreso:'2024-08-21',egreso:'2026-11-20'}),/2 períodos/);
  assert.match(all({ingreso:'2024-07-20',egreso:'2026-11-20'}),/3 períodos/);
  assert.match(all({ingreso:'2026-04-01',egreso:'2026-11-20'}),/245\): \$\s1\.500\.000,00/);
  assert.match(all({ingreso:'2026-08-01',egreso:'2026-11-20'}),/período de prueba/);
  // Despido el último día del mes: sin integración.
  assert.doesNotMatch(all({egreso:'2026-11-30'}),/Integración del mes/);
  assert.throws(()=>evaluate(liq,{...base,egreso:'2018-01-01'}),/posterior/);
  const teaser=liq.teaser(evaluate(liq,base).lines);
  assert.equal(teaser.facts[0][1],'9');
  assert.doesNotMatch(JSON.stringify(teaser),/\$/);
  const ag=getService('aguinaldo');
  assert.match(evaluate(ag,{sueldo:'1.000.000',ingreso:'2020-01-01',pago:'2026-12-31'}).lines[0],/\$\s415\.000,00 en mano \(\$\s500\.000,00/);
  assert.match(evaluate(ag,{sueldo:'1.000.000',ingreso:'2020-01-01',pago:'2027-06-30'}).lines.join(' '),/30\/06\/2027/);
  assert.equal(ag.sellable,false);
});

test('La firma y la conciliación comparan vendedor, modo, moneda, referencia y centavos',()=>{
  assert.equal(validSignature('secret','800',signed('800')),true);
  assert.equal(validSignature('secret','801',signed('800')),false);
  const payment={collector_id:42,live_mode:false,external_reference:'order',currency_id:'ARS',transaction_amount:10.52};
  const order={id:'order',cents:1052};
  assert.equal(matchesPayment(payment,order,'42',false),true);
  for(const mutation of [{collector_id:70},{live_mode:true},{external_reference:'other'},{currency_id:'USD'},{transaction_amount:10.529}]){
    assert.equal(matchesPayment({...payment,...mutation},order,'42',false),false);
  }
});
test('PDF multipágina con referencias válidas y caracteres escapados',()=>{
  const data=pdf('Expensas (junio)',Array(140).fill('Importe \u00e1gil \\ en pesos')).toString('latin1');
  const count=Number(data.match(/\/Count (\d+)/)[1]);
  assert.ok(count>1);
  assert.equal(data.match(/\/Type \/Page /g).length,count);
  assert.ok(data.includes(`Página ${count} de ${count}`.replace('á','\xe1')));
  assert.ok(data.includes('/BaseFont /Helvetica-Bold'));
  const offset=Number(data.match(/startxref\n(\d+)/)[1]);
  assert.equal(data.slice(offset,offset+4),'xref');
  assert.ok(data.includes('Expensas \\(junio\\)'));
});
async function availablePort() {
  const socket=createServer().listen(0,'127.0.0.1');
  await once(socket,'listening');
  const port=socket.address().port;
  await new Promise((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
  return port;
}
test('Integración HTTP: sitio de Monotributo, compra sin cuenta, PDF por enlace privado, embudo, respaldo y depuración',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'gestion-clara-test-'));
  const port=await availablePort();
  const origin=`https://localhost:${port}`;
  const local=`http://127.0.0.1:${port}`;
  const release=join(dir,'release.json');
  await writeFile(release,JSON.stringify({business:'Titular Prueba',cuit:'20-12345678-9',address:'Calle 1, Córdoba',support:'soporte@example.test',products:{monotributocheck:{cents:1052},'consumo-defensa':{cents:1052},'liquidacion-final':{cents:2052}}}));
  const env={PATH:process.env.PATH,DB_PATH:join(dir,'data.sqlite'),DATA_KEY:'e'.repeat(64),PORT:String(port),PUBLIC_ORIGIN:origin,RETENTION_DAYS:'30',
    ADMIN_EMAIL:'admin@example.test',RELEASE_FILE:release,MP_ACCESS_TOKEN:'fixture',MP_WEBHOOK_SECRET:'secret',MP_COLLECTOR_ID:'42'};
  const proc=spawn(process.execPath,['server.js','admin'],{env});
  proc.stdin.end('a safe admin test passphrase\n');
  assert.equal((await once(proc,'exit'))[0],0);
  const server=spawn(process.execPath,['--import','./fixtures/provider.mjs','server.js'],{env});
  let output='';
  server.stdout.on('data',chunk=>{output+=chunk;});
  t.after(async()=>{if(server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}await rm(dir,{recursive:true,force:true});});
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>assert.fail('El servidor salió durante el inicio'))]);
  const get=(path,cookie)=>fetch(local+path,{headers:cookie?{Cookie:cookie}:{},redirect:'manual'});
  const send=(path,values={},cookie)=>fetch(local+path,{method:'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{})},body:new URLSearchParams(values),redirect:'manual'});
  const mono=formValues.monotributocheck;
  const guide='cuanto-puedo-facturar-en-diciembre-monotributo';

  // Sitio público: solo Monotributo
  const markup=await (await get('/')).text();
  assert.match(markup,/Sabelo en 2 minutos/);
  assert.match(markup,/href="\/servicios\/monotributocheck"/);
  assert.equal(markup.match(/href="\/guias\//g).length,16);
  assert.doesNotMatch(markup,/CUIT|20-12345678-9/);
  assert.match(markup,/"@type":"FAQPage"/);
  assert.doesNotMatch(markup,/Reclamo a una|Mi cuenta|Servicio completo pendiente/);
  assert.match(markup,/href="\/servicios\/liquidacion-final"/);
  assert.match(markup,/href="\/servicios\/aguinaldo"[\s\S]*?|Gratis/);
  const sitemap=await (await get('/sitemap.xml')).text();
  assert.equal(sitemap.match(/<loc>/g).length,22);
  assert.match(sitemap,/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  const guias=await (await get('/guias')).text(); assert.match(guias,/Guías de Monotributo/); assert.match(guias,/como-darse-de-alta-en-el-monotributo/); assert.match(guias,/"@type":"ItemList"/);
  const catPage=await (await get('/guias/categorias-monotributo-cuota-mensual')).text(); assert.match(catPage,/class="table cat-table"/); assert.match(catPage,/"@type":"Article"/); assert.match(catPage,/"@type":"BreadcrumbList"/); assert.match(catPage,/Otras guías de Monotributo/);
  // Portal Mi facturación: página, script y tabla pública
  const anon=await (await get('/mi-facturacion')).text();
  assert.match(anon,/Activá tu portal/); assert.doesNotMatch(anon,/id="portal"/);
  assert.equal((await get('/api/facturacion')).status,401);
  assert.equal((await send('/cuenta/crear',{email:'ana@example.test',password:'corta',password2:'corta',consent:'x'})).status,422);
  const signup=await send('/cuenta/crear',{email:'Ana@Example.test',password:'una clave larga 123',password2:'una clave larga 123',consent:'local-v1'});
  assert.equal(signup.status,303);
  let ana=signup.headers.get('set-cookie').split(';')[0];
  assert.equal((await send('/cuenta/crear',{email:'ana@example.test',password:'otra clave larga 1',password2:'otra clave larga 1',consent:'local-v1'})).status,409);
  assert.equal((await send('/cuenta/ingresar',{email:'ana@example.test',password:'mal'})).status,401);
  const relogin=await send('/cuenta/ingresar',{email:'ana@example.test',password:'una clave larga 123'});
  assert.equal(relogin.status,303);
  // Verificación de correo y recuperación de contraseña (en desarrollo el enlace va a la consola)
  const linkFor=(kind)=>{const m=[...output.matchAll(new RegExp('/cuenta/'+kind+'\\?t=([a-f0-9]{64})','g'))];return m.at(-1)?.[1];};
  await new Promise(r=>setTimeout(r,100));
  assert.match(await (await get('/mi-facturacion',ana)).text(),/Confirmá tu correo/);
  const vt=linkFor('verificar'); assert.ok(vt);
  assert.equal((await get('/cuenta/verificar?t='+vt)).status,200);
  assert.equal((await get('/cuenta/verificar?t='+vt)).status,200);
  assert.match(await (await get('/mi-facturacion',ana)).text(),/Confirmá tu correo/);
  assert.equal((await send('/cuenta/verificar',{t:vt})).status,200);
  assert.equal((await send('/cuenta/verificar',{t:vt})).status,410);
  assert.doesNotMatch(await (await get('/mi-facturacion',ana)).text(),/Confirmá tu correo/);
  assert.equal((await send('/cuenta/olvide',{email:'nadie@example.test'})).status,200);
  assert.equal((await send('/cuenta/olvide',{email:'ana@example.test'})).status,200);
  await new Promise(r=>setTimeout(r,100));
  const rt=linkFor('restablecer'); assert.ok(rt);
  assert.equal((await get('/cuenta/restablecer?t='+rt)).status,200);
  assert.equal((await send('/cuenta/restablecer',{t:rt,password:'nueva clave de ana 1',password2:'otra'})).status,422);
  assert.equal((await send('/cuenta/restablecer',{t:rt,password:'nueva clave de ana 1',password2:'nueva clave de ana 1'})).status,303);
  assert.equal((await send('/cuenta/restablecer',{t:rt,password:'nueva clave de ana 1',password2:'nueva clave de ana 1'})).status,410);
  assert.equal((await get('/api/facturacion',ana)).status,401);
  assert.equal((await send('/cuenta/ingresar',{email:'ana@example.test',password:'una clave larga 123'})).status,401);
  const anaNew=await send('/cuenta/ingresar',{email:'ana@example.test',password:'nueva clave de ana 1'});
  assert.equal(anaNew.status,303);
  ana=anaNew.headers.get('set-cookie').split(';')[0];
  // Sin compra: el portal no se habilita
  assert.match(await (await get('/mi-facturacion',ana)).text(),/El portal viene con tu informe/);
  assert.equal((await get('/api/facturacion',ana)).status,403);
  {const w=new (await import('node:sqlite')).DatabaseSync(env.DB_PATH);
   w.prepare("INSERT INTO orders(id,user_id,slug,version,cents,state,result,created,policy,mode,approved_payment) VALUES ('orden-ana',(SELECT id FROM users WHERE email='ana@example.test'),'monotributocheck','1.0.0',1052,'ready','x','2026-11-23T00:00:00Z','local-v1','test','pago-1')").run(); w.close();}
  const portal=await (await get('/mi-facturacion',ana)).text();
  assert.match(portal,/id="portal"/); assert.match(portal,/src="\/portal.js"/); assert.match(portal,/<option value="K">/); assert.match(portal,/ana@example.test/);
  const api=(path,body,cookie=ana,extra={})=>fetch(local+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...extra},body:JSON.stringify(body)});
  assert.equal((await fetch(local+'/api/facturacion/facturas',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json',Cookie:ana},body:'{}'})).status,403);
  let up=await (await api('/api/facturacion/facturas',{facturas:[{fecha:'2026-01-15',tipo:'F',monto:1850000,numero:'2-1',cliente:'Cliente Uno',key:'a'},{fecha:'2026-05-10',tipo:'NC',monto:100000,key:'b'},{fecha:'mal',monto:5},{fecha:'2026-02-01',monto:-3}]})).json();
  assert.deepEqual(up,{added:2,skipped:2});
  up=await (await api('/api/facturacion/facturas',{facturas:[{fecha:'2026-01-15',tipo:'F',monto:1850000,key:'a'}]})).json();
  assert.deepEqual(up,{added:0,skipped:1});
  assert.equal((await api('/api/facturacion/perfil',{actividad:'bienes',categoria:'D'})).status,200);
  let data=await (await get('/api/facturacion',ana)).json();
  assert.equal(data.facturas.length,2); assert.equal(data.perfil.categoria,'D'); assert.equal(data.facturas.find(f=>f.tipo==='F').cliente,'Cliente Uno');
  const peek=new (await import('node:sqlite')).DatabaseSync(env.DB_PATH);
  const stored=peek.prepare("SELECT detail FROM invoices WHERE user_id=(SELECT id FROM users WHERE email='ana@example.test')").all();
  assert.ok(stored.every(r=>!Buffer.from(r.detail).toString().includes('Cliente Uno')));
  // Otro usuario no ve ni borra comprobantes ajenos
  const beto=(await send('/cuenta/crear',{email:'beto@example.test',password:'clave de beto 12345',password2:'clave de beto 12345',consent:'local-v1'})).headers.get('set-cookie').split(';')[0];
  assert.equal((await get('/api/facturacion',beto)).status,403);
  await api('/api/facturacion/borrar',{id:data.facturas[0].id},beto);
  assert.equal((await (await get('/api/facturacion',ana)).json()).facturas.length,2);
  await api('/api/facturacion/borrar',{id:data.facturas[0].id});
  assert.equal((await (await get('/api/facturacion',ana)).json()).facturas.length,1);
  assert.equal((await send('/cuenta/eliminar',{confirm:'no'},beto)).status,422);
  assert.equal((await send('/cuenta/eliminar',{confirm:'ELIMINAR'},beto)).status,200);
  assert.equal(peek.prepare("SELECT COUNT(*) n FROM users WHERE email='beto@example.test'").get().n,0);
  peek.close();
  assert.equal((await get('/portal.js')).status,200);
  const tabla=await (await get('/tabla.json')).json();
  assert.equal(tabla.categorias.length,11); assert.equal(tabla.categorias[0].cat,'A'); assert.ok(tabla.recategorizacion.vence);
  assert.match(await (await get('/guias/como-hacer-factura-c-arca')).text(),/class="howto"/);
  for(const hidden of ['/servicios/consumo-defensa','/reclamos/vuelo-cancelado','/servicios/multaradar','/cuenta','/guias/vuelo-cancelado']) assert.equal((await get(hidden)).status,404);
  const landing=await (await get('/guias/'+guide)).text();
  assert.match(landing,/Cuánto podés facturar en diciembre/);
  assert.match(landing,/"@type":"Service"/);
  assert.match(landing,/og:image/);
  assert.equal((await get('/og.png')).headers.get('content-type'),'image/png');
  const sheet=await (await get('/servicios/monotributocheck')).text();
  assert.match(sheet,/\$\s?10,52/);
  assert.match(sheet,/Ver resultado gratis/);
  assert.doesNotMatch(sheet,/antes de vender|contador matriculado/);
  assert.equal((await fetch(local+'/eventos/inicio',{method:'POST',body:new URLSearchParams({slug:'monotributocheck',origen:guide})})).status,204);
  assert.equal((await send('/servicios/monotributocheck',{...mono,action:'preview',origen:guide})).status,200);

  // Resultado gratis sin la categoría ni montos
  const teaser=await (await send('/servicios/monotributocheck',{...mono,action:'preview'})).text();
  assert.match(teaser,/Tu resultado/);
  assert.match(teaser,/Sí, tenés que recategorizarte/);
  assert.match(teaser,/name="email2"/);
  assert.doesNotMatch(teaser,/Corresponde a la categoría|84\.612|Ingresá o creá tu cuenta/);
  assert.equal((await fetch(local+'/servicios/monotributocheck',{method:'POST',body:new URLSearchParams(mono)})).status,403);
  const buy=values=>send('/servicios/monotributocheck',{...mono,action:'order',consent:'local-v1',...values});
  assert.equal((await buy({email:'cliente@example.test',email2:'otro@example.test'})).status,422);
  assert.equal((await buy({email:'no-es-un-correo',email2:'no-es-un-correo'})).status,422);
  assert.equal((await buy({email:'admin@example.test',email2:'admin@example.test'})).status,409);
  assert.equal((await send('/servicios/consumo-defensa',{...formValues['consumo-defensa'],action:'order',consent:'local-v1',email:'a@example.test',email2:'a@example.test'})).status,404);
  const order=await buy({email:'Cliente@Example.test',email2:'cliente@example.test'});
  assert.equal(order.status,303);
  assert.match(order.headers.get('location'),/^https:\/\/sandbox\.mercadopago/);

  // Enlace privado reenviado por correo (en desarrollo se imprime en consola)
  assert.equal((await send('/mis-reclamos',{email:'cliente@example.test'})).status,200);
  await new Promise(resolve=>setTimeout(resolve,100));
  const privatePath=output.match(/\/p\/[a-f0-9]{64}/)?.[0];
  assert.ok(privatePath,'El reenvío debe incluir el enlace privado');
  assert.equal((await get('/p/'+'0'.repeat(64))).status,404);
  assert.match(await (await get(privatePath)).text(),/data-autorefresh/);
  assert.equal((await get(privatePath+'/pdf')).status,409);

  // Webhook de Mercado Pago
  assert.equal((await fetch(local+'/webhooks/mercadopago?data.id=800',{method:'POST'})).status,401);
  const hook=id=>fetch(local+'/webhooks/mercadopago?type=payment&data.id='+id,{method:'POST',headers:signed(id)});
  for(const id of ['600','700']) assert.equal((await hook(id)).status,200);
  assert.equal((await get(privatePath+'/pdf')).status,409);
  for(let retry=0;retry<2;retry++) assert.equal((await hook('800')).status,200);
  const report=await get(privatePath+'/pdf');
  assert.equal(report.headers.get('content-type'),'application/pdf');
  assert.match(Buffer.from(await report.arrayBuffer()).toString('latin1'),/^%PDF-1\.4/);
  const orderPage=await (await get(privatePath)).text();
  assert.match(orderPage,/Tu informe/);
  assert.doesNotMatch(orderPage,/data-autorefresh|Copiar nota/);

  // Administración y embudo
  assert.equal((await get('/admin')).status,403);
  assert.equal((await send('/admin/ingresar',{email:'cliente@example.test',password:'cualquier cosa'})).status,401);
  const admin=(await send('/admin/ingresar',{email:'admin@example.test',password:'a safe admin test passphrase'})).headers.get('set-cookie').split(';')[0];
  const panel=await (await get('/admin',admin)).text();
  assert.match(panel,/<td>purchase<\/td><td>1<\/td>/);
  assert.match(panel,new RegExp(`<td>monotributocheck</td><td>/guias/${guide}</td><td>1</td><td>1</td><td>1</td>`));
  assert.match(panel,/<td>monotributocheck<\/td><td>Ficha del servicio<\/td><td>1<\/td><td>0<\/td><td>1<\/td><td>1<\/td><td>1<\/td><td>100%<\/td><td>100%<\/td>/);
  assert.match(panel,/cliente@example\.test/);
  assert.equal((await hook('900')).status,200);
  assert.match(await (await get('/admin',admin)).text(),/<td>900<\/td><td>approved<\/td>/);
  assert.equal((await hook('800')).status,200);
  assert.equal((await get(privatePath+'/pdf')).status,409);
  assert.equal((await send('/arrepentimiento',{reference:'ref',email:'cliente@example.test'})).status,201);

  // Respaldo
  const backupFile=join(dir,'respaldo.sqlite');
  const backup=spawn(process.execPath,['server.js','respaldo',backupFile],{env});
  assert.equal((await once(backup,'exit'))[0],0);
  assert.ok((await import('node:fs')).existsSync(backupFile));

  // Depuración por antigüedad
  const {DatabaseSync}=await import('node:sqlite');
  const store=new DatabaseSync(env.DB_PATH);
  store.prepare("UPDATE orders SET created='2020-01-01T00:00:00.000Z' WHERE id<>'orden-ana'").run();
  store.close();
  const purge=spawn(process.execPath,['server.js','depurar'],{env});
  let purged='';
  purge.stdout.on('data',chunk=>{purged+=chunk;});
  assert.equal((await once(purge,'exit'))[0],0);
  assert.match(purged,/1 pedidos depurados/);
  assert.equal((await get(privatePath+'/pdf')).status,410);
  assert.match(await (await get(privatePath)).text(),/política de conservación/);
});
