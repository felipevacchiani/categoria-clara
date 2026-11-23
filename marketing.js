import { extra, enrich } from './guias.js';
// Contenido comercial de las páginas públicas. Solo los servicios listados acá se muestran en el sitio.
export const pitch = {
  'consumo-defensa': {
    title: 'Reclamo a una empresa',
    tagline: 'Para cobros que no reconocés, bajas que no procesan, compras que no llegaron o productos con fallas.',
    placeholders: {
      empresa: 'Ej.: tu compañía de telefonía, banco o tienda online',
      hechos: 'Ej.: El 1/10 pedí la baja por la app. Me siguen facturando y reclamé dos veces por chat sin solución.',
      pedido: 'Ej.: la baja inmediata y la devolución de lo facturado desde el 1/10'
    }
  },
  'envio-reclamo': {
    title: 'Reclamo por un envío',
    tagline: 'Para pedidos que no llegaron, llegaron tarde, dañados o con un producto distinto.',
    placeholders: {
      empresa: 'Ej.: la tienda donde compraste o el correo',
      hechos: 'Ej.: Compré una heladera el 30/10 con entrega prometida el 5/11. El seguimiento sigue "en preparación".',
      pedido: 'Ej.: la entrega en 48 horas o la devolución de lo pagado'
    }
  },
  'vuelo-reclamo': {
    title: 'Reclamo a una aerolínea',
    tagline: 'Para vuelos cancelados o demorados, equipaje dañado o perdido, embarque denegado o reintegros pendientes.',
    placeholders: {
      empresa: 'Ej.: la aerolínea con la que volaste',
      vuelo: 'Ej.: AR1500',
      ruta: 'Ej.: Córdoba - Ezeiza',
      hechos: 'Ej.: El vuelo se canceló dos horas antes de salir. No ofrecieron reubicación ni comida.',
      pedido: 'Ej.: el reintegro del pasaje y de los gastos de hotel'
    }
  }
};

const reclamosIncludes = [
  'Nota formal adaptada a tu tipo de caso, lista para firmar y enviar',
  'La normativa argentina que aplica a tu reclamo',
  'Las pruebas que tenés que juntar y adjuntar',
  'Fecha límite de respuesta y a qué organismo escalarlo si no contestan',
  'PDF prolijo para imprimir, adjuntar a un mail o subir a un formulario'
];

const reclamosSteps = [
  ['Contanos qué pasó', 'Elegís el tipo de problema y completás la empresa, las fechas y los hechos. No te pedimos DNI.'],
  ['Mirá la vista previa', 'Ves gratis a quién va dirigido, el asunto y la fecha límite de respuesta antes de pagar.'],
  ['Pagá y descargá', 'Dejás tu correo, pagás con Mercado Pago y descargás el PDF al instante. Sin crear cuenta.']
];

const reclamosFaq = [
  ['¿Esto reemplaza a un abogado?', 'No. Te ayudamos a armar un reclamo claro y bien fundado para que lo presentes vos. Si tu caso implica montos importantes o un juicio, consultá a un profesional.'],
  ['¿Ustedes presentan el reclamo?', 'No. Te damos la nota lista y te indicamos dónde y cómo enviarla. El reclamo sale a tu nombre.'],
  ['¿Qué pasa si la empresa no responde?', 'La nota fija una fecha límite. Si vence sin respuesta, el PDF te indica a qué organismo escalarlo y qué tenés que presentar.'],
  ['¿Qué datos me piden?', 'Solo qué pasó, las fechas y la empresa. Tu nombre y DNI los completás vos en la nota antes de enviarla.'],
  ['¿Tengo que crear una cuenta?', 'No. Dejás tu correo y pagás con Mercado Pago. Descargás el PDF apenas se acredita el pago y te llega un enlace privado por correo para volver a bajarlo.']
];

