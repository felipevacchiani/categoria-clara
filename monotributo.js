// MonotributoCheck: informe de recategorización con la tabla oficial de ARCA.
// La tabla se versiona: cuando ARCA publica la actualización semestral (enero y julio), se agrega una
// versión nueva y se sube la versión del motor. Solo caracteres Latin-1 en las líneas (el PDF usa WinAnsi).
import { choice } from './reclamos.js';

// Fuente: https://www.arca.gob.ar/monotributo/categorias.asp - "Valores de aplicación desde el 1/08/2026".
export const TABLE = {
  id: 'ARCA 1/08/2026',
  vigencia: '2026-08-01',
  precioUnitarioMax: 716840.77,
  categorias: [
    // cat, ingresos, superficie m2, energia kWh, alquileres, total servicios, total bienes,
    // impuesto integrado servicios, impuesto integrado bienes, aporte SIPA, aporte obra social
    ['A', 12009410.45, 30, 3330, 2792886.15, 49527.18, 49527.18, 5585.77, 5585.77, 18246.86, 25694.55],
    ['B', 17595182.74, 45, 5000, 2792886.15, 56379.08, 56379.08, 10612.98, 10612.98, 20071.55, 25694.55],
    ['C', 24670494.31, 60, 6700, 3816944.41, 66020.12, 64530.58, 18246.86, 16757.32, 22078.71, 25694.55],
    ['D', 30628651.43, 85, 10000, 3816944.41, 84612.93, 82564.81, 29790.79, 27742.67, 24286.58, 30535.56],
    ['E', 36028231.33, 110, 13000, 4841002.66, 119811.45, 108267.51, 55857.73, 44313.79, 26715.24, 37238.48],
    ['F', 45151659.41, 150, 16500, 4841002.66, 150784.21, 129930.65, 78573.20, 57719.64, 29386.76, 42824.25],
    ['G', 53995798.87, 200, 20000, 5771964.69, 230312.94, 158815.05, 142995.76, 71497.87, 41141.46, 46175.72],
    ['H', 81924660.37, 200, 20000, 8378658.45, 522706.68, 317895.01, 409623.31, 204811.64, 57598.04, 55485.33],
    ['I', 91699761.90, 200, 20000, 8378658.45, 963747.86, 474992.78, 814591.79, 325836.71, 80637.26, 68518.81],
    ['J', 105012519.20, 200, 20000, 8378658.45, 1167299.76, 580793.69, 977510.14, 391004.07, 112892.16, 76897.46],
    ['K', 126610838.75, 200, 20000, 8378658.45, 1614446.04, 702103.24, 1368514.20, 456171.40, 158049.02, 87882.82]
  ].map(([cat, ingresos, superficie, energia, alquileres, servicios, bienes, impS, impB, sipa, os]) => ({ cat, ingresos, superficie, energia, alquileres, servicios, bienes, impS, impB, sipa, os }))
};

export const RECATEGORIZACION = { vence: '2027-02-05', periodo: 'enero a diciembre de 2026' };

const ACTIVIDAD = { servicios: { label: 'Prestación de servicios' }, bienes: { label: 'Venta de cosas muebles (productos)' } };
const CATEGORIAS = Object.fromEntries(TABLE.categorias.map(c => [c.cat, { label: 'Categoría ' + c.cat }]));
const SINO = { no: { label: 'No' }, si: { label: 'Sí' } };

const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value).replace(/ /g, ' ');
const fmt = iso => iso.split('-').reverse().join('/');
const fail = message => { throw new Error(message); };
const idx = cat => TABLE.categorias.findIndex(c => c.cat === cat);

// Categoría mínima que admite el valor para un parámetro; -1 si supera la máxima (exclusión).
function catFor(key, value) {
  if (!value) return 0;
  return TABLE.categorias.findIndex(c => value <= c[key]);
}

