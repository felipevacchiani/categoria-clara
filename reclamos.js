// Motor compartido de reclamos: ConsumoDefensa, EnvíoReclamo y VueloReclamo.
// Genera una nota formal según el tipo de caso, pruebas a adjuntar y próximos pasos con fechas.
// El encuadre normativo es de referencia y debe revisarlo un abogado antes de habilitar la venta.
// Usar solo caracteres Latin-1: el PDF se emite con WinAnsiEncoding.

const DAY = 86400000;
const addDays = (iso, n) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
const diff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const fmt = iso => iso.split('-').reverse().join('/');
const fail = message => { throw new Error(message); };
export const choice = (key, label, catalog) => ({
  key, label, type: 'select',
  options: Object.entries(catalog).map(([value, entry]) => ({ value, label: entry.label }))
});

const AVISO = 'Borrador informativo generado con los datos que ingresaste. No constituye asesoramiento jurídico. El encuadre normativo es una referencia general; revisalo con un profesional si el caso lo requiere.';
const ENVIO_FEHACIENTE = 'Enviá la nota por un medio que deje constancia: formulario o correo del canal oficial de reclamos con número de gestión o, si no hay respuesta, carta documento.';

export const CONSUMO = {
  cobro: {
    label: 'Cobro indebido o no reconocido', asunto: 'cobro indebido o no reconocido',
    normas: [
      'Ley 24.240, art. 4: obligación de brindar información cierta, clara y detallada sobre las condiciones de comercialización.',
      'Ley 24.240, art. 19: obligación de respetar los términos, condiciones y modalidades convenidos.',
      'Ley 24.240, art. 8 bis: trato digno y prohibición de prácticas abusivas.'
    ],
    opciones: 'la anulación del cargo y el reintegro de lo cobrado de más',
    pruebas: ['Factura o resumen donde figura el cargo.', 'Contrato, oferta o condiciones vigentes al contratar.', 'Reclamos anteriores con su número de gestión.']
  },
  incumplimiento: {
    label: 'Producto o servicio no entregado o no prestado', asunto: 'incumplimiento de la oferta o del contrato',
    normas: [
      'Ley 24.240, art. 7: la oferta dirigida a consumidores obliga a quien la emite.',
      'Ley 24.240, art. 10 bis: ante el incumplimiento, el consumidor puede elegir entre exigir el cumplimiento, aceptar un producto o servicio equivalente, o rescindir con restitución de lo pagado, sin perjuicio de los daños.',
      'Ley 24.240, art. 19: obligación de respetar los términos, plazos y condiciones convenidos.'
    ],
    opciones: 'el cumplimiento de lo contratado, un producto o servicio equivalente, o la rescisión con devolución de lo pagado (art. 10 bis)',
    pruebas: ['Comprobante de pago y de compra.', 'Publicidad, oferta o condiciones con el plazo prometido.', 'Comunicaciones con la empresa y números de gestión.']
  },
  baja: {
    label: 'No procesan la baja de un servicio', asunto: 'falta de procesamiento de la baja del servicio',
    normas: [
      'Ley 24.240, art. 10 ter: el servicio contratado en forma telefónica, electrónica o similar puede rescindirse por el mismo medio utilizado para contratar.',
      'Disposición SSDCyLC 954/2025 y Disposición DNDCyAC 3/2026: Botón de Baja de Servicios en los canales digitales, con validación razonable de identidad.',
      'Ley 24.240, art. 8 bis: trato digno y prohibición de prácticas abusivas.'
    ],
    opciones: 'la baja con efecto desde la primera solicitud, el código de baja y el reintegro de lo facturado después de esa fecha',
    pruebas: ['Constancia o captura de la solicitud de baja con fecha.', 'Facturas emitidas después de pedir la baja.', 'Código o número de gestión de la solicitud.']
  },
  garantia: {
    label: 'Producto con falla o garantía', asunto: 'producto defectuoso y garantía legal',
    normas: [
      'Ley 24.240, art. 11: garantía legal por defectos o vicios de las cosas muebles no consumibles.',
      'Ley 24.240, art. 13: productores, importadores, distribuidores y vendedores responden en forma solidaria por la garantía.',
      'Ley 24.240, art. 17: si la reparación no resulta satisfactoria, el consumidor puede pedir la sustitución, la devolución o una quita proporcional del precio.'
    ],
    opciones: 'la reparación sin cargo o, si no resulta satisfactoria, la sustitución del producto o la devolución de lo pagado (art. 17)',
    pruebas: ['Factura o ticket de compra.', 'Fotos o video de la falla.', 'Constancia de servicio técnico, si ya lo llevaste.']
  },
  arrepentimiento: {
    label: 'Compra online o a distancia que quiero devolver', asunto: 'revocación de la compra (derecho de arrepentimiento)',
    normas: [
      'Ley 24.240, art. 34 y Código Civil y Comercial, art. 1110: derecho a revocar la aceptación dentro de los 10 días corridos desde la entrega o la celebración del contrato, lo último que ocurra. Los gastos de devolución son a cargo del proveedor.',
      'Disposición SSDCyLC 954/2025 y Disposición DNDCyAC 3/2026: Botón de Arrepentimiento en los canales digitales.'
    ],
    opciones: 'la revocación de la compra y el reintegro total de lo pagado, con los gastos de devolución a cargo de la empresa',
    pruebas: ['Comprobante de compra y de entrega con fecha.', 'Captura del uso del Botón de Arrepentimiento, si lo hay.', 'Comunicaciones con la empresa.']
  }
};