// Páginas por tipo de caso (/reclamos/<path>): título, introducción y servicio/tipo preseleccionado.
const reclamosCases = [
  {path:'cobro-indebido',service:'consumo-defensa',tipo:'cobro',title:'Te cobraron algo que no reconocés',intro:'Si te facturaron un cargo que no contrataste o un importe distinto del acordado, podés reclamar la anulación y el reintegro. Armá la nota con la normativa que aplica y una fecha límite para que te respondan.'},
  {path:'compra-no-entregada',service:'consumo-defensa',tipo:'incumplimiento',title:'Pagaste y no te dieron lo que compraste',intro:'Cuando una empresa no cumple lo que ofreció, la ley te deja elegir: exigir el cumplimiento, aceptar algo equivalente o rescindir y que te devuelvan lo pagado.'},
  {path:'no-me-dan-la-baja',service:'consumo-defensa',tipo:'baja',title:'No te dan de baja un servicio',intro:'Si pediste la baja y te siguen facturando, podés exigir que se procese desde tu primera solicitud y que te devuelvan lo cobrado después. Si contrataste online o por teléfono, la baja se puede pedir por el mismo medio.'},
  {path:'producto-con-falla-garantia',service:'consumo-defensa',tipo:'garantia',title:'Tu producto vino con una falla',intro:'Los productos tienen garantía legal y responden en conjunto el fabricante, el importador y el vendedor. Si la reparación no funciona, podés pedir el cambio o la devolución.'},
  {path:'arrepentimiento-compra-online',service:'consumo-defensa',tipo:'arrepentimiento',title:'Te arrepentiste de una compra online',intro:'En compras online o a distancia tenés 10 días corridos para arrepentirte, contados desde la entrega o la compra, lo último que ocurra. Los gastos de devolución corren por cuenta del vendedor.'},
  {path:'pedido-no-llego',service:'envio-reclamo',tipo:'no_entregado',title:'Tu pedido nunca llegó',intro:'Si pagaste y el pedido no llegó, podés exigir la entrega o la devolución de lo pagado. La nota deja constancia de la fecha prometida y te indica cómo escalar el reclamo.'},
  {path:'envio-demorado',service:'envio-reclamo',tipo:'demora',title:'Tu envío está demorado',intro:'El plazo de entrega que te informaron es parte de la oferta. Si no se cumple, podés pedir una fecha cierta o la devolución de lo pagado, más el costo del envío.'},
  {path:'envio-llego-danado',service:'envio-reclamo',tipo:'danado',title:'Tu pedido llegó dañado o incompleto',intro:'Si el producto llegó roto o le faltan partes, podés pedir el reemplazo o la devolución. Sacá fotos del paquete y del producto apenas lo recibas.'},
  {path:'llego-otro-producto',service:'envio-reclamo',tipo:'equivocado',title:'Te llegó un producto distinto',intro:'Si recibiste algo diferente de lo que compraste, podés exigir el producto correcto con el retiro sin cargo del que llegó, o la devolución de lo pagado.'},
  {path:'vuelo-cancelado',service:'vuelo-reclamo',tipo:'cancelacion',title:'Te cancelaron el vuelo',intro:'Ante una cancelación, la aerolínea debe ofrecerte alternativas: reubicación, endoso a otra aerolínea o reintegro del pasaje. Armá el reclamo con el reglamento vigente y los pasos para llegar a la ANAC.'},
  {path:'vuelo-demorado',service:'vuelo-reclamo',tipo:'demora',title:'Tu vuelo se demoró',intro:'Durante una demora, la aerolínea tiene obligaciones de asistencia. Reclamá los gastos que tuviste y dejá constancia escrita de lo que pasó.'},
  {path:'equipaje-perdido-o-danado',service:'vuelo-reclamo',tipo:'equipaje',title:'Tu equipaje se perdió, se demoró o llegó dañado',intro:'En vuelos internacionales los plazos para protestar son cortos: 7 días por daño y 21 por demora. Armá el reclamo a tiempo y con las pruebas correctas.'},
  {path:'me-negaron-el-embarque',service:'vuelo-reclamo',tipo:'denegacion',title:'Te negaron el embarque',intro:'Si tenías reserva y check-in y no te dejaron subir, podés pedir la reubicación o el reintegro, más los gastos que te ocasionó.'},
  {path:'reintegro-pasaje-aereo',service:'vuelo-reclamo',tipo:'reintegro',title:'No te devuelven la plata del pasaje',intro:'Si te corresponde un reintegro y la aerolínea no lo paga, reclamalo por escrito con fecha límite y, si no responde, escalalo a la ANAC.'}
];

