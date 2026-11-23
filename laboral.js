// Liquidación final y aguinaldo (Ley de Contrato de Trabajo 20.744, con los cambios de la Ley 27.802 vigente desde el 6/3/2026).
// Solo caracteres Latin-1 en las líneas (el PDF usa WinAnsi): nada de rayas largas ni símbolos fuera de ese juego.
import { choice } from './reclamos.js';

export const NORMAS = {
  id: 'LCT 20.744 con Ley 27.802 (6/3/2026)',
  aportes: 0.17 // jubilación 11% + PAMI 3% + obra social 3% sobre conceptos remunerativos
};

const DAY = 86400000;
const money = v => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v).replace(/ /g, ' ');
const num2 = v => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(v);
const fmt = iso => iso.split('-').reverse().join('/');
const fail = m => { throw new Error(m); };
const utc = iso => Date.parse(iso + 'T00:00:00Z');
const iso = t => new Date(t).toISOString().slice(0, 10);
const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const r2 = v => Math.round(v * 100) / 100;

// Antigüedad en años y meses completos entre dos fechas (inclusive el día de egreso).
function antiguedad(desde, hasta) {
  const a = new Date(utc(desde)), b = new Date(utc(hasta) + DAY);
  let meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) meses--;
  return { anios: Math.floor(meses / 12), meses: meses % 12, total: meses };
}

// Días de vacaciones anuales según la antigüedad al 31/12 del año (art. 150 LCT).
function diasVacaciones(ingreso, anio) {
  const { anios } = antiguedad(ingreso, `${anio}-12-31`);
  return anios < 5 ? 14 : anios < 10 ? 21 : anios < 20 ? 28 : 35;
}

// Semestre del aguinaldo que contiene una fecha.
function semestre(t) {
  const d = new Date(t), y = d.getUTCFullYear(), first = d.getUTCMonth() < 6;
  const inicio = Date.UTC(y, first ? 0 : 6, 1), fin = Date.UTC(y, first ? 5 : 11, first ? 30 : 31);
  return { inicio, fin, dias: (fin - inicio) / DAY + 1, nombre: `${first ? 'primer' : 'segundo'} semestre de ${y}` };
}

const MOTIVO = {
  sin_causa: { label: 'Me despidieron sin causa' },
  renuncia: { label: 'Renuncié' },
  prueba: { label: 'Me despidieron durante el período de prueba' }
};
const PREAVISO = { no: { label: 'No, me despidieron sin aviso previo' }, si: { label: 'Sí, me avisaron con anticipación (trabajé el preaviso)' } };
const TOPE = { no: { label: 'No lo sé o mi sueldo es normal para mi convenio' }, si: { label: 'Sí, sé el tope de mi convenio' } };

export const liquidacionFields = num => [
  choice('motivo', '¿Cómo terminó la relación laboral?', MOTIVO),
  { key: 'ingreso', label: 'Fecha de ingreso', type: 'date' },
  { key: 'egreso', label: 'Último día trabajado (fecha de egreso)', type: 'date' },
  { ...num('sueldo', 'Tu mejor sueldo bruto mensual del último año'), unit: 'pesos', hint: 'El bruto del recibo, sin aguinaldo ni vacaciones ni premios que no sean mensuales.' },
  { ...num('tomadas', 'Días de vacaciones que ya te tomaste este año'), unit: 'días', hint: 'Si no te tomaste ninguno, poné 0.' },
  { ...choice('preaviso', '¿Te avisaron del despido con anticipación?', PREAVISO), show: 'motivo:sin_causa' },
  { ...choice('tope', '¿Ganás bastante más que el promedio de tu convenio?', TOPE), show: 'motivo:sin_causa' },
  { ...num('topeMonto', 'Tope indemnizatorio de tu convenio'), unit: 'pesos', show: 'tope:si', hint: 'Lo publica la Secretaría de Trabajo para cada convenio.' }
];

