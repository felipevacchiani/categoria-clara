// AlquilerClaro: actualización de alquileres por ICL (BCRA) o IPC (INDEC) con los índices oficiales.
// Solo caracteres Latin-1 en las líneas (el PDF usa WinAnsi).
import { choice } from './reclamos.js';
import { icl, iclLast, ipc, ipcLast } from './indices.js';

const money = v => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v).replace(/ /g, ' ');
const pct = v => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v * 100) + '%';
const fmt = iso => iso.split('-').reverse().join('/');
const fail = m => { throw new Error(m); };
const addMonths = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10); };
const ym = iso => iso.slice(0, 7);
const prevYm = (y, n = 1) => { const [a, m] = y.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 - n, 1)); return d.toISOString().slice(0, 7); };
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesTxt = y => `${MES[Number(y.slice(5)) - 1]} ${y.slice(0, 4)}`;

const INDICE = {
  icl: { label: 'ICL (Índice para Contratos de Locación del BCRA)' },
  ipc: { label: 'IPC (inflación del INDEC)' }
};
const PERIODO = { 3: { label: 'Cada 3 meses' }, 4: { label: 'Cada 4 meses' }, 6: { label: 'Cada 6 meses' }, 12: { label: 'Cada 12 meses' } };

export const alquilerFields = num => [
  { ...num('monto', 'Alquiler que pagás hoy'), unit: 'pesos' },
  choice('indice', '¿Con qué índice se actualiza tu contrato?', INDICE),
  choice('periodo', '¿Cada cuánto se actualiza?', PERIODO),
  { key: 'desde', label: 'Fecha desde la que rige el monto actual', type: 'date', hint: 'El inicio del contrato o la fecha del último aumento.' }
];

// IPC: variación acumulada de los últimos N meses publicados a la fecha del ajuste.
// El INDEC publica cada mes a mediados del siguiente; se toma como publicado el día 15.
function ipcFactor(desde, hasta, n) {
  let fin = prevYm(ym(hasta), Number(hasta.slice(8)) >= 15 ? 1 : 2);
  const last = ipcLast();
  let estimado = false;
  if (!last) fail('Los índices no están disponibles en este momento. Probá de nuevo en unos minutos.');
  if (fin > last[0]) { fin = last[0]; estimado = true; }
  const ini = prevYm(fin, n);
  const a = ipc(ini), b = ipc(fin);
  if (!a || !b) fail('No hay datos del IPC para esas fechas.');
  return { factor: b / a, detalle: `IPC de ${mesTxt(fin)} (${b.toFixed(2)}) / IPC de ${mesTxt(ini)} (${a.toFixed(2)}): variación de los ${n} meses de ${mesTxt(prevYm(fin, n - 1))} a ${mesTxt(fin)}`, estimado, ultimo: mesTxt(last[0]) };
}

function iclFactor(desde, hasta) {
  const a = icl(desde), last = iclLast();
  if (!a || !last) fail('Los índices no están disponibles en este momento. Probá de nuevo en unos minutos.');
  if (hasta <= last[0]) {
    const b = icl(hasta);
    return { factor: b[1] / a[1], detalle: `ICL del ${fmt(b[0])} (${b[1].toFixed(2)}) / ICL del ${fmt(a[0])} (${a[1].toFixed(2)})`, estimado: false, ultimo: fmt(last[0]) };
  }
  // Ajuste posterior al último dato: se proyecta el ICL con su ritmo diario de los últimos 90 días
  // (usar el último valor sin proyectar subestimaría el aumento).
  const DAY = 86400000, t = d => Date.parse(d + 'T00:00:00Z');
  const ref = icl(new Date(t(last[0]) - 90 * DAY).toISOString().slice(0, 10));
  const dias = (t(hasta) - t(last[0])) / DAY;
  const ritmo = ref && ref[0] < last[0] ? Math.pow(last[1] / ref[1], 1 / ((t(last[0]) - t(ref[0])) / DAY)) : 1;
  const proy = last[1] * Math.pow(ritmo, dias);
  return { factor: proy / a[1], detalle: `ICL proyectado al ${fmt(hasta)} (${proy.toFixed(2)}, con el ritmo de los últimos 90 días desde el último dato del ${fmt(last[0])}: ${last[1].toFixed(2)}) / ICL del ${fmt(a[0])} (${a[1].toFixed(2)})`, estimado: true, ultimo: fmt(last[0]) };
}

