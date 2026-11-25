// Ganancias Claro: impuesto a las Ganancias de un empleado en relación de dependencia (cuarta categoría), período fiscal 2026.
// Valores oficiales de ARCA para la liquidación anual 2026: escala del art. 94 "período anual 2026" y deducciones
// del art. 30 "período anual 2026", más la deducción especial adicional de 1/12 de a), b) y c) ap. 2. Solo caracteres Latin-1 en las líneas.
import { choice } from './reclamos.js';

export const TABLA = {
  id: 'ARCA, liquidación anual 2026 (escala art. 94 y deducciones art. 30 del período anual)',
  gni: 6019671.36,
  especial: 28894422.56, // art. 30 inc. c) ap. 2, relación de dependencia
  conyuge: 5669323.06,
  hijo: 2859060.31,
  hijoInc: 5718120.60,
  aportes: 0.17,
  escala: [
    [0, 0, 0.05], [2336953.69, 116847.68, 0.09], [4673907.36, 327173.52, 0.12], [7010861.05, 607607.96, 0.15],
    [10516291.59, 1133422.54, 0.19], [21032583.18, 3131517.94, 0.23], [31548874.77, 5550265.01, 0.27],
    [47323312.16, 9809363.10, 0.31], [70984968.25, 17144476.49, 0.35]
  ]
};

const money = v => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v).replace(/ /g, ' ');
const pct = v => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(v * 100) + '%';
const fail = m => { throw new Error(m); };

export function impuesto(base) {
  if (base <= 0) return 0;
  let t = TABLA.escala[0];
  for (const tramo of TABLA.escala) if (base > tramo[0]) t = tramo;
  return t[1] + (base - t[0]) * t[2];
}

const SINO = { no: { label: 'No' }, si: { label: 'Sí' } };
const HIJOS50 = { si: { label: 'Sí, los deducimos entre los dos (50% cada uno)' }, no: { label: 'No, los deduzco solo yo (100%)' } };

export const gananciasFields = num => [
  { ...num('sueldo', 'Tu sueldo bruto mensual'), unit: 'pesos', hint: 'El bruto del recibo, antes de descuentos. Si varía, usá un promedio.' },
  choice('conyuge', '¿Tu cónyuge o pareja conviviente está a tu cargo (no tiene ingresos)?', SINO),
  { ...num('hijos', 'Hijos menores de 18 a tu cargo'), unit: 'hijos', hint: 'Si no tenés, poné 0.' },
  choice('hijos50', '¿El otro progenitor también trabaja y deduce a los hijos?', HIJOS50),
  { ...num('alquiler', 'Alquiler mensual de tu vivienda'), unit: 'pesos', hint: 'Si no alquilás, poné 0.' },
  { ...num('domestico', 'Pago mensual al servicio doméstico registrado'), unit: 'pesos', hint: 'Sueldo más aportes. Si no tenés, poné 0.' },
  { ...num('prepaga', 'Cuota mensual de prepaga que pagás vos'), unit: 'pesos', hint: 'La parte que pagás de tu bolsillo. Si no, poné 0.' }
];