for (const slug of ['consumo-defensa', 'envio-reclamo', 'vuelo-reclamo']) Object.assign(pitch[slug], {
  includes: reclamosIncludes, steps: reclamosSteps, faq: reclamosFaq,
  mock: ['Nota de reclamo', 'Encuadre normativo', 'Pruebas para adjuntar', 'Próximos pasos']
});

// ---- MonotributoCheck: servicio activo del sitio ----
pitch.monotributocheck = {
  title: 'Recategorización del Monotributo',
  tagline: 'Sabé si te tenés que recategorizar antes del 5 de febrero, en qué categoría quedás y cuánto podés facturar en diciembre.',
  placeholders: { ingresos: 'Ej.: 22.000.000', diciembre: 'Ej.: 2.000.000', superficie: 'Ej.: 30', energia: 'Ej.: 3.300', alquileres: 'Ej.: 2.400.000', precio: 'Ej.: 150.000' },
  includes: [
    'Tu categoría exacta, analizada parámetro por parámetro',
    'La cuota nueva y cuánto cambia en el semestre',
    'Cuánto podés facturar en diciembre sin pasarte de categoría',
    'Alertas: exclusión del régimen, cobros sin facturar y recategorización de oficio',
    'El paso a paso para hacer el trámite en ARCA, en un PDF para guardar o pasarle a tu contador',
    'Además: acceso al portal Mi facturación para gestionar tu Monotributo todo el año (cargá tus facturas y seguí tu categoría en tiempo real)'
  ],
  steps: [
    ['Cargá tus números', 'Lo que facturaste en el año, lo que pensás facturar en diciembre y, si tenés local, superficie, luz y alquiler.'],
    ['Mirá el resultado gratis', 'Te decimos al instante si tenés que recategorizarte y hasta cuándo.'],
    ['Pagá y descargá el informe', 'Dejás tu correo, pagás con Mercado Pago y descargás el PDF al instante. Sin crear cuenta.']
  ],
  faq: [
    ['¿Quién tiene que recategorizarse?', 'Quien, según lo facturado en los últimos 12 meses y los demás parámetros, quede en una categoría distinta de la actual. Si tu categoría no cambia, no tenés que hacer nada.'],
    ['¿Hasta cuándo hay tiempo?', 'La próxima recategorización vence el 5 de febrero de 2027 y toma lo facturado de enero a diciembre de 2026.'],
    ['¿Qué tabla usan?', 'La tabla oficial de ARCA vigente. En enero ARCA la actualiza por inflación: cuando se publique, el informe se recalcula con los valores nuevos.'],
    ['¿Me sirve si ARCA ya me recategorizó de oficio?', 'Sí: el informe te muestra qué categoría te corresponde con tus datos, para que puedas reclamar si ARCA se equivocó.'],
    ['¿Tengo que crear una cuenta o dar mi clave fiscal?', 'No. Solo cargás tus números y tu correo. Nunca te pedimos clave fiscal.']
  ],
  mock: ['Resultado', 'Tu categoría por parámetro', 'Cuota mensual', 'Cuánto podés facturar', 'Paso a paso']
};

