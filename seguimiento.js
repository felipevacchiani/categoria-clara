// Mi facturación como producto: acceso por 12 meses al portal de facturación del Monotributo, con avisos por correo.
// No es un cálculo de una vez: lleva la facturación real del año y avisa cuando hace falta (tope y recategorización).
import { TABLE, RECATEGORIZACION, ACTIVIDAD, CATEGORIAS } from './monotributo.js';
import { choice } from './reclamos.js';

const money = n => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = iso => iso.split('-').reverse().join('/');
const fail = message => { const e = Error(message); e.status = 422; throw e; };

export const seguimientoFields = num => [
  choice('actividad', '¿A qué te dedicás?', ACTIVIDAD),
  choice('categoria', 'Tu categoría actual', CATEGORIAS),
  { ...num('facturado', 'Lo que facturaste en los últimos 12 meses'), unit: 'pesos', hint: 'Una estimación alcanza: después cargás tus facturas en el portal.' }
];

// Estado actual frente al tope de la categoría y a qué ritmo se acerca.
export function estadoTope(categoria, facturado) {
  const c = TABLE.categorias.find(x => x.cat === categoria);
  if (!c) fail('Elegí tu categoría actual.');
  const pct = facturado / c.ingresos;
  const resto = c.ingresos - facturado;
  const meses = facturado > 0 && resto > 0 ? resto / (facturado / 12) : null;
  return { c, pct, resto, meses };
}

export function evaluateSeguimiento(x) {
  if (!(x.facturado >= 0)) fail('Ingresá lo que facturaste en los últimos 12 meses.');
  const { c, pct, resto, meses } = estadoTope(x.categoria, x.facturado);
  const p = Math.round(pct * 100);
  return [
    resto >= 0
      ? `Resultado: usaste el ${p}% del tope de la categoría ${c.cat}: te quedan ${money(resto)} para facturar antes de pasarte.`
      : `Resultado: te pasaste ${money(-resto)} del tope de la categoría ${c.cat}: en la próxima recategorización vas a subir.`,
    `- Tope de la categoría ${c.cat}: ${money(c.ingresos)} en 12 meses (tabla de ARCA vigente desde ${fmt(TABLE.vigencia)}).`,
    ...(meses != null ? [`- Al ritmo actual, llegás al tope en unos ${meses < 1 ? 'menos de 1 mes' : Math.round(meses) + ' meses'}.`] : []),
    `- Próxima recategorización: vence el ${fmt(RECATEGORIZACION.vence)} y mira ${RECATEGORIZACION.periodo}.`,
    '--- QUÉ INCLUYE MI FACTURACIÓN (12 MESES) ---',
    '- Cargás tus facturas y notas de crédito una por una o importás el archivo de Mis Comprobantes de ARCA, y ves en todo momento cuánto facturaste en los últimos 12 meses.',
    '- La categoría que te corresponde y cuánto te falta para el tope, siempre con la tabla vigente de ARCA.',
    '- Te avisamos por correo cuando llegás al 80% y al 100% del tope de tu categoría.',
    '- Te avisamos antes de cada recategorización (febrero y agosto), con lo que facturaste en el período que mira ARCA.',
    'Herramienta de seguimiento basada en los datos que cargás. No reemplaza el análisis de tu situación completa por un contador.'
  ];
}

export function seguimientoTeaser(lines) {
  const r = lines[0].slice(11);
  const pct = r.match(/usaste el (\d+)%/)?.[1];
  return {
    facts: [['Tope usado', pct ? `${pct}% de tu categoría` : 'Te pasaste del tope'], ['Próxima recategorización', fmt(RECATEGORIZACION.vence)]],
    cta: 'Activar Mi facturación por 12 meses',
    includes: ['Tu facturación de los últimos 12 meses, siempre al día', 'Aviso por correo al 80% y al 100% del tope', 'Aviso antes de cada recategorización, con lo facturado en el período', 'La categoría que te corresponde con la tabla vigente de ARCA']
  };
}
