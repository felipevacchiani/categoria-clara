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


// ---- Trabajo: liquidación final (pago) y aguinaldo (gratis) ----
pitch['liquidacion-final'] = {
  title: 'Liquidación final',
  tagline: 'Si te despidieron o renunciaste, calculá todo lo que te tienen que pagar con la reforma laboral 2026: indemnización, preaviso, vacaciones y aguinaldo.',
  placeholders: { sueldo: 'Ej.: 1.500.000', tomadas: 'Ej.: 0', topeMonto: 'Ej.: 3.000.000' },
  includes: [
    'El total a cobrar en mano y el bruto',
    'Cada concepto con su importe: días trabajados, aguinaldo, vacaciones, preaviso, integración e indemnización',
    'La base de la indemnización según la Ley 27.802 (reforma laboral 2026), con tope de convenio y piso del 67%',
    'Qué controlar antes de firmar el recibo y cómo reclamar gratis si no te pagan',
    'PDF para guardar o llevar a un abogado o al sindicato'
  ],
  steps: [
    ['Cargá tu caso', 'Cómo terminó la relación, fechas de ingreso y egreso, tu sueldo y las vacaciones que te tomaste.'],
    ['Mirá qué te corresponde gratis', 'Te mostramos cuántos conceptos te tienen que pagar y el plazo de pago.'],
    ['Pagá y descargá el informe', 'Dejás tu correo, pagás con Mercado Pago y descargás el PDF con cada importe al instante.']
  ],
  faq: [
    ['¿Qué cambió con la reforma laboral?', 'Desde la Ley 27.802 (marzo 2026), la indemnización por antigüedad se calcula sobre el mejor sueldo mensual, normal y habitual, sin aguinaldo, vacaciones ni premios no mensuales. Si hay tope de convenio, la base no puede bajar del 67% del sueldo. En el período de prueba ya no corresponde preaviso.'],
    ['¿Cuánto tiempo tiene el empleador para pagar?', 'Cuatro días hábiles desde el egreso. El certificado de trabajo se entrega dentro de los 30 días.'],
    ['¿Sirve si renuncié?', 'Sí. Al renunciar no hay indemnización, pero te corresponden los días trabajados, el aguinaldo proporcional y las vacaciones no gozadas.'],
    ['¿Qué no incluye el cálculo?', 'Horas extra, comisiones variables, adicionales particulares de tu convenio y reclamos judiciales. Para esos casos, el informe te sirve de base para consultar a un abogado.'],
    ['¿Tengo que dar mis datos personales?', 'No. Solo fechas y montos. Para comprar dejás tu correo y pagás con Mercado Pago.']
  ],
  mock: ['Total a cobrar', 'Concepto por concepto', 'Indemnización art. 245', 'Antes de firmar']
};

pitch.aguinaldo = {
  title: 'Calculadora de aguinaldo',
  tagline: 'Calculá gratis cuánto cobrás de aguinaldo, en mano y en bruto, completo o proporcional a los días trabajados.',
  placeholders: { sueldo: 'Ej.: 1.200.000' },
  includes: ['El aguinaldo bruto y en mano', 'Si te corresponde completo o proporcional', 'Hasta cuándo te lo tienen que pagar'],
  steps: [
    ['Cargá tu sueldo', 'El mejor sueldo bruto del semestre y tu fecha de ingreso.'],
    ['Mirá el resultado', 'Gratis y al instante, sin dejar datos.'],
    ['¿Te fuiste del trabajo?', 'Calculá también tu liquidación final completa.']
  ],
  faq: [
    ['¿Cómo se calcula el aguinaldo?', 'Es la mitad del mejor sueldo bruto mensual del semestre. Si no trabajaste el semestre completo, se paga en proporción a los días trabajados.'],
    ['¿Cuándo se paga?', 'La primera cuota vence el 30 de junio y la segunda el 18 de diciembre, con hasta 4 días hábiles de tolerancia.'],
    ['¿El aguinaldo tiene descuentos?', 'Sí: jubilación, PAMI y obra social, un 17% en total. Si pagás Ganancias, también puede tener retención.']
  ],
  mock: ['Aguinaldo bruto', 'Descuentos', 'En mano'],
  next: ['¿Te despidieron o renunciaste?', 'Calculá todo lo que te tienen que pagar en la liquidación final: indemnización, preaviso, vacaciones y aguinaldo, con la reforma laboral 2026.', '/servicios/liquidacion-final', 'Calcular mi liquidación final']
};