export function evaluateLiquidacion(x) {
  const tIn = utc(x.ingreso), tOut = utc(x.egreso);
  if (!(tOut >= tIn)) fail('La fecha de egreso tiene que ser posterior a la de ingreso.');
  if (tOut - tIn > 60 * 366 * DAY) fail('Revisá la fecha de ingreso.');
  if (!(x.sueldo > 0)) fail('Ingresá tu sueldo bruto mensual.');
  if (x.tomadas < 0 || x.tomadas > 60) fail('Revisá los días de vacaciones tomados.');
  const sinCausa = x.motivo === 'sin_causa', prueba = x.motivo === 'prueba';
  const out = new Date(tOut), y = out.getUTCFullYear(), m = out.getUTCMonth(), dia = out.getUTCDate(), dm = daysIn(y, m);
  const ant = antiguedad(x.ingreso, x.egreso);
  const S = x.sueldo;
  const items = []; // [concepto, importe, remunerativo, detalle]

  // 1. Días trabajados del mes de egreso.
  items.push(['Días trabajados del mes', r2(S * dia / dm), true, `${dia} de ${dm} días de ${String(m + 1).padStart(2, '0')}/${y}`]);

  // 2. Aguinaldo proporcional del semestre.
  const sem = semestre(tOut);
  const desdeSem = Math.max(sem.inicio, tIn);
  const diasSem = (tOut - desdeSem) / DAY + 1;
  items.push(['Aguinaldo (SAC) proporcional', r2(S / 2 * diasSem / sem.dias), true, `${diasSem} de ${sem.dias} días del ${sem.nombre}`]);

  // 3. Vacaciones no gozadas proporcionales (arts. 150, 155 y 156 LCT) y su SAC.
  const anual = diasVacaciones(x.ingreso, y);
  const desdeAnio = Math.max(Date.UTC(y, 0, 1), tIn);
  const diasAnio = (tOut - desdeAnio) / DAY + 1;
  const largo = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / DAY;
  const vacDias = Math.max(0, r2(anual * diasAnio / largo - x.tomadas));
  const vac = r2(S / 25 * vacDias);
  if (vac > 0) {
    items.push(['Vacaciones no gozadas', vac, false, `${num2(vacDias)} días (${anual} por año según tu antigüedad, proporcional a ${diasAnio} días trabajados en ${y}${x.tomadas ? `, menos ${num2(x.tomadas)} ya tomados` : ''}), a sueldo / 25`]);
    items.push(['SAC sobre vacaciones no gozadas', r2(vac / 12), false, 'un doceavo de las vacaciones']);
  }

  // 4. Despido sin causa fuera del período de prueba: preaviso, integración y antigüedad.
  let base = S, topeAplicado = false;
  if (sinCausa) {
    if (x.preaviso === 'no') {
      const meses = ant.total >= 60 ? 2 : 1;
      const pre = S * meses;
      items.push(['Indemnización sustitutiva del preaviso', pre, false, `${meses} ${meses > 1 ? 'meses' : 'mes'} de sueldo (${meses > 1 ? 'más' : 'hasta'} de 5 años de antigüedad)`]);
      items.push(['SAC sobre preaviso', r2(pre / 12), false, 'un doceavo del preaviso']);
      if (dia < dm) {
        const integ = r2(S * (dm - dia) / dm);
        items.push(['Integración del mes de despido', integ, false, `${dm - dia} días que faltaban para terminar el mes`]);
        items.push(['SAC sobre integración', r2(integ / 12), false, 'un doceavo de la integración']);
      }
    }
    if (x.tope === 'si') {
      if (!(x.topeMonto > 0)) fail('Ingresá el tope de tu convenio.');
      if (x.topeMonto < S) { base = Math.max(x.topeMonto, S * 0.67); topeAplicado = true; }
    }
    const anios = Math.max(1, ant.anios + (ant.meses > 3 ? 1 : 0));
    const indem = Math.max(r2(base * anios), S);
    items.push(['Indemnización por antigüedad (art. 245)', indem, false, `${anios} ${anios > 1 ? 'períodos' : 'período'} (años completos más fracción mayor de 3 meses) x ${money(base)}${topeAplicado ? ' (base con tope de convenio, nunca menos del 67% de tu sueldo)' : ''}`]);
  }

  const total = r2(items.reduce((s, i) => s + i[1], 0));
  const remun = r2(items.filter(i => i[2]).reduce((s, i) => s + i[1], 0));
  const aportes = r2(remun * NORMAS.aportes);
  const neto = r2(total - aportes);
  const motivoTxt = MOTIVO[x.motivo].label.toLowerCase();

  const lines = [
    `Resultado: tu liquidación final estimada es de ${money(neto)} en mano (${money(total)} brutos).`,
    `Caso: ${motivoTxt}. Ingreso ${fmt(x.ingreso)}, egreso ${fmt(x.egreso)}. Antigüedad: ${ant.anios} años y ${ant.meses} meses.`,
    '--- CONCEPTO POR CONCEPTO ---',
    ...items.map(([c, v, rem, d]) => `- ${c}: ${money(v)}. ${d.charAt(0).toUpperCase() + d.slice(1)}.${rem ? '' : ' No lleva descuentos.'}`),
    `- Total bruto: ${money(total)}.`,
    `- Descuentos de ley (17% sobre días trabajados y aguinaldo): ${money(aportes)}.`,
    `- Total a cobrar estimado: ${money(neto)}.`
  ];

  lines.push('--- LO QUE TENÉS QUE SABER ---');
  if (sinCausa && ant.total < 6) lines.push('- Atención: con menos de 6 meses de antigüedad probablemente estabas en período de prueba (6 meses en general, más largo en algunas empresas o convenios). En ese caso no corresponden indemnización, preaviso ni integración: recalculá eligiendo "durante el período de prueba".');
  if (sinCausa) lines.push(
    '- Desde la Ley 27.802 (marzo 2026), la base de la indemnización por antigüedad es el mejor sueldo mensual, normal y habitual: no incluye aguinaldo, vacaciones ni premios que no se cobren todos los meses.',
    '- Si tu convenio tiene tope, la base no puede quedar por debajo del 67% de tu sueldo, y la indemnización nunca es menor a un mes de sueldo.',
    x.preaviso === 'si' ? '- Como te preavisaron, no corresponden la indemnización sustitutiva del preaviso ni la integración del mes.' : '- Si no te preavisaron, te corresponden el preaviso (1 mes hasta 5 años de antigüedad, 2 meses si son más) y la integración de los días que faltaban del mes.'
  );
  if (prueba) lines.push('- En el período de prueba no corresponden indemnización por antigüedad, preaviso ni integración del mes (Ley 27.802). Sí te tienen que pagar los días trabajados, el aguinaldo y las vacaciones proporcionales.');
  if (x.motivo === 'renuncia') lines.push('- Al renunciar no corresponde indemnización, pero sí los días trabajados, el aguinaldo proporcional y las vacaciones no gozadas. La renuncia se hace por telegrama laboral gratuito o en forma personal ante la autoridad.');
  lines.push(
    '- Los conceptos indemnizatorios (vacaciones no gozadas, preaviso, integración, antigüedad y sus aguinaldos) no llevan aportes y en general están exentos de Ganancias.',
    '- El empleador tiene 4 días hábiles desde el egreso para pagar la liquidación final, y 30 días corridos para entregarte el certificado de trabajo (art. 80 LCT).'
  );

  lines.push(
    '--- PASO A PASO ---',
    '1. Pedí el recibo de la liquidación final antes de firmar y comparalo concepto por concepto con este informe.',
    '2. Si falta algún concepto o un importe no coincide, firmá agregando "en disconformidad" o "a cuenta de mayor cantidad": así no renunciás a reclamar la diferencia.',
    '3. Exigí el certificado de trabajo y la constancia de aportes (art. 80 LCT) y, si te despidieron, la documentación para el seguro de desempleo de ANSES.',
    '4. Si no te pagan en 4 días hábiles o hay diferencias, podés reclamar gratis en el servicio de conciliación laboral de tu provincia o en la Secretaría de Trabajo.',
    `Informe estimativo basado en los datos que ingresaste y en la ${NORMAS.id}. No incluye horas extra, comisiones variables, adicionales de convenio ni multas, y no reemplaza la revisión de un abogado laboralista o un contador.`
  );
  return lines;
}