export function evaluateMonotributo(x) {
  const actividad = x.actividad;
  const ingresos = x.ingresos + x.diciembre;
  const actual = idx(x.categoria);
  const chica = x.poblacion === 'si' && x.superficie > 0; // la superficie no se considera en localidades de hasta 40.000 habitantes
  const params = [
    ['ingresos', 'Ingresos brutos de los últimos 12 meses', ingresos, money(ingresos)],
    ['superficie', 'Superficie afectada a la actividad', chica ? 0 : x.superficie, chica ? `${x.superficie} m2, no se computa en localidades de hasta 40.000 habitantes` : `${x.superficie} m2`],
    ['energia', 'Energía eléctrica consumida en el año', x.energia, `${x.energia} kWh`],
    ['alquileres', 'Alquileres devengados en el año', x.alquileres, money(x.alquileres)]
  ].map(([key, label, value, shown]) => ({ key, label, value, shown, pos: catFor(key, value) }));
  const excesos = params.filter(p => p.pos === -1);
  const precioExcedido = actividad === 'bienes' && x.precio > TABLE.precioUnitarioMax;
  const excluido = excesos.length > 0 || precioExcedido;
  const pos = excluido ? -1 : Math.max(...params.map(p => p.pos));
  const nueva = excluido ? null : TABLE.categorias[pos];
  const vieja = TABLE.categorias[actual];
  // Cuota según la situación previsional (ARCA, notas de la tabla): quien aporta a otro régimen, los menores de 18
  // y quienes solo alquilan bienes no pagan SIPA ni obra social; los jubilados no pagan obra social.
  const ap = APORTES[x.aportes] ? x.aportes : 'general';
  const cuota = c => (actividad === 'servicios' ? c.impS : c.impB) + (ap === 'general' || ap === 'jubilado' ? c.sipa : 0) + (ap === 'general' ? c.os : 0);
  const vence = fmt(RECATEGORIZACION.vence);

  const situacion = excluido ? 'Quedarías fuera del Monotributo con estos datos.'
    : pos === actual ? `No tenés que recategorizarte: seguís en la categoría ${vieja.cat}.`
    : pos > actual ? `Tenés que recategorizarte: subís de la categoría ${vieja.cat} a la ${nueva.cat}.`
    : `Te conviene recategorizarte: bajás de la categoría ${vieja.cat} a la ${nueva.cat}.`;

  const lines = [
    `Resultado: ${situacion}`,
    `Plazo: la recategorización vence el ${vence} y toma lo facturado de ${RECATEGORIZACION.periodo}.`,
    '--- TU CATEGORÍA, PARÁMETRO POR PARÁMETRO ---',
    ...params.map(p => `- ${p.label}: ${p.shown}. ${p.pos === -1 ? 'Supera el máximo del régimen.' : p.value ? `Corresponde a la categoría ${TABLE.categorias[p.pos].cat}.` : p.key === 'superficie' && chica ? 'No define la categoría (salvo excepciones de ARCA para algunas actividades).' : 'No informado: no se tuvo en cuenta.'}`),
    ...(actividad === 'bienes' ? [`- Precio unitario máximo de venta: ${money(x.precio)}. ${precioExcedido ? 'Supera el máximo de ' + money(TABLE.precioUnitarioMax) + '.' : 'Dentro del máximo de ' + money(TABLE.precioUnitarioMax) + '.'}`] : []),
    excluido ? 'La categoría la define el parámetro más alto, y al menos uno supera el máximo del régimen.' : `La categoría la define el parámetro más alto: ${params.filter(p => p.pos === pos).map(p => p.label.toLowerCase()).join(' y ')}.`
  ];

  if (excluido) {
    lines.push(
      '--- EXCLUSIÓN DEL RÉGIMEN ---',
      ...excesos.map(p => `- ${p.label}: ${p.shown} supera el máximo de la categoría K.`),
      ...(precioExcedido ? [`- El precio unitario de venta supera el máximo de ${money(TABLE.precioUnitarioMax)}.`] : []),
      'Si se confirma la exclusión, pasás al régimen general (IVA y Ganancias). Revisalo con tu contador antes de facturar de nuevo.'
    );
  } else {
    const diferencia = cuota(nueva) - cuota(vieja);
    const margenNueva = nueva.ingresos - ingresos;
    const margenActual = vieja.ingresos - x.ingresos;
    lines.push(
      '--- CUOTA MENSUAL ---',
      `- Categoría ${vieja.cat} (actual): ${money(cuota(vieja))} por mes.`,
      ...(pos !== actual ? [`- Categoría ${nueva.cat}: ${money(cuota(nueva))} por mes. Diferencia: ${diferencia > 0 ? '+' : ''}${money(diferencia)} por mes; ${diferencia > 0 ? '+' : ''}${money(diferencia * 6)} en el semestre de febrero a julio.`] : []),
      `- Composición en tu caso: ${APORTES[ap].detalle}.${ap === 'general' ? ' Si sumás adherentes a la obra social, pagás el aporte de obra social una vez más por cada uno.' : ''}`,
      'Montos con la tabla vigente; ARCA los actualiza por inflación antes de la recategorización.',
      '--- CUÁNTO PODÉS FACTURAR ---',
      margenActual > 0
        ? `- Para no superar el tope de tu categoría actual (${vieja.cat}), en diciembre podés facturar hasta ${money(margenActual)}.`
        : `- Con lo facturado de enero a noviembre ya superaste el tope de la categoría ${vieja.cat} (${money(vieja.ingresos)}).`,
      margenNueva >= 0
        ? `- Con lo que estimás para diciembre, quedás a ${money(margenNueva)} del tope de la categoría ${nueva.cat}.`
        : '',
      'Los topes se actualizan en enero por inflación: con la tabla nueva el margen suele ser mayor. Rehacé el cálculo cuando ARCA publique la tabla.'
    );
  }

  const alertas = [];
  if (x.billeteras === 'si') alertas.push('Cobros sin facturar en cuentas o billeteras: ARCA cruza esa información y puede recategorizarte de oficio con ingresos que no declaraste. Facturá todos los cobros de la actividad.');
  if (!excluido && pos > actual) alertas.push('Si no te recategorizás antes del vencimiento, ARCA puede hacerlo de oficio y aplicar sanciones.');
  if (!excluido && nueva && ingresos > nueva.ingresos * 0.9) alertas.push(`Estás a menos del 10% del tope de la categoría ${nueva.cat}: controlá la facturación mes a mes.`);
  if (alertas.length) lines.push('--- ALERTAS ---', ...alertas.map(a => `- ${a}`));

  lines.push(
    '--- PASO A PASO ---',
    ...(excluido
      ? ['1. No te recategorices dentro del Monotributo con estos datos: consultá con un contador cómo pasar al régimen general.', '2. Reuní tus comprobantes de los últimos 12 meses y los datos de superficie, energía y alquileres.']
      : pos === actual
        ? ['1. No tenés que hacer el trámite: si tu categoría no cambia, no se presenta nada.', `2. Seguí pagando la cuota de la categoría ${vieja.cat} con los montos que ARCA actualice desde febrero.`, '3. Revisá de nuevo en julio, en la próxima recategorización.']
        : [`1. Antes del ${vence}, ingresá con clave fiscal al Portal Monotributo de ARCA y elegí "Recategorizarme".`, '2. Revisá que los ingresos y parámetros que muestra el sistema coincidan con los de este informe.', `3. Confirmá la categoría ${nueva.cat} y guardá la constancia.`, '4. Desde febrero pagá la cuota de la nueva categoría.']),
    'Si ARCA te recategorizó de oficio y no estás de acuerdo, podés presentar un reclamo desde el Portal Monotributo con la documentación que respalde tus ingresos.',
    `Informe basado en los datos que ingresaste y en la tabla oficial de ARCA vigente desde ${fmt(TABLE.vigencia)}. No reemplaza el análisis de tu situación completa por un contador.`
  );
  return lines.filter(Boolean);
}