const laboralCases = [
  { path: 'aguinaldo-diciembre-2026', service: 'aguinaldo', title: 'Aguinaldo de diciembre 2026: cuánto cobrás y cuándo', intro: 'El medio aguinaldo de diciembre se paga hasta el 18/12 y es la mitad del mejor sueldo bruto de julio a diciembre. Calculalo gratis con tu sueldo.',
    points: ['Es el 50% del mejor sueldo bruto del semestre, incluidas horas extra y comisiones de ese mes.', 'Si entraste después del 1 de julio, cobrás en proporción a los días trabajados.', 'Tiene los mismos descuentos que el sueldo: 17% de aportes.', 'El plazo es el 18 de diciembre, con hasta 4 días hábiles de tolerancia.'] },
  { path: 'como-calcular-liquidacion-final', service: 'liquidacion-final', title: 'Cómo calcular tu liquidación final en 2026', intro: 'La liquidación final suma todo lo que te deben al terminar el trabajo. Qué entra depende de si renunciaste, te despidieron sin causa o estabas en período de prueba.',
    points: ['Siempre: días trabajados del mes, aguinaldo proporcional y vacaciones no gozadas con su aguinaldo.', 'Despido sin causa: además preaviso (si no te avisaron), integración del mes e indemnización por antigüedad.', 'Período de prueba: desde la Ley 27.802 no corresponden preaviso, integración ni indemnización.', 'El empleador tiene 4 días hábiles para pagar.'] },
  { path: 'indemnizacion-por-despido-reforma-laboral-2026', service: 'liquidacion-final', title: 'Indemnización por despido con la reforma laboral 2026', intro: 'La Ley 27.802 mantuvo un mes de sueldo por año trabajado, pero cambió qué entra en la base. Calculá tu indemnización con las reglas vigentes.',
    points: ['Un mes de sueldo por año de servicio o fracción mayor de 3 meses, pasado el período de prueba.', 'La base es el mejor sueldo mensual, normal y habitual: sin aguinaldo, vacaciones ni premios no mensuales.', 'Si hay tope de convenio, la base no puede quedar por debajo del 67% del sueldo.', 'Nunca puede ser menor a un mes de sueldo.'] },
  { path: 'cuanto-me-corresponde-si-renuncio', service: 'liquidacion-final', title: '¿Cuánto te corresponde si renunciás?', intro: 'Al renunciar no cobrás indemnización, pero sí todo lo que generaste hasta tu último día. Calculá el total antes de firmar.',
    points: ['Días trabajados del último mes.', 'Aguinaldo proporcional del semestre.', 'Vacaciones no gozadas proporcionales, más su aguinaldo.', 'La renuncia se envía por telegrama laboral gratuito o en persona ante la autoridad laboral.'] }
];

// ---- CréditoCheck ----
pitch.creditocheck = {
  title: 'Costo real de un préstamo',
  tagline: 'Antes de sacar un préstamo personal, calculá cuánto te cuesta de verdad, compará dos ofertas y mirá cuánto valen las cuotas con la inflación.',
  placeholders: { capital: 'Ej.: 1.000.000', cuotaA: 'Ej.: 100.000', plazoA: 'Ej.: 12', cuotaB: 'Ej.: 60.000', plazoB: 'Ej.: 24', inflacion: 'Ej.: 2' },
  includes: [
    'El costo efectivo anual real, con todos los cargos que vienen dentro de la cuota',
    'Cuál de dos ofertas conviene y cuánto te ahorrás',
    'Cuánto valen las cuotas en pesos de hoy con la inflación que esperás',
    'Qué preguntar antes de firmar: CFT, cuota fija o ajustable y precancelación'
  ],
  steps: [
    ['Cargá la oferta', 'Lo que recibís en mano, la cuota y la cantidad de cuotas. Si tenés otra oferta, cargala también.'],
    ['Mirá el resultado', 'Ves gratis qué analizamos y qué incluye el informe.'],
    ['Pagá y descargá', 'Dejás tu correo, pagás con Mercado Pago y descargás el PDF al instante.']
  ],
  faq: [
    ['¿Por qué no alcanza con mirar la tasa que me dicen?', 'Porque la tasa nominal no incluye seguros, IVA ni comisiones. El costo efectivo sale de comparar lo que recibís en mano con lo que pagás de verdad.'],
    ['¿Conviene la oferta con más cuotas?', 'Depende de la tasa y de la inflación. Con inflación alta, pagar más tarde pesa menos; si la inflación baja, las cuotas largas se encarecen. El informe te muestra las dos miradas.'],
    ['¿Sirve para préstamos UVA?', 'No. El cálculo es para cuota fija en pesos.'],
    ['¿Me piden datos del banco o personales?', 'No. Solo los montos de la oferta.']
  ],
  mock: ['Costo efectivo anual', 'Comparación de ofertas', 'En pesos de hoy', 'Antes de firmar']
};

