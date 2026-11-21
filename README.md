# Gestión Clara

Plataforma argentina de herramientas, cálculos y asistencia documental. Este repositorio contiene el sitio, API HTTP, datos persistentes, pagos, informes y administración. El alcance de cada herramienta está detallado en la [auditoría](AUDITORIA.md).

## Arranque local

Requisitos: Node.js 24 o superior. El proyecto usa la biblioteca estándar. Ejecutá desde la carpeta del repositorio:

```sh
npm start
```

Abrí http://localhost:3000. El catálogo y los 20 formularios funcionan con datos ingresados. La compra no requiere cuenta: el cliente deja su correo, paga y accede a su reclamo por un enlace privado (`/p/<token>`) que también recibe por correo; desde «Mis reclamos» puede pedir que se lo reenviemos. Sin `RESEND_KEY`, los enlaces se imprimen en la consola del servidor. Usá datos ficticios en local. La base se crea en `data/gestion-clara.sqlite`. En ausencia de configuración comercial, el servidor rechaza compras.

```sh
npm test
```

La suite necesita permiso para abrir un puerto temporal en el equipo. Verifica los 20 motores y recorre catálogo, sesión, controles de acceso, compra, validación del webhook, conciliación, descarga privada, deduplicación y analítica. La simulación del proveedor existe exclusivamente en el proceso de prueba.

## Arquitectura

- **Páginas por tipo de caso.** `/reclamos/<caso>` (14 páginas, definidas en `marketing.js`) muestran la normativa, lo que se puede pedir y las pruebas, con el formulario preseleccionado. Están en el sitemap.
- **Conservación.** Con `RETENTION_DAYS` (30 o más) el servidor borra cada hora el contenido de los reclamos y los PDF más antiguos, y conserva los metadatos de pago. `node --env-file=.env server.js depurar` lo ejecuta a mano. El panel registra cuándo se entregó el contenido de cada pedido.
- **Servicio activo: MonotributoCheck** (`monotributo.js`). Calcula la categoría por parámetro con la tabla oficial de ARCA vigente desde el 1/8/2026, la cuota, el margen para diciembre, la exclusión y el paso a paso. Cuando ARCA publique la tabla nueva (enero y julio), agregá los valores en `TABLE`, actualizá `RECATEGORIZACION` y subí la versión del servicio en `services.js`: eso obliga a volver a aprobarlo en el archivo de lanzamiento. Las guías viven en `/guias/<caso>`.
- **Línea de reclamos (oculta).** ConsumoDefensa, EnvíoReclamo y VueloReclamo siguen en el código, fuera del sitio.
- **Servicios visibles.** Solo los de `listed` en `services.js` (hoy, MonotributoCheck); el resto responde 404. Los textos comerciales viven en `marketing.js`. Con precio configurado, la vista previa muestra un resumen y la nota completa se entrega solo en el PDF pago.
- `services.js` concentra el catálogo y los motores determinísticos, con entradas explícitas y versión. `sources.js` contiene las referencias públicas que se muestran en cada ficha.
- `server.js` sirve HTML renderizado, formularios, sesiones, pedidos, webhooks y administración. Todos los formularios de escritura usan validación de origen. La cookie de sesión es HTTP-only y solo viaja por HTTPS en instancias HTTPS.
- `db.js` inicializa SQLite con WAL y claves foráneas. Un usuario tiene sesiones y pedidos. Cada pedido conserva precio en centavos, modo, versión de reglas, política y resultado. Los pagos reales se identifican por ID del proveedor. La conciliación, creación del PDF y sus eventos se confirman en una transacción. Los informes se descargan solo desde la cuenta propietaria.
- El PDF contiene el resultado y su versión, referencia de pedido y fecha. Los resultados de compra y PDFs se cifran con AES-256-GCM cuando se configura `DATA_KEY`. Cuentas, metadatos de pago y solicitudes se protegen con permisos del volumen y cifrado de disco. Las entradas de una vista previa no se guardan.
- El aviso de entrega se envía con Resend cuando se habilita el modo comercial. Guarda intentos, espera exponencial y estado. Contiene un enlace a la cuenta en lugar de adjuntar información personal. En entorno de prueba la entrega se verifica desde el historial.
- La analítica interna mide vistas atendidas, inicios de formulario cuando el navegador ejecuta JavaScript, envíos válidos, checkouts, compras verificadas, informes y devoluciones/disputas. Son conteos de eventos, con posibles repeticiones en vistas y formularios. El panel no estima visitantes únicos, CAC, costos, rentabilidad ni montos netos acreditados.
- SEO incluye metadatos por servicio, Open Graph, canónicas, sitemap, robots y exclusión de pantallas privadas. `INDEX_PUBLIC=0` es el valor inicial. Search Console requiere verificar el dominio. No se envían datos a GA4.

