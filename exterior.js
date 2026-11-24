// Compras al exterior: costo final de una compra por courier o correo con el régimen del Decreto 604/2026.
// Herramienta gratuita. Solo caracteres Latin-1 en las líneas (el PDF usa WinAnsi).
import { choice } from './reclamos.js';

export const REGIMEN = { id: 'Decreto 604/2026 (julio 2026)', franquicia: 400, envios: 5, tope: 3000, tasa: 0.03, iva: 0.21 };
const usd = v => 'US$ ' + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const money = v => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v).replace(/ /g, ' ');
const fail = m => { throw new Error(m); };

const ARANCEL = {
  a0: { label: 'Notebooks, tablets, e-readers y computación (0%)', rate: 0 },
  a20: { label: 'Ropa, calzado y accesorios de vestir (20%)', rate: 0.2 },
  a16: { label: 'Electrónica en general: auriculares, relojes, parlantes (16%, estimado)', rate: 0.16 },
  a35: { label: 'Juguetes y otros productos con arancel máximo (35%)', rate: 0.35 }
};
const CUPO = { si: { label: 'Sí, es uno de mis primeros 5 envíos del año' }, no: { label: 'No, ya usé los 5 envíos con franquicia' } };

export const exteriorFields = num => [
  { ...num('precio', 'Precio de los productos'), unit: 'US$', hint: 'El total de los productos del pedido, sin el envío.' },
  { ...num('envio', 'Costo del envío que te cobra la tienda'), unit: 'US$', hint: 'Si el envío es gratis, poné 0.' },
  choice('arancel', '¿Qué estás comprando?', ARANCEL),
  choice('cupo', '¿Te queda franquicia este año?', CUPO),
  { ...num('cambio', 'Cotización del dólar que vas a pagar'), unit: 'pesos', hint: 'La del dólar tarjeta o la que te cobre la tienda.' }
];

export function evaluateExterior(x) {
  if (!(x.precio > 0)) fail('Ingresá el precio de los productos.');
  if (x.precio > REGIMEN.tope) fail(`El régimen de pequeños envíos admite hasta ${usd(REGIMEN.tope)} por envío. Por encima, es una importación general con despachante.`);
  if (!(x.cambio > 0)) fail('Ingresá la cotización del dólar.');
  const rate = ARANCEL[x.arancel].rate;
  const franq = x.cupo === 'si' ? Math.min(x.precio, REGIMEN.franquicia) : 0;
  const exced = x.precio - franq;
  const derechos = exced * rate;
  const tasa = exced * REGIMEN.tasa;
  const iva = (x.precio + derechos + tasa) * REGIMEN.iva;
  const tributos = derechos + tasa + iva;
  const total = x.precio + x.envio + tributos;
  const lines = [
    `Resultado: tu compra te cuesta ${money(total * x.cambio)} en total (${usd(total)}), de los cuales ${money(tributos * x.cambio)} son impuestos.`,
    `Régimen de pequeños envíos, ${REGIMEN.id}: franquicia de ${usd(REGIMEN.franquicia)} por envío, ${REGIMEN.envios} envíos por año, hasta ${usd(REGIMEN.tope)} por envío.`,
    '--- DETALLE ---',
    `- Productos: ${usd(x.precio)}. Envío: ${usd(x.envio)}.`,
    franq ? `- Primeros ${usd(franq)}: sin derechos de importación ni tasa de estadística (franquicia).` : '- Sin franquicia: todo el valor paga derechos y tasa de estadística.',
    ...(exced > 0 ? [`- Excedente de ${usd(exced)}: derecho de importación ${Math.round(rate * 100)}% (${usd(derechos)}) y tasa de estadística 3% (${usd(tasa)}).`] : []),
    `- IVA 21% sobre el valor de los productos más los derechos: ${usd(iva)}.`,
    `- Total de impuestos: ${usd(tributos)} (${money(tributos * x.cambio)}).`,
    `- Total con envío: ${usd(total)} (${money(total * x.cambio)}).`,
    '--- PARA PAGAR MENOS ---',
    ...(x.precio > REGIMEN.franquicia && x.cupo === 'si' ? [`- Si dividís el pedido en envíos de hasta ${usd(REGIMEN.franquicia)}, cada uno paga solo IVA (mientras te queden envíos con franquicia).`] : []),
    '- La franquicia es por persona y por año calendario: los envíos de otra persona de tu casa tienen su propio cupo.',
    '- Máximo 3 unidades de la misma especie por envío y solo para uso personal.',
    '- Si pagás con tarjeta en pesos, el banco puede sumar percepciones a cuenta de Ganancias, que después se pueden recuperar.',
    `Estimación con el ${REGIMEN.id}. El derecho de importación exacto depende de la posición arancelaria de cada producto; los porcentajes son de referencia.`
  ];
  return lines;
}