export function liquidacionTeaser(lines) {
  const conceptos = lines.filter(l => l.startsWith('- ') && /: \$/.test(l) && !/^- (Total|Descuentos)/.test(l));
  return {
    facts: [['Conceptos que te corresponden', String(conceptos.length)], ['Plazo de pago', '4 días hábiles desde el egreso']],
    includes: ['El total a cobrar en mano y el bruto', 'Cada concepto con su importe y cómo se calcula', 'Los cambios de la reforma laboral 2026 aplicados a tu caso', 'Qué hacer antes de firmar el recibo y cómo reclamar si no te pagan']
  };
}

// Calculadora gratuita de aguinaldo.
export const aguinaldoFields = num => [
  { ...num('sueldo', 'Tu mejor sueldo bruto del semestre'), unit: 'pesos', hint: 'El sueldo bruto más alto que cobraste entre julio y diciembre (o entre enero y junio).' },
  { key: 'ingreso', label: 'Fecha de ingreso al trabajo', type: 'date' },
  { key: 'pago', label: 'Fecha hasta la que calculás', type: 'date', hint: 'Para el aguinaldo de diciembre, poné 31/12. Si te fuiste antes, tu último día.' }
];

export function evaluateAguinaldo(x) {
  if (!(x.sueldo > 0)) fail('Ingresá tu sueldo bruto.');
  const tIn = utc(x.ingreso), tHasta = utc(x.pago);
  if (!(tHasta >= tIn)) fail('La fecha hasta la que calculás tiene que ser posterior a tu ingreso.');
  const sem = semestre(tHasta);
  const desde = Math.max(sem.inicio, tIn);
  const dias = (tHasta - desde) / DAY + 1;
  const completo = desde === sem.inicio && tHasta === sem.fin;
  const bruto = r2(x.sueldo / 2 * dias / sem.dias);
  const neto = r2(bruto * (1 - NORMAS.aportes));
  const vence = sem.fin === Date.UTC(new Date(sem.fin).getUTCFullYear(), 11, 31) ? `18/12/${new Date(sem.fin).getUTCFullYear()}` : `30/06/${new Date(sem.fin).getUTCFullYear()}`;
  return [
    `Resultado: tu aguinaldo del ${sem.nombre} es de ${money(neto)} en mano (${money(bruto)} brutos).`,
    '--- CÓMO SE CALCULA ---',
    `- Mitad del mejor sueldo bruto del semestre: ${money(x.sueldo / 2)}.`,
    completo ? '- Trabajaste el semestre completo: cobrás el aguinaldo entero.' : `- Proporcional a ${dias} de ${sem.dias} días trabajados en el semestre (desde ${fmt(iso(desde))} hasta ${fmt(x.pago)}).`,
    `- Aguinaldo bruto: ${money(bruto)}.`,
    `- Descuentos de ley (17%: jubilación, PAMI y obra social): ${money(r2(bruto - neto))}.`,
    `- Aguinaldo neto estimado: ${money(neto)}.`,
    '--- FECHAS ---',
    `- Se paga hasta el ${vence}; el empleador tiene hasta 4 días hábiles más de tolerancia.`,
    '- Si te despidieron o renunciaste, el aguinaldo proporcional se cobra con la liquidación final.',
    'Cálculo estimativo con la Ley 23.041 y la LCT. Si cobrás variables (horas extra, comisiones), el mejor sueldo los incluye. Si te pagan Ganancias, el neto puede ser menor.'
  ];
}
