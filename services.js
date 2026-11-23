import {monotributoFields,evaluateMonotributo,monotributoTeaser} from './monotributo.js';
import {liquidacionFields,evaluateLiquidacion,liquidacionTeaser,aguinaldoFields,evaluateAguinaldo} from './laboral.js';
import {choice,CONSUMO,ENVIO,VUELO,internacionalField,consumoEngine,envioEngine,vueloEngine} from './reclamos.js';
const number = (key, label) => ({ key, label, type: 'number' });
const field = (key, label) => ({ key, label, type: 'text' });
const date = (key, label) => ({ key, label, type: 'date' });
const list = (key, label) => ({ key, label, type: 'textarea' });
const money = value => new Intl.NumberFormat('es-AR', {style:'currency',currency:'ARS'}).format(value);
const check = (value, message) => { if (!value) throw new Error(message); };
const days = (a,b) => (Date.parse(b) - Date.parse(a))/86400000;
const checklist = (...lines) => lines.map((line, i) => `${i+1}. ${line}`);
const items = (value, separator = '|', columns = 2) => {
  const rows = value.split('\n').map(row => row.split(separator).map(x => x.trim()));
  check(rows.length <= 30 && rows.every(row => row.length === columns && row.every(Boolean)), 'Revisá el formato y el límite de 30 filas.');
  return rows;
};
// Acepta formato argentino (1.250.000,50) y también 1250000.50.
export const parseAmount = raw => {
  let v = String(raw ?? '').replace(/[\s$]/g, '');
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  return v;
};
const amount = value => {
  const v = parseAmount(value);
  check(/^\d{1,12}(\.\d{1,2})?$/.test(v), 'Usá números positivos o cero. Ejemplo: 1.250.000,50');
  return Math.round(Number(v)*100);
};
const total = values => values.reduce((sum,value) => sum+value,0);
const group = ['Vehículos y movilidad','Trabajo y finanzas','Impuestos y documentación','Viajes y ciudadanía','Hogar y derechos'];
const entries = [
['multaradar','MultaRadar',0,'Organizá tus consultas de infracciones por jurisdicción.',
 [field('zona','Jurisdicción o municipio'),date('consulta','Fecha de la última consulta'),number('intervalo','Días hasta tu próxima revisión')],
 x => {check(Number.isInteger(x.intervalo) && x.intervalo >= 1 && x.intervalo <=365,'Elegí un intervalo entero de 1 a 365 días.');return checklist(`Última consulta declarada en ${x.zona}: ${x.consulta}.`,`Próxima revisión personal: ${new Date(Date.parse(x.consulta)+x.intervalo*86400000).toISOString().slice(0,10)}.`,'Consultá el registro correspondiente y verificá las jurisdicciones cubiertas.');},'Convenio o API autorizada por jurisdicción, alcance y frecuencia de monitoreo.'],
['vtv-facil','VTV Fácil',0,'Planificá la renovación usando el vencimiento de tu certificado.',
 [field('zona','Jurisdicción'),date('vence','Vencimiento que figura en tu certificado'),date('referencia','Fecha de referencia')],
 x => [`Jurisdicción declarada: ${x.zona}.`,`Días hasta el vencimiento declarado: ${days(x.referencia,x.vence)}.`,'Verificá planta, requisitos y excepciones con la jurisdicción de radicación.'],'Reglas de cada jurisdicción y autorización del operador para turnos o consultas.'],
['calculo-indemnizacion','Cálculo de Indemnización',1,'Calculá un subtotal con una base y un multiplicador revisados para tu caso.',
 [number('base','Base mensual revisada por tu profesional'),number('unidades','Unidades indemnizatorias revisadas')],
 x => [`Base declarada: ${money(x.base)}.`,`Subtotal aritmético: ${money(x.base*x.unidades)}.`,'La determinación de base, topes, convenio y rubros requiere revisión profesional.'],'Reglas laborales versionadas, convenio, topes, vigencia y revisión de un abogado laboralista.'],
['sueldocheck','SueldoCheck',1,'Conciliá los importes de tu recibo.',
 [number('bruto','Total bruto'),number('descuentos','Descuentos'),number('extras','Otros pagos netos'),number('neto','Neto informado')],
 x => {const expected=amount(String(x.bruto))-amount(String(x.descuentos))+amount(String(x.extras));return [`Neto según los importes ingresados: ${money(expected/100)}.`,`Diferencia respecto del recibo: ${money((expected-amount(String(x.neto)))/100)}.`];},
 'Tablas por convenio y revisión de liquidación para emitir un dictamen laboral.',true],
['jubilacheck','JubilaCheck',1,'Medí la diferencia entre aportes declarados y un objetivo personal.',
 [number('aportes','Meses de aportes registrados'),number('objetivo','Meses objetivo indicados para tu caso')],
 x => {check([x.aportes,x.objetivo].every(Number.isInteger),'Ingresá una cantidad entera de meses.');return [`Meses restantes hasta el objetivo declarado: ${Math.max(0,x.objetivo-x.aportes)}.`,'Contrastá tus aportes con tu Historia Laboral de ANSES.'];},'Historia laboral autorizada, régimen aplicable y validación previsional.'],
['creditocheck','CréditoCheck',1,'Compará el desembolso total de dos ofertas expresadas en pesos.',
 [number('capital','Monto neto recibido, igual en ambas ofertas'),number('cuotaA','Cuota fija A'),number('plazoA','Cantidad de cuotas A'),number('cargoA','Cargos únicos A'),number('cuotaB','Cuota fija B'),number('plazoB','Cantidad de cuotas B'),number('cargoB','Cargos únicos B')],
 x => {check(x.capital>0 && [x.plazoA,x.plazoB].every(n=>Number.isInteger(n)&&n>0&&n<=600),'Indicá capital positivo y plazos de 1 a 600 cuotas.');const a=x.cuotaA*x.plazoA+x.cargoA,b=x.cuotaB*x.plazoB+x.cargoB;return [`Oferta A: ${money(a)}. Diferencia sobre capital: ${money(a-x.capital)}.`,`Oferta B: ${money(b)}. Diferencia sobre capital: ${money(b-x.capital)}.`,`Diferencia entre ofertas: ${money(Math.abs(a-b))}.`,'Comparación nominal de cuotas fijas. Revisá el CFT publicado y si incluye impuestos y seguros.'];},'Ofertas vigentes y metodología validada para informar CFT o emitir recomendaciones.',true],
['facturacheck','FacturaCheck',2,'Revisá la coherencia formal del CUIT, código y vencimiento informados.',
 [field('cuit','CUIT de un emisor de prueba o de tu organización'),field('cae','CAE de 14 dígitos'),date('emision','Fecha de emisión'),date('vence','Fecha de vencimiento del CAE')],
 x => {const digits=x.cuit.replace(/-/g,''); const sum=[5,4,3,2,7,6,5,4,3,2].reduce((s,w,i)=>s+w*Number(digits[i]),0);return [`CUIT, dígito verificador: ${/^\d{11}$/.test(digits)&&(11-sum%11)%11===Number(digits[10])?'coincide':'revisar'}.`,`Formato del CAE: ${/^\d{14}$/.test(x.cae)?'14 dígitos':'revisar'}.`,`Orden de fechas: ${days(x.emision,x.vence)>=0?'coherente':'revisar'}.`,'La autenticidad se verifica mediante la constatación de ARCA.'];},'Credenciales y habilitación para el servicio de constatación de ARCA.'],
['monotributocheck','MonotributoCheck',2,'Sabé si te tenés que recategorizar, en qué categoría quedás y cuánto podés facturar.',
 monotributoFields(number),
 evaluateMonotributo,'Revisión de un contador matriculado sobre la tabla vigente y los parámetros de cada caso.',true,'1.0.0'],
['liquidacion-final','Liquidación Final',1,'Calculá todo lo que te tienen que pagar si te despidieron o renunciaste.',
 liquidacionFields(number),evaluateLiquidacion,'Revisión de un abogado laboralista para casos con variables, convenio o reclamo judicial.',true,'1.0.0'],
['aguinaldo','Calculadora de Aguinaldo',1,'Calculá tu aguinaldo neto y bruto, completo o proporcional.',
 aguinaldoFields(number),evaluateAguinaldo,'Herramienta gratuita.',false,'1.0.0'],
['importafacil','ImportaFácil',2,'Armá un presupuesto con el tipo de cambio y los cargos cotizados.',
 [number('mercaderia','Mercadería en moneda de cotización'),number('flete','Flete en la misma moneda'),number('seguro','Seguro en la misma moneda'),number('cambio','Pesos por unidad de esa moneda'),number('cargos','Tributos y otros cargos cotizados en ARS')],
 x => {check(x.cambio>0,'El tipo de cambio debe ser positivo.');const base=(x.mercaderia+x.flete+x.seguro)*x.cambio;return [`Subtotal convertido a pesos: ${money(base)}.`,`Presupuesto según cotización: ${money(base+x.cargos)}.`];},'Régimen, nomenclatura, tributos vigentes y validación aduanera.'],
['mi-partida','MiPartida',2,'Prepará la solicitud de una partida registral.',
 [field('zona','Provincia o jurisdicción del registro'),field('tipo','Tipo de partida'),number('anio','Año del hecho')],
 x => {check(Number.isInteger(x.anio)&&x.anio>=1800&&x.anio<=new Date().getFullYear(),'Revisá el año del hecho.');return checklist(`Localizá el Registro Civil de ${x.zona} para solicitar ${x.tipo} del año ${x.anio}.`,'Reuní datos registrales y acreditá el vínculo si corresponde.','Consultá modalidad, tasa, formato y plazo en la jurisdicción emisora.');},'Acceso por jurisdicción y autorización del titular o representación acreditada.'],
['apostilla-express','Apostilla Express',2,'Prepará la documentación para usarla en el exterior.',
 [field('documento','Tipo de documento'),field('destino','País de destino'),field('emisor','Autoridad emisora')],
 x => checklist(`Identificá si ${x.documento}, emitido por ${x.emisor}, admite el formato exigido en ${x.destino}.`,'Consultá Cancillería y la autoridad receptora sobre apostilla o legalización.','Verificá requisitos de firma digital, traducción y presentación.'),'Autorización para presentar y seguir trámites en TAD, y reglas actualizadas por destino.'],
['pasaporte-listo','PasaporteListo',3,'Organizá tu preparación para solicitar un pasaporte argentino.',
 [field('tramite','Primera emisión, renovación o reposición'),field('lugar','Provincia o país donde iniciarás'),number('edad','Edad')],
 x => checklist(`Consultá el canal competente para ${x.tramite} en ${x.lugar} (RENAPER o consulado).`,'Confirmá el DNI y las condiciones de turno y entrega.',x.edad<18?'Consultá quién debe acompañar a la persona menor y qué documentación acredita representación.':'Verificá el trámite y la modalidad de entrega vigentes.'),'Confirmación de requisitos por RENAPER o consulado y autorización para tramitar en nombre de terceros.'],
['visa-check','VisaCheck',3,'Organizá una revisión documental previa a tu viaje.',
 [field('destino','Destino'),field('nacionalidad','Nacionalidad del pasaporte'),field('motivo','Motivo del viaje'),date('viaje','Fecha estimada de salida')],
 x => checklist(`Consultá con el consulado de ${x.destino} el régimen para pasaporte de ${x.nacionalidad} y viaje por ${x.motivo}.`,`Contrastá turnos y plazos con la salida del ${x.viaje}.`,'Verificá vigencia del pasaporte y documentos según modalidad oficial.'),'Fuentes consulares por nacionalidad y destino, reglas de tránsito y revisión migratoria.'],
['ruta-ciudadania','Ruta de Ciudadanía',3,'Ordená los eslabones familiares y las partidas para una revisión.',
 [field('pais','País de ciudadanía'),list('cadena','Parentescos en orden, una relación por línea')],
 x => {const chain=x.cadena.split('\n').filter(Boolean);check(chain.length<=15,'Usá hasta 15 eslabones.');return [`País indicado: ${x.pais}.`,...chain.map(s=>`Eslabón declarado: ${s}. Verificar partida, fechas y continuidad documental.`),'Confirmá con el consulado la normativa aplicable y la competencia.'];},'Reglas vigentes por país y fecha, partidas auténticas y revisión profesional.'],
['vuelo-reclamo','VueloReclamo',3,'Armá un reclamo formal a la aerolínea según tu caso, con normativa de referencia, pruebas y plazos.',
 [choice('tipo','¿Qué pasó?',VUELO),field('empresa','Aerolínea'),field('vuelo','Número de vuelo'),date('fecha','Fecha del vuelo'),field('ruta','Origen y destino'),internacionalField,list('hechos','Qué pasó, en orden y sin datos personales'),field('pedido','Qué solución solicitás'),date('envio','Fecha en que vas a enviar el reclamo'),number('plazo','Días que le das para responder (1 a 30)')],
 vueloEngine,'Revisión jurídica del encuadre por tipo de caso antes de vender. Seguimiento y presentación ante ANAC fuera de alcance.',true,'2.0.0'],
['expensa-check','ExpensaCheck',4,'Compará rubros y variaciones de expensas con montos transcritos de tus liquidaciones.',
 [list('filas','Una línea por rubro: nombre | período actual | anterior. Usá punto decimal.')],
 x => {const rows=items(x.filas,'|',3).map(([label,a,b])=>[label,amount(a),amount(b)]);check(new Set(rows.map(([label])=>label.toLowerCase())).size===rows.length,'Ingresá cada rubro una sola vez.');return [`Total actual: ${money(total(rows.map(r=>r[1]))/100)}. Total anterior: ${money(total(rows.map(r=>r[2]))/100)}.`,...rows.map(([label,a,b])=>`${label}: ${money(a/100)}. Variación: ${b===0?'sin base anterior':((a-b)*100/b).toFixed(2)+'%'}.`)];},'Extracción de PDF y conciliación documental requieren implementación y cotejo con formatos reales.',true],
['herencia-check','HerenciaCheck',4,'Ordená un inventario y sumá costos informados.',
 [field('zona','Jurisdicción de la sucesión'),number('bienes','Cantidad de bienes en inventario'),number('tasas','Tasas cotizadas'),number('otras','Honorarios y otros gastos cotizados')],
 x => [`Inventario declarado: ${x.bienes} bienes en ${x.zona}.`,`Presupuesto aritmético: ${money(x.tasas+x.otras)}.`,'Reuní partidas, títulos y tasaciones para revisión del profesional.'],'Competencia y normativa local, legitimación, valuación y abogado matriculado.'],
['seguro-check','SeguroCheck',4,'Compará primas y franquicias declaradas de dos pólizas.',
 [field('riesgo','Riesgo asegurado'),number('primaA','Prima anual A'),number('primaB','Prima anual B'),number('franquiciaA','Franquicia A'),number('franquiciaB','Franquicia B')],
 x => [`Riesgo declarado: ${x.riesgo}.`,`Diferencia anual A menos B: ${money(x.primaA-x.primaB)}.`,`Diferencia en franquicia A menos B: ${money(x.franquiciaA-x.franquiciaB)}.`,'Contrastá exclusiones, límites, vigencia y moneda antes de comparar coberturas.'],'Condiciones contractuales completas y revisión por profesional habilitado si corresponde.',true],
['envio-reclamo','EnvíoReclamo',4,'Armá un reclamo formal por una entrega con problemas, con normativa de referencia, pruebas y plazos.',
 [choice('tipo','¿Qué pasó?',ENVIO),field('empresa','Comercio u operador'),date('promesa','Fecha prometida de entrega'),date('revision','Fecha en que verificaste el problema'),list('hechos','Qué pasó, en orden y sin datos personales'),field('pedido','Solución solicitada'),date('envio','Fecha en que vas a enviar el reclamo'),number('plazo','Días que le das para responder (1 a 30)')],
 envioEngine,'Revisión jurídica del encuadre por tipo de caso antes de vender. Presentación y seguimiento ante la autoridad fuera de alcance.',true,'2.0.0'],
['consumo-defensa','ConsumoDefensa',4,'Armá un reclamo formal a una empresa según tu caso, con normativa de referencia, pruebas y plazos.',
 [choice('tipo','¿Qué pasó?',CONSUMO),field('empresa','Empresa'),date('fecha','Fecha de contratación o compra'),list('hechos','Qué pasó, en orden y sin datos personales'),field('pedido','Qué solución solicitás'),date('envio','Fecha en que vas a enviar el reclamo'),number('plazo','Días que le das para responder (1 a 30)')],
 consumoEngine,'Revisión jurídica del encuadre por tipo de caso antes de vender. Presentación y seguimiento ante la autoridad fuera de alcance.',true,'2.0.0']
];
export const services = entries.map(([slug,name,g,description,fields,engine,blocker,sellable=false,version='1.0.0']) => ({slug,name,category:group[g],description,fields,engine,blocker,sellable,version}));
export const getService = slug => services.find(service => service.slug===slug);
export function evaluate(service, values) {
  const input = Object.fromEntries(service.fields.map(({key,type,label,options,show})=>{
    if(show){const [k,v]=show.split(':'); if(values[k]?.trim()!==v) return [key,type==='number'?0:''];}
    const value=values[key]?.trim();
    check(value&&value.length<=(type==='textarea'?2400:120),`Completá el campo «${label}» dentro del límite indicado.`);
    if(type==='select') check(options.some(o=>o.value===value),`Elegí una opción válida en «${label}».`);
    if(type==='number') return [key,amount(value)/100];
    if(type==='date') {
      const time=Date.parse(value);
      check(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value,'Ingresá una fecha válida.');
    }
    return [key,value];
  }));
  return {input,lines:service.engine(input)};
}
// Servicios visibles en el sitio. El resto queda oculto (404) hasta que esté listo para vender.
getService('monotributocheck').teaser = monotributoTeaser;
getService('liquidacion-final').teaser = liquidacionTeaser;
export const listed = ['monotributocheck','liquidacion-final','aguinaldo'].map(getService);