export const ENVIO = {
  no_entregado: {
    label: 'El pedido nunca llegó', asunto: 'falta de entrega del pedido',
    normas: [
      'Ley 24.240, art. 7: la oferta, incluido el plazo de entrega informado, obliga a quien la emite.',
      'Ley 24.240, art. 10 bis: ante el incumplimiento, el consumidor puede exigir el cumplimiento, aceptar un equivalente o rescindir con restitución de lo pagado.'
    ],
    opciones: 'la entrega inmediata o la devolución de lo pagado (art. 10 bis)',
    pruebas: ['Comprobante de compra y de pago.', 'Número y captura del seguimiento del envío.', 'Plazo de entrega prometido.']
  },
  demora: {
    label: 'Llegó tarde o sigue demorado', asunto: 'demora en la entrega',
    normas: [
      'Ley 24.240, art. 19: obligación de respetar los plazos y condiciones convenidos.',
      'Ley 24.240, art. 10 bis: ante el incumplimiento, el consumidor puede exigir el cumplimiento, aceptar un equivalente o rescindir con restitución de lo pagado.'
    ],
    opciones: 'una fecha cierta de entrega o la devolución de lo pagado (art. 10 bis), y el reintegro del costo de envío',
    pruebas: ['Plazo de entrega prometido.', 'Historial del seguimiento con fechas.', 'Comunicaciones con la empresa.']
  },
  danado: {
    label: 'Llegó dañado o incompleto', asunto: 'entrega de un pedido dañado o incompleto',
    normas: [
      'Ley 24.240, art. 10 bis: ante el incumplimiento, el consumidor puede exigir el cumplimiento, aceptar un equivalente o rescindir con restitución de lo pagado.',
      'Ley 24.240, art. 11: garantía legal por defectos o vicios de las cosas muebles no consumibles.'
    ],
    opciones: 'el reemplazo por un producto en buen estado o completo, o la devolución de lo pagado',
    pruebas: ['Fotos del paquete y del producto al recibirlo.', 'Remito o constancia de entrega.', 'Comprobante de compra.']
  },
  equivocado: {
    label: 'Llegó un producto distinto', asunto: 'entrega de un producto distinto del comprado',
    normas: [
      'Ley 24.240, art. 7: la oferta obliga a quien la emite.',
      'Ley 24.240, art. 10 bis: ante el incumplimiento, el consumidor puede exigir el cumplimiento, aceptar un equivalente o rescindir con restitución de lo pagado.'
    ],
    opciones: 'el envío del producto comprado con retiro sin cargo del recibido, o la devolución de lo pagado',
    pruebas: ['Fotos del producto recibido y de su etiqueta.', 'Publicación o detalle del producto comprado.', 'Comprobante de compra.']
  }
};