export function evaluateAlquiler(x, hoy = new Date().toISOString().slice(0, 10)) {
  if (!(x.monto > 0)) fail('Ingresá el alquiler que pagás hoy.');
  const n = Number(x.periodo);
  if (x.desde < '2020-07-01' && x.indice === 'icl') fail('El ICL existe desde el 1/7/2020. Revisá la fecha.');
  if (x.desde > hoy) fail('La fecha del monto actual no puede ser futura.');
  // Ajuste que corresponde sobre el monto vigente: un período después de la fecha desde la que rige.
  const ajuste = addMonths(x.desde, n);
  const atrasado = addMonths(x.desde, 2 * n) <= hoy;
  const f = x.indice === 'icl' ? iclFactor(x.desde, ajuste) : ipcFactor(x.desde, ajuste, n);
  const nuevo = x.monto * f.factor;
  const yaPaso = ajuste <= hoy;
  const lines = [
    `Resultado: ${yaPaso ? 'desde el' : 'a partir del'} ${fmt(ajuste)} tu alquiler pasa de ${money(x.monto)} a ${money(nuevo)} (aumento del ${pct(f.factor - 1)})${f.estimado ? ', estimado: el índice de esa fecha todavía no está publicado' : ''}.`,
    `Contrato actualizado por ${x.indice.toUpperCase()}, ${PERIODO[x.periodo].label.toLowerCase()}. Monto vigente desde el ${fmt(x.desde)}.`,
    '--- CÓMO SE CALCULA ---',
    `- Índice: ${f.detalle}.`,
    `- Coeficiente: ${f.factor.toFixed(4)}. ${money(x.monto)} x ${f.factor.toFixed(4)} = ${money(nuevo)}.`,
    ...(f.estimado ? [`- El ajuste es posterior al último dato publicado (${f.ultimo}): el monto es una estimación. Recalculalo el día del ajuste con el índice definitivo.`] : []),
    ...(atrasado ? [`- Atención: desde el ${fmt(x.desde)} ya pasó más de un período de ${n} meses. Si en el medio hubo aumentos, cargá como fecha la del último aumento aplicado.`] : []),
    '--- PRÓXIMOS AJUSTES ---',
    ...[1, 2, 3].map(k => `- ${fmt(addMonths(ajuste, n * k))}: nuevo ajuste por ${x.indice.toUpperCase()} sobre el monto que rija entonces.`),
    '--- LO QUE TENÉS QUE SABER ---',
    x.indice === 'icl'
      ? '- El ICL lo publica el BCRA todos los días y combina inflación y salarios. Se toma el valor del día del inicio del período y el del día del ajuste.'
      : '- Para el IPC tomamos la variación acumulada de los últimos meses publicados por el INDEC al día del ajuste. Si tu contrato fija otro criterio (por ejemplo, otros meses), vale lo que dice el contrato.',
    '- Desde el DNU 70/2023, en los contratos firmados después del 29/12/2023 el índice y la frecuencia los pactan las partes. Los contratos anteriores siguen con el ICL anual de la Ley 27.551.',
    '- El aumento se aplica sobre el alquiler; las expensas y los servicios van aparte.',
    `Cálculo con los índices oficiales (BCRA e INDEC) disponibles al ${fmt(hoy)}. Verificá la cláusula de actualización de tu contrato.`
  ];
  return lines;
}

export function alquilerTeaser(lines) {
  const r = lines[0];
  const fecha = r.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || '';
  return {
    facts: [['Fecha del próximo ajuste', fecha], ['Índice', /ICL/.test(lines[1]) ? 'ICL del BCRA' : 'IPC del INDEC']],
    includes: ['El monto nuevo exacto y el porcentaje de aumento', 'El cálculo con los índices oficiales, paso a paso', 'Las fechas de los próximos tres ajustes', 'Qué dice la ley según la fecha de tu contrato']
  };
}
