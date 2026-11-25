// CréditoCheck: costo real de un préstamo en cuotas fijas (tasa interna de retorno) y su valor ajustado por inflación.
// Solo caracteres Latin-1 en las líneas (el PDF usa WinAnsi).
import { choice } from './reclamos.js';

const money = v => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v).replace(/ /g, ' ');
const pct = v => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v * 100) + '%';
const fail = m => { throw new Error(m); };

// Tasa mensual que iguala el valor actual de las cuotas con el monto recibido (bisección; -99,9% a 50% mensual).
// Si las cuotas suman menos que lo recibido, la tasa es negativa (no 0%).
export function tasaMensual(recibido, cuota, n) {
  const va = i => i === 0 ? cuota * n : cuota * (1 - Math.pow(1 + i, -n)) / i;
  if (cuota * n === recibido) return 0;
  let lo = cuota * n < recibido ? -0.999 : 0, hi = cuota * n < recibido ? 0 : 0.5;
  if (va(hi) > recibido) fail('La cuota es demasiado alta para el monto: revisá los datos.');
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (va(mid) > recibido) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
const valorActual = (cuota, n, i) => i === 0 ? cuota * n : cuota * (1 - Math.pow(1 + i, -n)) / i;

const DOS = { no: { label: 'No, quiero analizar una sola oferta' }, si: { label: 'Sí, quiero comparar dos ofertas' } };

export const creditoFields = num => [
  { ...num('capital', 'Monto que recibís en mano'), unit: 'pesos', hint: 'Lo que te depositan, ya descontados gastos de otorgamiento y comisiones.' },
  { ...num('cuotaA', 'Cuota mensual de la oferta'), unit: 'pesos', hint: 'La cuota total que pagás por mes, con IVA, seguros y cargos incluidos.' },
  { ...num('plazoA', 'Cantidad de cuotas'), unit: 'cuotas' },
  choice('comparar', '¿Tenés otra oferta para comparar?', DOS),
  { ...num('cuotaB', 'Cuota mensual de la otra oferta'), unit: 'pesos', show: 'comparar:si' },
  { ...num('plazoB', 'Cantidad de cuotas de la otra oferta'), unit: 'cuotas', show: 'comparar:si' },
  { ...num('inflacion', 'Inflación mensual que esperás'), unit: '%', hint: 'Por ejemplo 2. Si no sabés, usá la última inflación mensual publicada por el INDEC.' }
];

function analiza(nombre, recibido, cuota, n, inf) {
  if (!(cuota > 0) || !Number.isInteger(n) || n < 1 || n > 120) fail(`Revisá la cuota y la cantidad de cuotas (1 a 120) de ${nombre}.`);
  const i = tasaMensual(recibido, cuota, n);
  const tea = Math.pow(1 + i, 12) - 1, tna = i * 12;
  const total = cuota * n;
  const real = valorActual(cuota, n, inf);
  const tasaReal = (1 + i) / (1 + inf) - 1;
  return { nombre, i, tea, tna, total, real, tasaReal, cuota, n };
}

export function evaluateCredito(x) {
  if (!(x.capital > 0)) fail('Ingresá el monto que recibís.');
  if (x.inflacion < 0 || x.inflacion > 50) fail('La inflación mensual tiene que estar entre 0 y 50%.');
  const inf = x.inflacion / 100;
  const ofertas = [analiza('la oferta', x.capital, x.cuotaA, x.plazoA, inf)];
  if (x.comparar === 'si') { ofertas[0].nombre = 'la oferta A'; ofertas.push(analiza('la oferta B', x.capital, x.cuotaB, x.plazoB, inf)); }
  // Las dos ofertas entregan el mismo monto: conviene la que cuesta menos en pesos de hoy con la inflación supuesta.
  // La TEA se informa aparte: con plazos distintos, la de menor tasa puede costar más en pesos de hoy.
  const mejor = ofertas.length > 1 ? (ofertas[0].real <= ofertas[1].real ? ofertas[0] : ofertas[1]) : null;
  const otraOf = mejor ? (mejor === ofertas[0] ? ofertas[1] : ofertas[0]) : null;
  const coincide = mejor && mejor.tea <= otraOf.tea;
  const o = ofertas[0];
  const lines = [
    mejor ? `Resultado: con una inflación de ${pct(inf)} mensual conviene ${mejor.nombre}: sus cuotas valen ${money(mejor.real)} en pesos de hoy, contra ${money(otraOf.real)} de la otra.${coincide ? ' También tiene el menor costo efectivo anual.' : ` Ojo: ${otraOf.nombre} tiene menor costo efectivo anual (${pct(otraOf.tea)} contra ${pct(mejor.tea)}), pero por su plazo te cuesta más en pesos de hoy.`}`
      : `Resultado: el costo efectivo anual de esta oferta es ${pct(o.tea)} (${pct(o.i)} por mes).`,
    `Monto recibido en mano: ${money(x.capital)}. Inflación mensual supuesta: ${pct(inf)}.`
  ];
  for (const f of ofertas) {
    lines.push(`--- ${f.nombre.replace(/^la /, '').toUpperCase()}: ${f.n} CUOTAS DE ${money(f.cuota)} ---`,
      `- Total a pagar: ${money(f.total)}. Pagás ${money(f.total - x.capital)} más de lo que recibís (${pct(f.total / x.capital - 1)}).`,
      `- Tasa mensual efectiva: ${pct(f.i)}. Tasa nominal anual equivalente: ${pct(f.tna)}.`,
      `- Costo efectivo anual (con todos los cargos que ya están en la cuota): ${pct(f.tea)}.`,
      `- Las cuotas, medidas en pesos de hoy con la inflación supuesta, valen ${money(f.real)}: ${f.real < x.capital ? `${money(x.capital - f.real)} menos de lo que recibís. Con esa inflación, el crédito te sale más barato que no tenerlo` : `${money(f.real - x.capital)} más de lo que recibís`}.`,
      `- Tasa real mensual (descontada la inflación): ${pct(f.tasaReal)}${f.tasaReal < 0 ? ', negativa: la inflación licúa la deuda' : ''}.`);
  }
  if (mejor) {
    const otra = mejor === ofertas[0] ? ofertas[1] : ofertas[0];
    lines.push('--- COMPARACIÓN ---',
      `- En pesos de hoy, con la inflación que ingresaste, conviene ${mejor.nombre}.`,
      `- Por costo efectivo anual, la más barata es ${coincide ? mejor.nombre : otraOf.nombre}.${coincide ? '' : ' Si esperás que la inflación sea más alta, la oferta más larga gana terreno; si esperás que baje, conviene mirar la de menor costo efectivo.'}`,
      `- En pesos de hoy, ${mejor.nombre} te cuesta ${money(Math.abs(otra.real - mejor.real))} ${otra.real >= mejor.real ? 'menos' : 'más'} que la otra.${otra.real < mejor.real ? ' Pasa cuando una oferta tiene más cuotas: con inflación, pagar más tarde pesa menos. Si la inflación baja, esta ventaja se achica.' : ''}`,
      `- Diferencia en el total nominal: ${money(Math.abs(ofertas[0].total - ofertas[1].total))}. El total nominal solo sirve para comparar ofertas del mismo plazo.`);
  }
  lines.push('--- ANTES DE FIRMAR ---',
    '- Pedí el CFT (costo financiero total) con IVA: es obligatorio que la entidad lo informe y tiene que parecerse al costo efectivo de este informe. Si es mucho menor, hay cargos que no te mostraron.',
    '- Confirmá si la cuota es fija o si se ajusta (UVA, CER u otra): este cálculo vale para cuota fija en pesos.',
    '- Preguntá cuánto cuesta cancelar antes: la ley permite la precancelación, y después de un cuarto del plazo (o 180 días) no pueden cobrarte comisión.',
    '- Si comparás con otras entidades, el BCRA publica las tasas y el CFT de préstamos personales de cada banco.',
    'Cálculo financiero con los datos que ingresaste. No es una recomendación de endeudarte ni reemplaza el asesoramiento financiero profesional.');
  return lines;
}

export function creditoTeaser(lines) {
  const two = lines.some(l => l.startsWith('--- COMPARACIÓN'));
  return {
    facts: [[two ? '¿Cuál conviene?' : 'Costo efectivo anual', 'En el informe'], ['Datos analizados', two ? '2 ofertas' : '1 oferta']],
    includes: ['El costo efectivo anual real, con todos los cargos de la cuota', two ? 'Cuál de las dos ofertas conviene y por cuánto' : 'Cuánto pagás de más sobre lo que recibís', 'Cuánto valen las cuotas en pesos de hoy con la inflación', 'Qué preguntar antes de firmar']
  };
}
