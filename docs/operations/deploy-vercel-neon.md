# Producción: Vercel + Neon

Toda la plataforma vive en **un proyecto de Vercel** (web + API) y **una base de Neon** (rama de producción). La rama `test` de Neon es solo para pruebas internas y nunca recibe datos de clientes.

```
https://<dominio>/            → la web (apps/web, estática)
https://<dominio>/api/*       → la API (función de Vercel `api/index.ts`, mismo código que el servidor local)
                                 └─ Neon: rama de producción (base + Neon Auth)
```

Cada push a `main` despliega solo. El build (`scripts/vercel/build.mjs`):

1. **Revisa la configuración.** Si falta una variable obligatoria, o hay una de desarrollo (`DEV_API_KEY`, `VITE_DEV_API_KEY`, `INTEGRATIONS_ALLOW_PRIVATE_NETWORK`), detiene el despliegue y la versión anterior sigue funcionando.
2. **Aplica las migraciones** a la rama de producción. Solo si `DATABASE_URL` apunta de verdad al host de producción: si apunta a `test`, aborta.
3. **Construye la web** apuntando a `/api` (mismo dominio, sin CORS entre web y API).

## Configuración inicial (una sola vez)

### 1. Proyecto de Vercel `auream-os`

*Settings → Build and Deployment*

- **Root Directory:** vacío (la raíz del repositorio). `vercel.json` está en la raíz.
- **Framework Preset:** Other. El comando de instalación, el de build y la carpeta de salida salen de `vercel.json`: no los sobrescribas en el panel.

### 2. Variables de entorno

*Settings → Environment Variables → entorno **Production***. Marca como **Sensitive** las que lo indiquen.

| Variable | Valor | Sensitive |
|---|---|---|
| `DATABASE_URL` | Neon → rama **production** → *Connect* → connection string **pooled** (host con `-pooler`) | Sí |
| `NEON_AUTH_URL` | Neon → rama production → *Auth* → URL de Neon Auth (termina en `/neondb/auth`) | No |
| `NEON_AUTH_ISSUER` | La misma URL sin `/neondb/auth` (termina en `.neon.tech/`) | No |
| `VITE_NEON_AUTH_URL` | El mismo valor que `NEON_AUTH_URL` | No |
| `CORS_ALLOWED_ORIGINS` | `https://<dominio>` (p. ej. `https://auream-os.vercel.app`) | No |
| `CREDENTIALS_ENCRYPTION_KEY` | Genera una en tu terminal: `openssl rand -base64 32` | Sí |
| `NODEJS_HELPERS` | `0` (la API lee el cuerpo de las peticiones ella misma; vale para **todas** las funciones: una función que use un manejador web de una librería lo sirve con `webHandlerOnNode`, como el consumidor de los despertadores) | No |

- **`CREDENTIALS_ENCRYPTION_KEY`** cifra las claves de IA de tus clientes. Guárdala también en tu gestor de contraseñas: si se pierde, las conexiones de IA guardadas ya no se pueden leer y cada cliente tendría que volver a pegar su clave.
- **No** agregues en Production: `DEV_API_KEY`, `VITE_DEV_API_KEY` ni `INTEGRATIONS_ALLOW_PRIVATE_NETWORK`.
- Las credenciales **nunca** se pegan en un chat, en un issue ni en el repositorio: solo en el panel de Vercel.

### 3. Neon Auth: dominio de confianza

Neon → rama production → *Auth* → *Domains* → agrega `https://<dominio>`. Sin esto el inicio de sesión responde `INVALID_ORIGIN`.

### 4. Desplegar

Haz push a `main`, o en Vercel → *Deployments* → *Redeploy*. En el registro del build debes ver:

```
→ Migraciones: rama de producción
  aplicada: 004_automations.sql …
→ Web
```

## Verificar

1. `https://<dominio>/api/health` → `{"status":"ok"}`.
2. Inicia sesión con tu cuenta. La primera vez se crea tu espacio de trabajo.
3. Crea un flujo, recarga la página: sigue ahí (está en PostgreSQL de producción).
4. Contactos, Integraciones y la IA funcionan contra la misma base.

Si algo falla: Vercel → *Deployments* → el despliegue → *Logs* (build) o *Functions* (API). Los mensajes de configuración dicen exactamente qué falta y nunca incluyen secretos.

## Estado actual (2026-11-08)