const MONTREAL = 'Convenio de Montreal de 1999 (vuelos internacionales)';
export const VUELO = {
  cancelacion: {
    label: 'Vuelo cancelado', asunto: 'cancelación del vuelo',
    normas: [
      'Reglamento del Contrato Aéreo de Pasajeros aprobado por Decreto 809/2024, art. 41: alternativas a cargo del transportador ante la cancelación (reubicación, endoso o reintegro del billete).',
      'Mismo Reglamento, art. 43: servicios incidentales ante alteraciones horarias.'
    ],
    internacional: `${MONTREAL}, art. 19: responsabilidad del transportista por el daño ocasionado por retraso.`,
    opciones: 'el reintegro del billete o la reubicación sin costo, y el reintegro de los gastos ocasionados',
    pruebas: ['Billete o reserva.', 'Aviso de cancelación con fecha y hora.', 'Comprobantes de gastos ocasionados (comidas, alojamiento, traslados).']
  },
  demora: {
    label: 'Vuelo demorado', asunto: 'demora del vuelo',
    normas: ['Reglamento del Contrato Aéreo de Pasajeros aprobado por Decreto 809/2024, art. 43: servicios incidentales ante alteraciones horarias en la partida del vuelo.'],
    internacional: `${MONTREAL}, art. 19: responsabilidad del transportista por el daño ocasionado por retraso.`,
    opciones: 'el reintegro de los gastos ocasionados por la demora y la reparación de los perjuicios',
    pruebas: ['Tarjeta de embarque o reserva.', 'Constancia de la hora real de salida y llegada.', 'Comprobantes de gastos ocasionados.']
  },
  equipaje: {
    label: 'Equipaje dañado, demorado o perdido', asunto: 'daño, demora o pérdida del equipaje',
    normas: ['Reglamento del Contrato Aéreo de Pasajeros aprobado por Decreto 809/2024: régimen del equipaje registrado y responsabilidad del transportador.'],
    internacional: `${MONTREAL}, arts. 17 y 31: responsabilidad por el equipaje registrado y plazos de protesta (7 días para daño desde la recepción; 21 días para demora desde que se puso a disposición).`,
    opciones: 'la entrega o reparación del equipaje, o la indemnización correspondiente, y el reintegro de los gastos de primera necesidad',
    pruebas: ['Constancia de irregularidad de equipaje (PIR) emitida en el aeropuerto.', 'Etiqueta del equipaje y tarjeta de embarque.', 'Fotos del daño y comprobantes de gastos.']
  },
  denegacion: {
    label: 'Me negaron el embarque', asunto: 'denegación de embarque',
    normas: ['Reglamento del Contrato Aéreo de Pasajeros aprobado por Decreto 809/2024: derechos del pasajero ante la denegación de embarque.'],
    internacional: `${MONTREAL}, art. 19: responsabilidad del transportista por el daño ocasionado por retraso.`,
    opciones: 'la reubicación o el reintegro del billete, y el reintegro de los gastos ocasionados',
    pruebas: ['Billete y check-in realizado.', 'Constancia escrita de la denegación.', 'Comprobantes de gastos ocasionados.']
  },
  reintegro: {
    label: 'No me devuelven el dinero del pasaje', asunto: 'falta de reintegro del billete',
    normas: ['Reglamento del Contrato Aéreo de Pasajeros aprobado por Decreto 809/2024: reintegro del billete y derecho de retracto.'],
    internacional: null,
    opciones: 'el reintegro total del billete en el medio de pago utilizado',
    pruebas: ['Billete y comprobante de pago.', 'Solicitud de reintegro con fecha y número de gestión.', 'Respuestas de la aerolínea o de la agencia.']
  }
};

const SINO = { si: { label: 'Sí, sale o llega fuera de la Argentina' }, no: { label: 'No, es de cabotaje' } };
export const internacionalField = choice('internacional', '¿Es un vuelo internacional?', SINO);

function plazoValido(value) {
  if (!(Number.isInteger(value) && value >= 1 && value <= 30)) fail('Indicá un plazo entero de 1 a 30 días para la respuesta.');
  return value;
}

function nota({ caso, envio, plazo, empresa, contexto, hechos, pedido, normas, autoridad }) {
  const limite = addDays(envio, plazo);
  return {
    limite,
    lines: [
      '--- NOTA DE RECLAMO (completá tus datos y enviala) ---',
      `Fecha: ${fmt(envio)}`,
      `Para: ${empresa}`,
      `Asunto: Reclamo por ${caso.asunto}`,
      'De: [Tu nombre completo, DNI y número de cliente, pedido o reserva]',
      contexto,
      `Hechos: ${hechos}`,
      'Encuadre normativo de referencia:',
      ...normas.map(n => `- ${n}`),
      `Solicito: ${pedido}.`,
      `Pido una respuesta por escrito dentro de ${plazo} días corridos, es decir hasta el ${fmt(limite)}. Sin respuesta satisfactoria, presentaré el reclamo ante ${autoridad}.`,
      'Firma: ____________________'
    ]
  };
}

const bloque = (titulo, items) => [`--- ${titulo} ---`, ...items.map((item, i) => `${i + 1}. ${item}`)];

export function consumoEngine(x) {
  const caso = CONSUMO[x.tipo];
  const plazo = plazoValido(x.plazo);
  if (diff(x.fecha, x.envio) < 0) fail('La fecha de envío del reclamo no puede ser anterior a la de contratación.');
  const { lines, limite } = nota({
    caso, envio: x.envio, plazo, empresa: x.empresa, hechos: x.hechos, pedido: x.pedido, normas: caso.normas,
    contexto: `Con fecha ${fmt(x.fecha)} contraté o compré productos o servicios de su empresa.`,
    autoridad: 'la autoridad de aplicación de Defensa del Consumidor'
  });
  const avisos = [];
  if (x.tipo === 'arrepentimiento' && diff(x.fecha, x.envio) > 10) {
    avisos.push(`Atención: entre la fecha indicada y el envío pasan ${diff(x.fecha, x.envio)} días. El plazo es de 10 días corridos desde la entrega o la celebración, lo último que ocurra. Si la entrega fue posterior, contá desde ese día.`);
  }
  return [
    ...lines,
    ...avisos,
    ...bloque('PRUEBAS PARA ADJUNTAR', [...caso.pruebas, 'Copia de esta nota y la constancia de envío.']),
    ...bloque('PRÓXIMOS PASOS', [
      ENVIO_FEHACIENTE,
      `Opciones que podés exigir en este tipo de caso: ${caso.opciones}.`,
      `Si al ${fmt(limite)} no hay respuesta satisfactoria, presentá el reclamo en la Ventanilla Federal Única de Reclamos de Defensa del Consumidor o en la oficina de Defensa del Consumidor de tu provincia o municipio, con esta nota y las pruebas.`,
      'Guardá todos los números de gestión: la autoridad los va a pedir.'
    ]),
    AVISO
  ];
}

