// Contenido SEO de las guías de Monotributo. Las cifras salen de la tabla oficial cargada en monotributo.js,
// así que se actualizan solas cuando se carga una tabla nueva.
import { TABLE, RECATEGORIZACION } from './monotributo.js';

const $ = n => '$ ' + Math.round(n).toLocaleString('es-AR');
const cat = c => TABLE.categorias.find(x => x.cat === c);
const A = cat('A'), K = cat('K');
const vig = TABLE.vigencia.split('-').reverse().join('/');
const vence = RECATEGORIZACION.vence.split('-').reverse().join('/');

// Enriquecimiento de guías existentes (por path)
export const enrich = {
  'categorias-monotributo-cuota-mensual': {
    title: `Categorías del Monotributo 2026: tabla, topes y cuánto se paga`,
    description: `Tabla de categorías del Monotributo vigente desde el ${vig}: tope de facturación, superficie, energía, alquileres y cuota mensual de la A a la K.`,
    table: 'categorias',
    sections: [
      ['Cómo se lee la tabla', [
        `Cada categoría tiene un tope de ingresos brutos anuales y, si tenés local, topes de superficie, energía eléctrica y alquileres. Tu categoría es la que corresponde al parámetro más alto: si por ingresos estás en la C pero por superficie en la D, te corresponde la D.`,
        `La cuota mensual incluye el impuesto integrado, el aporte jubilatorio (SIPA) y la obra social. Es distinta para quienes prestan servicios y para quienes venden productos a partir de la categoría C.`
      ]],
      ['Cuánto se paga en la categoría más baja y en la más alta', [
        `Con la tabla vigente desde el ${vig}, la categoría A permite facturar hasta ${$(A.ingresos)} al año y paga ${$(A.servicios)} por mes. La categoría K llega hasta ${$(K.ingresos)} y paga ${$(K.servicios)} por mes en servicios o ${$(K.bienes)} en venta de productos.`,
        `Si superás el tope de la K, quedás excluido del Monotributo y pasás al régimen general.`
      ]],
      ['Cuándo cambian los valores', [
        `ARCA actualiza los montos dos veces por año, en febrero y en agosto, según la inflación. Por eso conviene mirar siempre la tabla vigente al momento de recategorizarte: la próxima recategorización vence el ${vence}.`
      ]]
    ],
    faq: [
      ['¿Qué categoría me corresponde?', 'La que surge del parámetro más alto entre ingresos brutos de los últimos 12 meses, superficie, energía eléctrica consumida y alquileres. Si no tenés local, solo cuentan los ingresos.'],
      ['¿La cuota incluye la obra social?', 'Sí. La cuota mensual suma impuesto integrado, aporte jubilatorio y obra social. Si trabajás en relación de dependencia o sos jubilado, algunos componentes pueden no corresponder.'],
      ['¿Qué pasa si me paso del tope de mi categoría?', 'En la próxima recategorización tenés que subir a la categoría que corresponda. Si superás el tope de la K, quedás excluido del régimen.']
    ]
  },
  'recategorizacion-monotributo-febrero-2027': {
    description: `Todo sobre la recategorización del Monotributo que vence el ${vence}: qué período se mira, quién se tiene que recategorizar y cómo calcular tu categoría.`,
    sections: [
      ['Qué es la recategorización', [
        `Dos veces por año, en enero y en julio, cada monotributista revisa si sigue en la misma categoría. Para la de enero se miran los ingresos de ${RECATEGORIZACION.periodo}, y el trámite vence el ${vence}.`,
        `Si tu categoría no cambia, no tenés que hacer nada. Si cambia, hacés el trámite online en ARCA y la cuota nueva se paga desde febrero.`
      ]],
      ['Qué parámetros cuentan', [
        `Los ingresos brutos de los últimos 12 meses y, si tenés local, la superficie afectada a la actividad, la energía eléctrica consumida y los alquileres pagados. Te corresponde la categoría del parámetro más alto.`
      ]],
      ['Qué pasa si no te recategorizás', [
        `Si correspondía subir de categoría y no lo hiciste, ARCA puede recategorizarte de oficio, cobrarte la diferencia de cuotas con intereses y aplicar una multa. Si te tocaba bajar y no lo hiciste, seguís pagando la cuota más alta.`
      ]]
    ],
    faq: [
      ['¿Tengo que recategorizarme si sigo en la misma categoría?', 'No. Solo hacés el trámite si cambiás de categoría. Igual conviene revisarlo cada semestre.'],
      ['¿Hasta cuándo tengo tiempo?', `El trámite de esta recategorización vence el ${vence}.`],
      ['¿Necesito un contador?', 'No es obligatorio. El trámite se hace online con tu clave fiscal. Un contador te puede ayudar si tu situación es compleja.']
    ]
  }
};

