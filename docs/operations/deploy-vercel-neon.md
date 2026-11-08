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
| `NODEJS_HELPERS` | `0` (la API lee el cuerpo de las peticiones ella misma) | No |

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

## Límites conocidos de este modelo

- **Funciones efímeras.** Los límites de uso («Probar» integración o IA) cuentan por instancia de función, no globalmente. Suficiente para empezar; si hace falta exactitud, se mueven a la base.
- **WhatsApp (FASE D).** La API oficial de Meta (Cloud API, webhooks) encaja con Vercel. Conectar por **QR / WhatsApp Web** necesita un proceso siempre encendido con un socket abierto, y eso **no** es posible en funciones de Vercel. Se decidirá al llegar a la FASE D.