export const site = {
  service: 'monotributocheck',
  eyebrow: 'Monotributo · Recategorización febrero 2027',
  title: '¿Te tenés que recategorizar? Sabelo en 2 minutos.',
  lead: 'Cargá lo que facturaste y te decimos al instante si cambiás de categoría. El informe completo te dice cuánto vas a pagar, cuánto podés facturar en diciembre y cómo hacer el trámite.',
  cta: 'Calcular mi categoría',
  trust: ['Tabla oficial de ARCA vigente', 'Sin clave fiscal ni cuenta', 'Resultado gratis al instante'],
  description: 'Calculá tu recategorización del Monotributo con la tabla oficial de ARCA: categoría, cuota, cuánto podés facturar en diciembre y paso a paso.'
};

const baseCases = [
  ...reclamosCases,
  { path: 'como-hacer-factura-c-arca', service: 'monotributocheck', title: 'Cómo hacer una factura C en ARCA, paso a paso', intro: 'Como monotributista emitís Factura C electrónica desde «Comprobantes en línea» o desde la app Facturador de ARCA. La primera vez tenés que habilitar un punto de venta; después, cada factura lleva un par de minutos.', points: ['Necesitás clave fiscal nivel 3 y los servicios «Comprobantes en línea» y «Administración de puntos de venta y domicilios».', 'Si te equivocaste, no se borra: se anula con una nota de crédito C por el mismo importe.', 'Cada factura suma a tus ingresos del año: cargala también en Mi facturación para ver cómo venís con tu categoría.'], steps: [
    ['Primera vez: habilitá los servicios', 'En ARCA, con tu clave fiscal, entrá al «Administrador de Relaciones de Clave Fiscal» → «Adherir servicio» y sumá «Comprobantes en línea» y «Administración de puntos de venta y domicilios».'],
    ['Primera vez: creá el punto de venta', 'En «Administración de puntos de venta y domicilios» elegí tu nombre → «A/B/M de Puntos de venta» → «Agregar». Usá un número nuevo (por ejemplo 2) y el sistema de factura electrónica en línea para Monotributo.'],
    ['Entrá a Comprobantes en línea', 'Ingresá a arca.gob.ar con CUIT y clave fiscal, abrí «Comprobantes en línea» y elegí tu nombre.'],
    ['Generar comprobantes', 'Elegí el punto de venta y el tipo «Factura C». Continuá.'],
    ['Datos de emisión', 'Fecha del comprobante y concepto: Productos, Servicios o ambos. Si son servicios, indicá el período facturado y el vencimiento de pago.'],
    ['Datos del receptor', 'Condición frente al IVA del cliente (Consumidor Final, Responsable Inscripto, Monotributo, Exento), su CUIT o DNI si corresponde y la condición de venta (contado, transferencia, tarjeta, etc.).'],
    ['Datos de la operación', 'Descripción de lo que vendés o del servicio, cantidad, unidad y precio unitario. Revisá el importe total.'],
    ['Confirmá y descargá', 'En el resumen controlá todo y tocá «Confirmar datos». El comprobante queda con su CAE: descargá el PDF y mandáselo a tu cliente.']
  ] },
  { path: 'como-recategorizarse-en-arca-paso-a-paso', service: 'monotributocheck', title: 'Cómo recategorizarte en ARCA, paso a paso', intro: 'El trámite se hace online con tu clave fiscal y lleva unos 10 minutos. Antes de empezar, calculá qué categoría te corresponde: si no cambia, no tenés que hacer nada.', points: ['El plazo vence el 5 de febrero de 2027.', 'Se toma lo facturado de enero a diciembre de 2026, más superficie, luz y alquileres si tenés local.', 'Si no te recategorizás y correspondía, ARCA puede hacerlo de oficio y aplicar multas.'], steps: [
    ['Calculá tu categoría', 'Sumá lo facturado de enero a diciembre de 2026 y, si tenés local, superficie, kWh de luz y alquileres. La categoría la define el parámetro más alto. Si es la misma que tenés, terminaste.'],
    ['Entrá a ARCA', 'Ingresá a arca.gob.ar con tu CUIT y clave fiscal (nivel 2 o superior).'],
    ['Abrí el Portal Monotributo', 'En tus servicios elegí «Monotributo». Si no aparece, adherilo desde el Administrador de Relaciones de Clave Fiscal.'],
    ['Elegí «Recategorizarme»', 'Está en el menú principal del Portal Monotributo, disponible hasta el vencimiento.'],
    ['Cargá los datos', 'Confirmá los ingresos brutos de los últimos 12 meses y, si corresponde, superficie, energía eléctrica y alquileres. ARCA puede traer valores precargados: revisalos.'],
    ['Revisá y confirmá', 'El sistema te muestra la nueva categoría y la cuota. Si coincide con tu cálculo, confirmá.'],
    ['Guardá el comprobante', 'Descargá la constancia de la recategorización y la nueva credencial de pago. La cuota nueva se paga desde el período febrero.']
  ] },
  { path: 'recategorizacion-monotributo-febrero-2027', service: 'monotributocheck', title: 'Recategorización del Monotributo: febrero 2027', intro: 'La recategorización vence el 5 de febrero de 2027 y toma lo facturado de enero a diciembre de 2026. Calculá si cambiás de categoría y cuánto vas a pagar.', points: ['Se analiza lo facturado en los últimos 12 meses y, si tenés local, superficie, energía y alquileres.', 'La categoría la define el parámetro más alto.', 'Si tu categoría no cambia, no tenés que hacer ningún trámite.'] },
  { path: 'cuanto-puedo-facturar-en-diciembre-monotributo', service: 'monotributocheck', title: '¿Cuánto podés facturar en diciembre sin cambiar de categoría?', intro: 'Diciembre cierra el año que ARCA mira para la recategorización de febrero. Calculá cuánto margen te queda antes del tope de tu categoría.', points: ['El margen es el tope anual de tu categoría menos lo facturado de enero a noviembre.', 'Los topes se actualizan por inflación en enero: el margen real suele ser algo mayor.', 'Si te pasás, la recategorización es obligatoria.'] },
  { path: 'me-recategorizaron-de-oficio', service: 'monotributocheck', title: 'ARCA te recategorizó de oficio', intro: 'Si ARCA te cambió de categoría y creés que se equivocó, primero confirmá qué categoría te corresponde con tus números reales.', points: ['ARCA cruza datos de cobros en cuentas y billeteras para recategorizar de oficio.', 'Podés reclamar desde el Portal Monotributo con la documentación que respalde tus ingresos.', 'El informe te deja por escrito la categoría que te corresponde y por qué.'] },
  { path: 'exclusion-del-monotributo', service: 'monotributocheck', title: '¿Te pueden excluir del Monotributo?', intro: 'Si superás el tope de la categoría K, o algún otro parámetro máximo, quedás fuera del régimen y pasás a IVA y Ganancias. Revisá tu situación antes de que lo haga ARCA.', points: ['El tope máximo de ingresos es el de la categoría K.', 'En venta de productos también hay un precio unitario máximo.', 'Superficie, energía y alquileres también tienen máximos.'] },
  { path: 'categorias-monotributo-cuota-mensual', service: 'monotributocheck', title: 'Categorías del Monotributo y cuánto se paga por mes', intro: 'Cada categoría tiene un tope de facturación y una cuota mensual que incluye impuesto, jubilación y obra social. Calculá la tuya con tus números.', points: ['Hay 11 categorías, de la A a la K.', 'La cuota cambia según si prestás servicios o vendés productos.', 'ARCA actualiza los topes y las cuotas dos veces por año por inflación.'] }
];
export const cases = [...baseCases, ...extra].map(c => enrich[c.path] ? { ...c, ...enrich[c.path] } : c);
