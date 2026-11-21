# Salir online en una hora

Guía corta para publicar Gestión Clara el día que tengas servidor, dominio y credenciales. El detalle técnico completo está en el README.

## Lo que necesitás tener antes

| Qué | Para qué | Dónde se carga |
| --- | --- | --- |
| Un servidor con disco persistente (VPS o plataforma con volumen) | Correr el proceso y guardar la base SQLite | Volumen montado en `/data` |
| Un dominio con HTTPS | URL pública y requisito de Mercado Pago | `PUBLIC_ORIGIN` |
| Credenciales de Mercado Pago (Checkout Pro) | Cobrar | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_COLLECTOR_ID` |
| Cuenta de Resend con el dominio verificado | Mandar el enlace del PDF por correo | `RESEND_KEY`, `MAIL_FROM` |
| Textos legales aprobados y datos del titular | Términos, privacidad, pie con CUIT | `release.json` (partí de `release.borrador.json`) |
| Clave de cifrado | Cifrar reclamos y PDF | `DATA_KEY` (`openssl rand -hex 32`); guardala aparte |

## Pasos

1. Completá `release.json` a partir de `release.borrador.json`: sacá los corchetes, poné el precio en centavos y, para cada servicio aprobado, `version`, `approval` y `approvedBy`.
2. Armá el `.env` con las variables de la tabla, más `MP_MODE=test`, `ADMIN_EMAIL`, `RELEASE_FILE=/config/release.json` y `RETENTION_DAYS=365`.
3. Construí y corré la imagen:

   ```sh
   docker build -t gestion-clara .
   docker run -d --name gestion-clara --restart unless-stopped \
     --env-file .env -p 127.0.0.1:3000:3000 \
     -v gestion-clara-data:/data -v "$PWD/release.json:/config/release.json:ro" \
     gestion-clara
   ```

4. Poné un proxy con HTTPS adelante (Caddy es lo más simple: `tu-dominio.com.ar { reverse_proxy 127.0.0.1:3000 }`).
5. Creá la cuenta de administración: `docker exec -i gestion-clara node server.js admin` y escribí la contraseña.
6. En Mercado Pago, configurá el webhook de **Payments** a `https://tu-dominio.com.ar/webhooks/mercadopago`.
7. Prueba en modo test: comprá un reclamo con un usuario de prueba de Mercado Pago, verificá que llegue el correo y que el PDF se descargue. Revisá el panel en `/admin`.
8. Pasá a `MP_MODE=live` con las credenciales de producción y repetí una compra real de bajo monto.

## Respaldos

```sh
docker exec gestion-clara node server.js respaldo /data/respaldo-$(date +%F).sqlite
```

Copiá ese archivo fuera del servidor (por ejemplo, una vez por día con cron). La `DATA_KEY` se guarda en otro lugar: sin ella el respaldo no sirve, y con ella cualquiera lee los reclamos.

## Después de salir

- `INDEX_PUBLIC=1` para que Google indexe, y enviá `https://tu-dominio.com.ar/sitemap.xml` en Search Console.
- Mirá el embudo en `/admin` cada semana: qué páginas de caso traen visitas y cuáles convierten.