## Administración

Copiá `.env.example` a `.env` y configurá `ADMIN_EMAIL` antes del primer registro. Creá la cuenta desde una terminal de confianza. Es la única cuenta con contraseña del sistema; se ingresa desde `/admin`. El comando lee la contraseña de entrada estándar y no la imprime:

```sh
printf 'Contraseña administrativa: '
stty -echo
IFS= read -r gestion_clara_admin_password
stty echo
printf '\n'
printf '%s\n' "$gestion_clara_admin_password" | node --env-file=.env server.js admin
unset gestion_clara_admin_password
```

El panel `/admin` consulta pedidos, usuarios asociados, acreditaciones, avisos y solicitudes de arrepentimiento. Para atender una solicitud, verificá la compra, respondé desde el canal de soporte y, si corresponde, tramitá el reintegro en Mercado Pago. Marcar atendida registra el estado local. Una devolución ingresada al proveedor se refleja al recibir el evento de pago o ejecutar la conciliación manual. La tabla de importes muestra referencias a valores brutos de pedidos, con su estado.

## Despliegue

**Modelo de alojamiento.** Una sola instancia de Node y un volumen persistente, por ejemplo en un VPS. La base SQLite debe vivir en disco local persistente. Reiniciar el contenedor sin ese volumen perdería los datos. La cola de correo y los límites de solicitudes se ejecutan dentro del proceso. Para operar instancias múltiples corresponde migrar persistencia y cola a infraestructura compartida y verificar los cambios de concurrencia.