const creditoCases = [
  { path: 'como-calcular-costo-real-prestamo-personal', service: 'creditocheck', title: 'Cómo calcular el costo real de un préstamo personal', intro: 'La tasa que te muestran casi nunca es lo que pagás. Con el monto que recibís en mano y la cuota total, se calcula el costo efectivo real.',
    points: ['Usá el monto que te depositan, no el monto "otorgado": los gastos de otorgamiento suben el costo.', 'Usá la cuota total que pagás, con IVA y seguros.', 'Compará siempre el CFT con IVA: la entidad está obligada a informarlo.', 'Con inflación, una cuota fija pesa cada mes menos.'] },
  { path: 'cft-que-es-costo-financiero-total', service: 'creditocheck', title: 'Qué es el CFT y por qué importa más que la TNA', intro: 'El costo financiero total (CFT) suma intereses, comisiones, seguros e impuestos. Es el único número que sirve para comparar préstamos entre sí.',
    points: ['La TNA es solo el interés nominal, sin cargos.', 'El CFT con IVA es lo que de verdad te cuesta el crédito por año.', 'Dos préstamos con la misma TNA pueden tener CFT muy distintos.', 'Pedilo siempre antes de firmar.'] }
];

// ---- AlquilerClaro ----
pitch['alquiler-claro'] = {
  title: 'Aumento de alquiler',
  tagline: 'Calculá cuánto vas a pagar de alquiler después del próximo aumento, por ICL o IPC, con los índices oficiales del BCRA y el INDEC.',
  placeholders: { monto: 'Ej.: 500.000' },
  includes: [
    'El monto nuevo exacto y el porcentaje de aumento',
    'El cálculo con los índices oficiales del BCRA o el INDEC, paso a paso, para mostrarle al propietario o al inquilino',
    'Las fechas de los próximos tres ajustes',
    'Qué dice la ley según cuándo firmaste el contrato'
  ],
  steps: [
    ['Cargá tu contrato', 'El alquiler actual, el índice, cada cuánto aumenta y desde cuándo rige el monto.'],
    ['Mirá la fecha del ajuste', 'Gratis: te decimos cuándo es el próximo aumento.'],
    ['Pagá y descargá', 'Con Mercado Pago, sin crear cuenta. El PDF tiene el monto nuevo y el cálculo.']
  ],
  faq: [
    ['¿De dónde salen los índices?', 'El ICL lo publica el BCRA todos los días y el IPC lo publica el INDEC todos los meses. Los tomamos de sus fuentes oficiales y se actualizan solos.'],
    ['¿Qué índice usa mi contrato?', 'El que diga la cláusula de actualización. Los contratos firmados entre julio de 2020 y diciembre de 2023 usan el ICL anual de la Ley 27.551; los posteriores, el que hayan pactado las partes.'],
    ['¿Sirve para propietarios?', 'Sí. El cálculo es el mismo para las dos partes y el PDF sirve para mostrarlo.'],
    ['¿Y si el ajuste es dentro de varios días?', 'Calculamos con el último índice publicado y te avisamos que es una estimación. Recalculalo el día del ajuste.']
  ],
  mock: ['Alquiler nuevo', 'Cálculo con el índice', 'Próximos ajustes', 'Qué dice la ley']
};

const alquilerCases = [
  { path: 'aumento-alquiler-icl', service: 'alquiler-claro', title: 'Aumento de alquiler por ICL: cómo se calcula', intro: 'El ICL es el índice del BCRA para contratos de locación. El aumento sale de dividir el ICL del día del ajuste por el del inicio del período.',
    points: ['Se usa el ICL del día de inicio del período y el del día del ajuste.', 'El BCRA lo publica a diario.', 'Lo usan los contratos de la Ley 27.551 y muchos posteriores.', 'El aumento va sobre el alquiler, no sobre las expensas.'] },
  { path: 'aumento-alquiler-ipc', service: 'alquiler-claro', title: 'Aumento de alquiler por IPC (inflación)', intro: 'En los contratos que ajustan por inflación, el aumento es la variación acumulada del IPC del INDEC en los meses del período.',
    points: ['El INDEC publica el IPC de cada mes a mediados del mes siguiente.', 'Se toma la variación acumulada de tantos meses como dure el período.', 'Si el contrato fija otros meses, vale el contrato.', 'Desde el DNU 70/2023 el índice lo pactan las partes.'] },
  { path: 'ley-de-alquileres-2026-que-rige', service: 'alquiler-claro', title: 'Ley de alquileres en 2026: qué rige para tu contrato', intro: 'Depende de cuándo lo firmaste: los contratos anteriores al 29/12/2023 siguen con la Ley 27.551; los posteriores, con lo que pactaron las partes según el DNU 70/2023.',
    points: ['Contratos de julio 2020 a diciembre 2023: ajuste anual por ICL.', 'Contratos desde el 29/12/2023: índice, plazo y frecuencia libres.', 'El aumento nunca se aplica antes de la fecha pactada.', 'Guardá el cálculo por escrito.'] }
];

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
  ...laboralCases,
  ...creditoCases,
  ...alquilerCases,
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