export function evaluateGanancias(x) {
  if (!(x.sueldo > 0)) fail('Ingresá tu sueldo bruto mensual.');
  if (!Number.isInteger(x.hijos) || x.hijos < 0 || x.hijos > 15) fail('Revisá la cantidad de hijos.');
  const T = TABLA;
  const bruto = x.sueldo * 13;
  const aportes = bruto * T.aportes;
  const neta = bruto - aportes;
  const alquiler = Math.min(x.alquiler * 12 * 0.4, T.gni);
  const domestico = Math.min(x.domestico * 12, T.gni);
  const prepaga = Math.min(x.prepaga * 12, (neta - alquiler - domestico) * 0.05);
  const share = x.hijos50 === 'si' ? 0.5 : 1;
  const conyuge = x.conyuge === 'si' ? T.conyuge : 0;
  const hijos = x.hijos * T.hijo * share;
  const base12 = T.gni + T.especial + conyuge + hijos;
  const doceava = base12 / 12; // deducción especial adicional: 1/12 de a), b) y c) ap. 2 (tabla anual ARCA)
  const personales = base12 + doceava;
  const siradig = alquiler + domestico + prepaga;
  const base = Math.max(0, neta - siradig - personales);
  const imp = impuesto(base);
  const sinSiradig = impuesto(Math.max(0, neta - personales));
  const mensual = imp / 13;
  const umbral = (personales / (1 - T.aportes)) / 13;
  const lines = [
    imp > 0
      ? `Resultado: pagás ${money(imp)} de Ganancias en el año, unos ${money(mensual)} por mes en promedio (${pct(imp / bruto)} de tu bruto).`
      : 'Resultado: con estos datos no pagás Ganancias en 2026.',
    `Sueldo bruto ${money(x.sueldo)} por mes; ${money(bruto)} en el año con aguinaldo.`,
    '--- CÓMO SE CALCULA ---',
    `- Ingreso bruto anual (12 sueldos más aguinaldo): ${money(bruto)}.`,
    `- Menos aportes de ley (17%): ${money(aportes)}. Ganancia neta: ${money(neta)}.`,
    `- Menos deducciones que cargás en SiRADIG: ${money(siradig)}${siradig ? ` (alquiler ${money(alquiler)}, servicio doméstico ${money(domestico)}, prepaga ${money(prepaga)})` : ''}.`,
    `- Menos deducciones personales: ${money(personales)} (mínimo no imponible ${money(T.gni)}, deducción especial ${money(T.especial)}, deducción especial adicional de un doceavo ${money(doceava)}${conyuge ? `, cónyuge ${money(conyuge)}` : ''}${hijos ? `, hijos ${money(hijos)}` : ''}).`,
    `- Ganancia sujeta a impuesto: ${money(base)}.`,
    `- Impuesto según la escala del art. 94: ${money(imp)}.`,
    '--- CUÁNTO TE AHORRA EL SIRADIG ---',
    siradig ? `- Por las deducciones que cargaste te ahorrás ${money(sinSiradig - imp)} en el año. Si no las informás en SiRADIG, te retienen de más.`
      : '- No cargaste deducciones. Si alquilás, tenés servicio doméstico o pagás prepaga, informalo en SiRADIG: baja el impuesto.',
    '- El alquiler deduce el 40% de lo que pagás, con tope en el mínimo no imponible. El servicio doméstico, hasta ese mismo tope. La prepaga, hasta el 5% de tu ganancia neta.',
    `- Con tu situación familiar, empezás a pagar Ganancias con un bruto de alrededor de ${money(umbral)} por mes.`,
    '--- PASO A PASO ---',
    '1. Ingresá a ARCA con tu clave fiscal y abrí "SiRADIG - Trabajador".',
    '2. Cargá tus cargas de familia y las deducciones (alquiler, servicio doméstico, prepaga) con los comprobantes.',
    '3. Enviá el formulario a tu empleador: la retención se ajusta desde la liquidación siguiente.',
    '4. Si te retuvieron de más en el año, la diferencia se devuelve en la liquidación anual (hasta fines de mayo).',
    `Estimación con los valores oficiales de ${T.id}. No incluye horas extra, bonos, otros ingresos ni deducciones que no cargaste, y el empleador retiene mes a mes con valores acumulados, así que la retención mensual real puede variar.`
  ];
  return lines;
}

export function gananciasTeaser(lines) {
  const paga = !/no pagás Ganancias/.test(lines[0]);
  return {
    facts: [['¿Pagás Ganancias?', paga ? 'Sí, con estos datos pagás' : 'No, con estos datos no pagás'], ['Período', 'Año fiscal 2026']],
    includes: ['Cuánto pagás en el año y por mes', 'El cálculo paso a paso con los valores oficiales de ARCA', 'Cuánto te ahorran tus deducciones de SiRADIG', 'Desde qué sueldo empezás a pagar con tu situación familiar']
  };
}