export function envioEngine(x) {
  const caso = ENVIO[x.tipo];
  const plazo = plazoValido(x.plazo);
  const atraso = diff(x.promesa, x.revision);
  if (diff(x.revision, x.envio) < 0) fail('La fecha de envío del reclamo no puede ser anterior a la verificación del problema.');
  const contexto = x.tipo === 'demora' || x.tipo === 'no_entregado'
    ? `La entrega estaba comprometida para el ${fmt(x.promesa)}. Al ${fmt(x.revision)}, la diferencia respecto de la fecha prometida era de ${atraso} días.`
    : `La entrega estaba comprometida para el ${fmt(x.promesa)} y el problema se verificó el ${fmt(x.revision)}.`;
  const { lines, limite } = nota({
    caso, envio: x.envio, plazo, empresa: x.empresa, hechos: x.hechos, pedido: x.pedido, normas: caso.normas, contexto,
    autoridad: 'la autoridad de aplicación de Defensa del Consumidor'
  });
  return [
    ...lines,
    ...bloque('PRUEBAS PARA ADJUNTAR', [...caso.pruebas, 'Copia de esta nota y la constancia de envío.']),
    ...bloque('PRÓXIMOS PASOS', [
      'Si compraste a un comercio que se ocupa del envío, dirigí el reclamo al comercio: es quien se obligó a entregarte el producto. Si contrataste vos el envío con un operador postal, reclamá al operador.',
      ENVIO_FEHACIENTE,
      `Opciones que podés exigir en este tipo de caso: ${caso.opciones}.`,
      `Si al ${fmt(limite)} no hay respuesta satisfactoria, presentá el reclamo en la Ventanilla Federal Única de Reclamos de Defensa del Consumidor o en la oficina de tu provincia o municipio. Si el problema es con un operador postal, también podés reclamar ante ENACOM.`
    ]),
    AVISO
  ];
}

export function vueloEngine(x) {
  const caso = VUELO[x.tipo];
  const plazo = plazoValido(x.plazo);
  const internacional = x.internacional === 'si';
  const normas = [...caso.normas, ...(internacional && caso.internacional ? [caso.internacional] : [])];
  const { lines, limite } = nota({
    caso, envio: x.envio, plazo, empresa: x.empresa, hechos: x.hechos, pedido: x.pedido, normas,
    contexto: `Tenía reserva en el vuelo ${x.vuelo} del ${fmt(x.fecha)}, ruta ${x.ruta}.`,
    autoridad: 'la Administración Nacional de Aviación Civil (ANAC)'
  });
  const avisos = [];
  if (x.tipo === 'equipaje' && internacional) {
    avisos.push(`Plazos de protesta por equipaje en vuelos internacionales: por daño, 7 días desde que lo recibiste (si fue el día del vuelo, hasta el ${fmt(addDays(x.fecha, 7))}); por demora, 21 días desde que te lo entregaron. Presentá la protesta por escrito a la aerolínea dentro de esos plazos.`);
  }
  if (x.tipo === 'equipaje' && !internacional) {
    avisos.push('En vuelos de cabotaje, verificá los plazos de protesta en las condiciones del billete y presentala cuanto antes.');
  }
  return [
    ...lines,
    ...avisos,
    ...bloque('PRUEBAS PARA ADJUNTAR', [...caso.pruebas, 'Copia de esta nota y la constancia de envío.']),
    ...bloque('PRÓXIMOS PASOS', [
      'Presentá primero la nota por el canal oficial de reclamos de la aerolínea y guardá el número de reclamo.',
      `Opciones que podés exigir en este tipo de caso: ${caso.opciones}.`,
      `Si al ${fmt(limite)} no hay respuesta satisfactoria, iniciá el reclamo ante el Servicio de Conciliación de la ANAC desde su sitio web, con el número de reclamo de la aerolínea y estas pruebas.`,
      'La ANAC interviene en vuelos con partida o destino en la Argentina. Si compraste con una agencia, mencioná también a la agencia.'
    ]),
    AVISO
  ];
}