// Guías nuevas
export const extra = [
  {
    path: 'como-darse-de-alta-en-el-monotributo', service: 'monotributocheck',
    title: 'Cómo darse de alta en el Monotributo, paso a paso',
    intro: 'El alta se hace online en ARCA con tu CUIT y clave fiscal. Elegís la actividad, la categoría según lo que vas a facturar y la obra social. Lleva unos 20 minutos.',
    description: 'Guía para inscribirte en el Monotributo en ARCA: requisitos, cómo elegir la categoría inicial, obra social y qué hacer después del alta.',
    points: ['Necesitás CUIT y clave fiscal nivel 3.', 'La categoría inicial se elige según lo que estimás facturar en los próximos 12 meses.', 'Después del alta, habilitá un punto de venta para poder facturar.'],
    steps: [
      ['Conseguí la clave fiscal nivel 3', 'Si no la tenés, la gestionás con validación biométrica en la app Mi ARCA o en una dependencia de ARCA.'],
      ['Entrá al Portal Monotributo', 'Ingresá a arca.gob.ar con CUIT y clave fiscal y elegí «Monotributo» → «Adherite al Monotributo».'],
      ['Cargá tu actividad', 'Elegí el código de actividad que mejor describe lo que hacés y si prestás servicios o vendés productos.'],
      ['Elegí la categoría', 'Estimá lo que vas a facturar en los próximos 12 meses y, si tenés local, su superficie, consumo de luz y alquiler. Elegí la categoría que cubra el parámetro más alto.'],
      ['Elegí la obra social', 'Seleccioná la obra social del listado. Podés sumar integrantes de tu grupo familiar pagando el adicional.'],
      ['Confirmá y descargá la credencial', 'Al confirmar, descargá la constancia y la credencial de pago. La primera cuota se paga desde el mes siguiente al alta.']
    ],
    sections: [
      ['Quién puede ser monotributista', ['Personas que prestan servicios o venden productos con ingresos anuales por debajo del tope de la categoría K, y que cumplen el resto de los requisitos del régimen (por ejemplo, un precio unitario máximo si venden productos).']],
      ['Qué hacer después del alta', ['Habilitá un punto de venta para emitir factura C, adherite al débito automático de la cuota si querés olvidarte del vencimiento y empezá a llevar el registro de lo que facturás para la próxima recategorización.']]
    ],
    faq: [
      ['¿Cuánto cuesta darse de alta?', 'El trámite es gratuito. Desde el mes siguiente pagás la cuota mensual de tu categoría.'],
      ['¿Puedo ser monotributista y empleado en relación de dependencia?', 'Sí. En ese caso no pagás los componentes de jubilación y obra social del Monotributo, porque ya aportás por tu empleo: pagás solo el impuesto integrado.'],
      ['¿Qué categoría elijo si recién empiezo?', 'La que corresponda a lo que estimás facturar en los próximos 12 meses. En la siguiente recategorización ajustás según lo facturado real.']
    ]
  },
  {
    path: 'como-pagar-el-monotributo', service: 'monotributocheck',
    title: 'Cómo pagar el Monotributo y cuándo vence',
    intro: 'La cuota del Monotributo vence el 20 de cada mes. Se puede pagar con débito automático, tarjeta, transferencia con VEP o en efectivo con la credencial de pago.',
    description: 'Vencimiento de la cuota del Monotributo, formas de pago (débito automático, VEP, tarjeta, Mercado Pago, efectivo) y qué pasa si pagás tarde.',
    points: ['El vencimiento general es el día 20 de cada mes (o el día hábil siguiente).', 'Con débito automático no te olvidás nunca.', 'Si pagás tarde se suman intereses resarcitorios.'],
    steps: [
      ['Mirá cuánto tenés que pagar', 'En el Portal Monotributo, en «Estado de cuenta» ves la cuota del mes y si tenés deuda.'],
      ['Elegí el medio de pago', 'Débito automático (en cuenta o tarjeta), VEP por home banking, billeteras y Mercado Pago, o efectivo en Rapipago/Pago Fácil con el código de la credencial.'],
      ['Pagá antes del 20', 'Si el 20 es feriado o fin de semana, vence el día hábil siguiente.'],
      ['Guardá el comprobante', 'Te sirve si ARCA no impacta el pago. Revisá el estado de cuenta a los pocos días.']
    ],
    faq: [
      ['¿Qué pasa si no pago el Monotributo?', 'Se acumula deuda con intereses. Si no pagás 10 cuotas consecutivas, ARCA puede darte de baja automáticamente del régimen.'],
      ['¿Puedo pagar varias cuotas atrasadas juntas?', 'Sí, desde el Portal Monotributo generás el VEP por las cuotas adeudadas con sus intereses, o podés adherir a un plan de pagos.']
    ]
  },
  {
    path: 'como-dar-de-baja-el-monotributo', service: 'monotributocheck',
    title: 'Cómo dar de baja el Monotributo',
    intro: 'Si dejaste la actividad, la baja se pide online en el Portal Monotributo. Conviene hacerla apenas dejás de facturar para no seguir generando cuotas.',
    description: 'Cómo darse de baja del Monotributo en ARCA: cuándo conviene, pasos, qué pasa con la deuda y cómo volver a inscribirte.',
    points: ['La baja corta las cuotas desde el mes siguiente.', 'La deuda anterior no se borra con la baja.', 'Si vas a pasar a Responsable Inscripto no es una baja: es un cambio de régimen.'],
    steps: [
      ['Revisá tu estado de cuenta', 'Antes de la baja, mirá si tenés cuotas adeudadas en el Portal Monotributo.'],
      ['Entrá al Portal Monotributo', 'Con CUIT y clave fiscal, en arca.gob.ar → «Monotributo».'],
      ['Elegí «Darme de baja»', 'Indicá el motivo (cese de actividad) y la fecha.'],
      ['Guardá la constancia', 'Descargá el comprobante de la baja.']
    ],
    faq: [
      ['¿Puedo volver al Monotributo después de darme de baja?', 'Sí. Si la baja fue por cese de actividad podés volver a adherirte. Si fue por exclusión, hay que esperar el plazo que fija la ley.'],
      ['¿Me dan de baja solos si no pago?', 'Sí: con 10 cuotas consecutivas impagas ARCA puede darte de baja de oficio, pero la deuda queda.']
    ]
  },
  {
    path: 'factura-c-vs-factura-b', service: 'monotributocheck',
    title: 'Factura C, B o A: cuál emite un monotributista',
    intro: 'El monotributista siempre emite factura C, sin importar a quién le vende. La factura A y la B las emiten los responsables inscriptos en IVA.',
    description: 'Qué factura emite un monotributista y por qué siempre es la C. Diferencias con la factura A y la B, y qué datos del cliente tenés que pedir.',
    points: ['Monotributista: factura C, siempre.', 'Responsable inscripto: factura A a otro inscripto y B a consumidores finales y monotributistas.', 'La factura C no discrimina IVA.'],
    sections: [
      ['Por qué el monotributista emite factura C', ['Porque no es contribuyente de IVA: el impuesto ya está incluido en la cuota mensual. Por eso la factura C muestra un único importe total, sin IVA discriminado.']],
      ['Qué datos del cliente tenés que pedir', ['Su condición frente al IVA (consumidor final, responsable inscripto, monotributo o exento). Si es una empresa o un responsable inscripto, su CUIT. A consumidores finales, por montos altos, también se pide DNI.']],
      ['Cómo hacerla', ['Se emite desde «Comprobantes en línea» de ARCA o desde la app de facturación. Tenemos una guía paso a paso para la primera vez.']]
    ],
    faq: [
      ['¿Un monotributista puede hacer factura A?', 'No. Para emitir factura A tenés que estar inscripto en IVA (régimen general).'],
      ['¿La factura C sirve para que mi cliente se descuente IVA?', 'No, porque no discrimina IVA. Para el cliente es un gasto por el total.']
    ]
  },
  {
    path: 'monotributo-o-responsable-inscripto', service: 'monotributocheck',
    title: 'Monotributo o Responsable Inscripto: cuándo conviene cambiar',
    intro: `Mientras factures por debajo del tope de la categoría K (${$(K.ingresos)} al año con la tabla vigente) y cumplas los requisitos, el Monotributo suele ser más simple y barato. Al superarlo, pasás al régimen general.`,
    description: 'Diferencias entre Monotributo y Responsable Inscripto: impuestos, facturación, topes y cuándo conviene o es obligatorio cambiar de régimen.',
    points: ['Monotributo: una cuota fija mensual con todo incluido.', 'Responsable Inscripto: IVA mensual, Ganancias anual y autónomos.', 'Superar el tope de la K te excluye del Monotributo.'],
    sections: [
      ['Qué cambia en la práctica', ['En el Monotributo pagás una cuota fija y emitís factura C. Como Responsable Inscripto liquidás IVA todos los meses (cobrás IVA y descontás el de tus compras), pagás Ganancias sobre tu resultado y aportes de autónomos. Necesitás más orden administrativo y, en general, un contador.']],
      ['Cuándo conviene el régimen general', ['Cuando tus clientes son empresas que necesitan factura A, cuando tenés muchos gastos con IVA para descontar, o cuando estás cerca del tope y preferís pasar ordenadamente antes de quedar excluido.']]
    ],
    faq: [
      ['¿Me pueden excluir del Monotributo?', 'Sí, si superás los topes de la categoría K, el precio unitario máximo en venta de productos u otros requisitos del régimen.'],
      ['¿Puedo volver al Monotributo?', 'Si pasaste voluntariamente o por exclusión, hay plazos de espera antes de volver. Conviene revisarlo con un contador.']
    ]
  }
];