- **Production** (`https://auream-os.vercel.app`) → Neon rama `production`: base con las migraciones 001–007, Neon Auth con el dominio de confianza registrado, clave de cifrado propia.
- **Preview** (despliegues de ramas y PR) → Neon rama `test`: su base (el build migra `test` con `TEST_DATABASE_URL`), su Neon Auth y otra clave de cifrado. Una vista previa nunca toca datos reales. Para iniciar sesión en una URL de vista previa hay que agregar ese dominio en Neon Auth de la rama `test`.
- **Archivos (Vercel Blob), separados igual:** `auream-media-produccion` → Production; `auream-media-pruebas` → Preview y Development. Vercel pone en cada entorno su `BLOB_READ_WRITE_TOKEN`; el build de producción lo exige.
- Ninguna variable de desarrollo (`DEV_API_KEY`, `VITE_DEV_API_KEY`, `DEV_TENANT_ID`, `DATA_DIR`, `PORT`, `NODE_ENV`) existe en Production ni en Preview.

## Archivos de los mensajes (Vercel Blob)

Imágenes, videos, audios y documentos de los bloques no pasan por la API (las funciones de Vercel no aceptan cuerpos grandes):

1. `POST /api/media/uploads` → el servidor valida tipo y tamaño (los límites de WhatsApp) y entrega un **permiso de un solo uso** para UNA ruta dentro de la carpeta de la cuenta (`tenants/<cuenta>/media/<id>/<nombre>`), con vencimiento.
2. El navegador sube los bytes **directo a Vercel Blob** con ese permiso.
3. `POST /api/media` → el servidor mira lo que REALMENTE quedó en Blob (tipo y tamaño), lo registra en `media_assets` (Neon) o lo borra si no cumple. El bloque guarda la URL pública.

Si se crea un almacén nuevo: Vercel → *Storage* → *Blob* → crear y conectar al proyecto en el entorno que corresponda (o `vercel blob create-store <nombre> --access public --environment production`). En desarrollo, sin token, la API guarda en `data/media` y sirve los archivos ella misma.

## Lectura de comprobantes (OCR)

El bloque «Comprobante automático» lee las imágenes en la propia función, sin servicios externos: `sharp` (binario de Linux que instala `npm ci` en el build) y Tesseract en WebAssembly con el modelo de español del paquete `@tesseract.js-data/spa`. Como Tesseract carga sus archivos por ruta, `vercel.json` los añade a la función con `includeFiles` (solo las variantes LSTM, ~25 MB). No hay variables que configurar. La primera lectura de una instancia tarda un poco más (arranca el motor); las siguientes, ~0,3 s.

## WhatsApp por código QR (uazapi)

Vercel no puede mantener abierta una sesión de WhatsApp Web, así que la mantiene **uazapi** (como hace Leona). Auream crea una instancia por conexión (`auream-<id>`), muestra su QR, consulta el estado mientras se escanea y recibe los avisos de conexión en `POST /api/webhooks/uazapi`. El aviso solo cambia algo si trae el token de esa instancia; los tokens se guardan cifrados con `CREDENTIALS_ENCRYPTION_KEY`.

Variables (Production; en Preview, las de un servidor de pruebas si se quiere probar ahí):

- `UAZAPI_BASE_URL` — `https://<tu-subdominio>.uazapi.com` (sin barra final).
- `UAZAPI_ADMIN_TOKEN` — token de administrador del servidor (**Sensitive**).
- `WHATSAPP_WEBHOOK_BASE_URL` — opcional: en producción se usa `https://<dominio oficial>/api`.

Sin ellas, las conexiones por QR se crean y la pantalla dice que falta el proveedor.

## Una sola dirección oficial

Cada despliegue de Vercel responde en varias direcciones (la oficial, la del equipo, la de la rama y la propia del despliegue). Neon Auth solo acepta iniciar sesión desde la oficial. Por eso el build de producción le da a la web su dirección oficial (`VITE_APP_URL`, sacada de `VERCEL_PROJECT_PRODUCTION_URL`) y la web lleva ahí, antes de pintar nada, a quien entre por cualquier otra, conservando la ruta.

Al conectar un dominio propio (p. ej. `app.auream.com`) en Vercel como dominio de producción, pasa a ser la dirección oficial solo. Hay que agregarlo también en Neon Auth (rama production → *Auth* → *Domains*) y en `CORS_ALLOWED_ORIGINS`.

## Límites conocidos de este modelo

- **Funciones efímeras.** Los límites de uso («Probar» integración o IA) cuentan por instancia de función, no globalmente. Suficiente para empezar; si hace falta exactitud, se mueven a la base.
- **WhatsApp (FASE D).** La API oficial de Meta (Cloud API, webhooks) encaja con Vercel. Conectar por **QR / WhatsApp Web** necesita un proceso siempre encendido con un socket abierto, y eso **no** es posible en funciones de Vercel. Se decidirá al llegar a la FASE D.