1. Prepará bases y credenciales separadas para local, prueba y producción. Generá una clave de 32 bytes y conservá una copia en el gestor de secretos elegido. `openssl rand -hex 32` genera el formato que espera `DATA_KEY`. La pérdida de la clave impide recuperar informes y resultados almacenados.
2. Configurá un dominio HTTPS y un proxy inverso sobre el proceso. Configurá `PUBLIC_ORIGIN` con el origen exacto. El proxy debe preservar `Origin`, limitar tamaño y frecuencia de solicitudes y cerrar el acceso directo al puerto de Node. Si usás `TRUST_PROXY=1`, configurá el proxy para sobrescribir `X-Real-IP`; el servidor lo usará para el límite básico de frecuencia.
3. Construí la imagen con `docker build -t gestion-clara .`, o ejecutá con Node como servicio del sistema. Inyectá secretos desde el entorno, montá un volumen sobre `/data` y un archivo comercial aprobado en modo de lectura. La imagen corre como usuario sin privilegios. `PORT` es 3000 y `DB_PATH` por defecto en la imagen es `/data/gestion-clara.sqlite`.
4. Partí de `release.borrador.json` (términos y privacidad en borrador, en `legal/`) y completá los corchetes una vez aprobados por el abogado. `cuit` y `address` se muestran en el pie, como exige la Resolución 270/2020; `withdrawalNotice` se muestra antes de comprar. Adaptá `release.example.json` en un archivo privado indicado por `RELEASE_FILE`. Incluí identidad y contacto comercial, términos vigentes, aviso de privacidad y versión de la política. Para cada producto admisible, incluí `cents`, `version`, `approval` y `approvedBy`. `approval` identifica el expediente interno de revisión. `approvedBy` identifica a la persona responsable. Estos campos registran una decisión humana. Conservá el expediente, alcance, fuentes, licencia, fecha de verificación y vencimientos fuera del repositorio.
5. En Mercado Pago, creá una aplicación Checkout Pro con Preferencias. Configurá el evento **Payments** y la URL HTTPS `/webhooks/mercadopago`. Inyectá `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `MP_COLLECTOR_ID`. Preferí una aplicación y datos propios de prueba antes de introducir los de producción.
6. Para probar proveedor real, configurá `MP_MODE=test`, un origen HTTPS y email de prueba, y agregá un precio de prueba al servicio admisible en el archivo de lanzamiento. El botón indica el modo de prueba. Confirmá autenticidad de webhook, rechazo de monto incorrecto, reintentos, disponibilidad del PDF y conciliación de un reembolso. Para validar el aviso de entrega y verificación de correo prepará un dominio verificado en Resend y una instancia de preproducción controlada antes de habilitar tráfico.
7. En modo comercial `MP_MODE=live` exige HTTPS, clave de datos, configuración de Mercado Pago, archivos legales y credenciales `RESEND_KEY` y `MAIL_FROM`. Habilitá solo los productos aprobados para el alcance efectivamente implementado. El catálogo parte con compra desactivada para los 20. La aplicación no podrá habilitar mediante configuración los 13 productos que requieren ampliar el motor o el alcance autorizado.
8. Verificá `/health`, registro y correo en el dominio final, métricas, bloqueo de acceso cruzado, aviso de arrepentimiento, conciliación con Mercado Pago y una restauración de respaldo. Para SEO público, habilitá `INDEX_PUBLIC=1`, verificá Search Console y enviá el sitemap después de aprobar las fichas.

Documentación oficial: [Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/overview), [preferencias](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/create-payment-preference), [webhooks](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/payment-notifications), [Resend](https://resend.com/features/email-api).

### Operación y recuperación

- Consultá en Mercado Pago las operaciones que quedaron sin notificar, devoluciones y pagos múltiples asociados al pedido. Ejecutá `node --env-file=.env server.js conciliar <id-de-pago>` para reprocesar una transacción. El comando consulta directamente la API. Un retorno del navegador jamás acredita un pedido. La recepción repetida de un mismo pago no genera otro PDF ni duplica la métrica de compra.
- Ante un resultado ambiguo al crear una preferencia, el pedido queda en la bandeja de verificación y el servidor impide emitir otra preferencia para ese pedido. Buscá la referencia externa en Mercado Pago y confirmá si hubo cobro. Si se encuentra un pago, concilialo. Si el proveedor confirma que no hubo preferencia ni cobro, el cliente puede crear otro pedido. Los pagos excedentes aparecen en administración y su reintegro se gestiona en Mercado Pago.
- Programá copias cifradas con la API de backup de SQLite o con la instancia detenida. Conservá el conjunto coherente de archivos y respaldá por separado la clave de datos. Verificá restauraciones en otra instancia.
- Definí quién atiende pedidos, cómo se priorizan errores de correo y devoluciones y el procedimiento de acceso, rectificación o supresión de datos personales. La retención y la gestión de incidentes deben definirse con la empresa antes de admitir datos reales. Implementar recuperación automática de contraseña, borrado por política y alertas externas queda pendiente.
- Enganchá la facturación fiscal al circuito comercial antes de las ventas si corresponde. La plataforma de cobros y el informe PDF son componentes independientes de los comprobantes fiscales.

## Estado de entrega

Repositorio local ejecutable y sin despliegue comercial. El conector de la API de Mercado Pago, la verificación de cuenta por correo y el aviso de informe están implementados. La integración externa end-to-end requiere credenciales, infraestructura y pruebas con cuentas autorizadas. Las fuentes públicas documentadas son referencias de consulta. Cada acceso automatizado o gestión por cuenta de terceros requiere un permiso y una implementación específicos.
