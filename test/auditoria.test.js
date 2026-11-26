// Regresiones de la auditoría del 25/11/2026: bordes legales y cálculos corregidos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLiquidacion, liquidacionTeaser } from '../laboral.js';
import { evaluateGanancias, TABLA } from '../ganancias.js';
import { evaluateCredito, tasaMensual } from '../credito.js';
import { evaluateAlquiler } from '../alquiler.js';
import { setIndices } from '../indices.js';

const liq = v => evaluateLiquidacion({ motivo: 'sin_causa', sueldo: 1000000, variable: 'no', promVariable: 0, promOcasional: 0, tomadas: 0, preaviso: 'no', tope: 'no', cobrado: 'no', pagado: 0, ...v }).join('\n');

test('Art. 150 LCT: exactamente 5, 10 y 20 años al 31/12 no superan el tramo', () => {
  // Ingreso 1/1/2021: al 31/12/2025 cumple exactamente 5 años -> 14 días. Egreso en 2025.
  assert.match(liq({ ingreso: '2021-01-01', egreso: '2025-12-31' }), /14 por año/);
  // Un día más de antigüedad (ingreso 31/12/2020) ya supera 5 años -> 21 días.
  assert.match(liq({ ingreso: '2020-12-31', egreso: '2025-12-31' }), /21 por año/);
  assert.match(liq({ ingreso: '2016-01-01', egreso: '2025-06-30' }), /21 por año/); // 10 años exactos al 31/12/2025
  assert.match(liq({ ingreso: '2006-01-01', egreso: '2025-06-30' }), /28 por año/); // 20 años exactos
  assert.match(liq({ ingreso: '2005-12-31', egreso: '2025-06-30' }), /35 por año/);
  // 5 años y 3 meses: supera 5 -> 21 (un "anios <= 5" lo dejaría mal en 14).
  assert.match(liq({ ingreso: '2020-09-01', egreso: '2025-12-31' }), /21 por año/);
});

test('Art. 231 LCT: preaviso de dos meses solo con más de 5 años', () => {
  assert.match(liq({ ingreso: '2021-01-01', egreso: '2025-12-31' }), /1 mes de sueldo \(hasta de 5 años/);
  assert.match(liq({ ingreso: '2020-12-31', egreso: '2025-12-31' }), /2 meses de sueldo/);
  assert.match(liq({ ingreso: '2020-12-15', egreso: '2026-01-10' }), /2 meses de sueldo/); // 5 años y 26 días
});

test('Ganancias: valores de la liquidación anual 2026 y deducción adicional de un doceavo', () => {
  assert.equal(TABLA.gni, 6019671.36);
  assert.equal(TABLA.especial, 28894422.56);
  const t = evaluateGanancias({ sueldo: 5000000, hijos: 0, conyuge: 'no', hijos50: 'no', alquiler: 0, domestico: 0, prepaga: 0 }).join('\n');
  assert.match(t, /doceavo \$\s2\.909\.507,83/);
  assert.match(t, /pagás \$\s2\.199\.342,81 de Ganancias/);
  // Tope de alquiler: 40% con tope en el mínimo no imponible anual.
  const a = evaluateGanancias({ sueldo: 5000000, hijos: 0, conyuge: 'no', hijos50: 'no', alquiler: 2000000, domestico: 0, prepaga: 0 }).join('\n');
  assert.match(a, /alquiler \$\s6\.019\.671,36/);
});

test('CréditoCheck: tasa negativa y comparación en pesos de hoy', () => {
  const i = tasaMensual(1000000, 80000, 12);
  assert.ok(i < 0 && i > -0.01, `tasa ${i}`);
  const t = evaluateCredito({ capital: 1000000, cuotaA: 110000, plazoA: 12, comparar: 'si', cuotaB: 52000, plazoB: 36, inflacion: 1 }).join('\n');
  assert.match(t, /^Resultado: con una inflación de 1,00% mensual conviene la oferta A/);
  assert.match(t, /la oferta B tiene menor costo efectivo anual/);
  // Si la oferta más barata en pesos de hoy también tiene menor tasa, no hay advertencia.
  const u = evaluateCredito({ capital: 1000000, cuotaA: 100000, plazoA: 12, comparar: 'si', cuotaB: 105000, plazoB: 12, inflacion: 2 }).join('\n');
  assert.match(u, /conviene la oferta A[^\n]*También tiene el menor costo efectivo anual/);
});

test('AlquilerClaro: ajuste ICL posterior al último dato se proyecta, no se congela', () => {
  setIndices({ icl: [['2026-06-01', 33.5], ['2026-08-25', 36.0], ['2026-11-23', 38.0]], ipc: [] });
  const t = evaluateAlquiler({ monto: 100000, indice: 'icl', periodo: '6', desde: '2026-06-01' }, '2026-11-25').join('\n');
  assert.match(t, /estimado/);
  assert.match(t, /ICL proyectado al 01\/12\/2026/);
  const pct = Number(t.match(/aumento del ([\d,]+)%/)[1].replace(',', '.'));
  assert.ok(pct > (38 / 33.5 - 1) * 100, `aumento ${pct}% debería superar al del último dato`);
});

test('Liquidación: adicionales variables y comparación con lo cobrado', () => {
  const base = { ingreso: '2019-03-10', egreso: '2026-11-20', sueldo: 1500000 };
  // Habituales: entran en la base del art. 245 (8 períodos x 1.800.000).
  const h = liq({ ...base, variable: 'habitual', promVariable: 300000 });
  assert.match(h, /art\. 245\): \$\s14\.400\.000,00/);
  assert.match(h, /preaviso: \$\s3\.600\.000,00/);
  // Ocasionales: suman al preaviso pero no a la base del art. 245 (8 x 1.500.000).
  const o = liq({ ...base, variable: 'ocasional', promOcasional: 300000 });
  assert.match(o, /art\. 245\): \$\s12\.000\.000,00/);
  assert.match(o, /preaviso: \$\s3\.600\.000,00/);
  assert.throws(() => liq({ ...base, variable: 'habitual', promVariable: 0 }), /promedio mensual/);
  // Comparación: a favor, en contra y coincidente.
  const lines = v => evaluateLiquidacion({ motivo: 'sin_causa', sueldo: 1500000, variable: 'no', tomadas: 0, preaviso: 'no', tope: 'no', ...base, ...v });
  const neto = Number(lines({ cobrado: 'no' })[0].match(/de \$\s([\d.,]+) en mano/)[1].replace(/\./g, '').replace(',', '.'));
  const menos = lines({ cobrado: 'si', pagado: neto - 2000000 });
  assert.match(menos[0], /te habrían pagado \$\s2\.000\.000,00 de menos/);
  assert.match(menos.join('\n'), /art\. 260 LCT/);
  assert.deepEqual(liquidacionTeaser(menos).facts[0], ['Comparación con lo que cobraste', 'Hay una diferencia a tu favor']); // sin rango: dejaría deducir la diferencia
  assert.doesNotMatch(JSON.stringify(liquidacionTeaser(menos)), /2\.000\.000/);
  assert.match(lines({ cobrado: 'si', pagado: neto - 1000 })[0], /coincide/);
  assert.match(lines({ cobrado: 'si', pagado: neto + 2000000 })[0], /cobraste \$\s2\.000\.000,00 más/);
  assert.match(liquidacionTeaser(lines({ cobrado: 'no' })).facts[1][1], /^9: /);
  assert.throws(() => lines({ cobrado: 'si', pagado: 0 }), /total que te pagaron/);
});