const APORTES = {
  general: { label: 'Solo aporto por el Monotributo', detalle: 'impuesto integrado + jubilación (SIPA) + obra social' },
  otro: { label: 'También trabajo en relación de dependencia o aporto a una caja profesional', detalle: 'solo el impuesto integrado: quien aporta a otro régimen previsional no paga SIPA ni obra social en el Monotributo' },
  jubilado: { label: 'Soy jubilado o jubilada', detalle: 'impuesto integrado + jubilación (SIPA): los jubilados no pagan obra social. Si te jubilaste antes de 07/1994, tampoco pagás SIPA' },
  exento: { label: 'Solo alquilo bienes, o soy menor de 18 años', detalle: 'solo el impuesto integrado: no pagás SIPA ni obra social' }
};
const POBLACION = { no: { label: 'No, más de 40.000 habitantes' }, si: { label: 'Sí, hasta 40.000 habitantes' } };
const LOCAL = { no: { label: 'No, trabajo sin local (desde casa, en la calle, online)' }, si: { label: 'Sí, tengo local, oficina o depósito' } };
export const monotributoFields = num => [
  choice('actividad', '¿A qué te dedicás?', ACTIVIDAD),
  choice('categoria', 'Tu categoría actual', CATEGORIAS),
  { ...num('ingresos', 'Lo que facturaste de enero a noviembre de 2026'), unit: 'pesos', help: 'meses' },
  { ...num('diciembre', 'Lo que pensás facturar en diciembre'), unit: 'pesos', hint: 'Una estimación alcanza. Si no vas a facturar, poné 0.' },
  choice('local', '¿Tenés un local para la actividad?', LOCAL),
  { ...num('superficie', 'Superficie del local'), unit: 'm²', show: 'local:si' },
  { ...choice('poblacion', '¿El local está en una ciudad o pueblo de hasta 40.000 habitantes?', POBLACION), show: 'local:si' },
  { ...num('energia', 'Luz que consumió el local en el año'), unit: 'kWh', show: 'local:si', hint: 'Sumá los kWh de las facturas de luz del local de 2026.' },
  { ...num('alquileres', 'Alquiler que pagaste por el local en el año'), unit: 'pesos', show: 'local:si', hint: 'Si el local es tuyo, poné 0.' },
  { ...num('precio', 'Precio del producto más caro que vendés'), unit: 'pesos', show: 'actividad:bienes' },
  choice('aportes', '¿Cómo aportás a la jubilación?', APORTES),
  choice('billeteras', '¿Cobrás en billeteras o transferencias sin facturar?', SINO)
];

// Resumen gratuito: si hay que recategorizarse y hasta cuándo, sin la categoría ni los montos.
export function monotributoTeaser(lines) {
  const result = lines.find(l => l.startsWith('Resultado: '))?.slice(11) ?? '';
  const direccion = /subís/.test(result) ? 'Sí, tenés que recategorizarte (subís de categoría).'
    : /bajás/.test(result) ? 'Te conviene recategorizarte (bajás de categoría).'
    : /fuera/.test(result) ? 'Con estos datos quedarías fuera del Monotributo.'
    : 'No tenés que recategorizarte.';
  const alertas = lines.filter(l => l.startsWith('- ') && /ARCA cruza|menos del 10%|de oficio y aplicar/.test(l)).length;
  return {
    facts: [['¿Tenés que recategorizarte?', direccion], ['Vence', fmt(RECATEGORIZACION.vence)]],
    includes: ['Tu categoría exacta, parámetro por parámetro', 'La cuota nueva y cuánto cambia en el semestre', 'Cuánto podés facturar en diciembre sin pasarte', ...(alertas ? [`${alertas} alerta${alertas > 1 ? 's' : ''} sobre tu situación`] : []), 'El paso a paso para hacer el trámite en ARCA']
  };
}
