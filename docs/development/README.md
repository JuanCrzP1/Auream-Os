# Desarrollo local

## Requisitos

Node.js y npm en el PATH. Nada más.

## Arranque rápido

**Windows** — doble clic sobre `scripts\dev\start.bat`, o desde terminal:

```
scripts\dev\start.bat
```

**macOS / Linux:**

```bash
./scripts/dev/start.sh
```

El launcher hace, en orden:

1. instala dependencias del backend si falta `node_modules`;
2. instala dependencias de `apps/web` si faltan;
3. valida TypeScript del backend;
4. compila el backend;
5. compila el frontend;
6. arranca la API en `http://localhost:3100`;
7. arranca Vite en `http://localhost:5173`;
8. abre el navegador.

Ambos launchers se sitúan solos en la raíz del repositorio, así que funcionan invocados desde cualquier directorio.

En Windows, API y frontend se abren en ventanas separadas. En Unix quedan en segundo plano, con logs en `.runtime/api.log` y `.runtime/builder.log`, y el script imprime los PID.

## Self-test

Valida la cadena completa —dependencias, typecheck y ambos builds— sin abrir ventanas ni navegador:

```
scripts\dev\start.bat --self-test
./scripts/dev/start.sh --self-test
```

Útil antes de integrar cambios.

## Comandos

| Comando | Efecto |
|---|---|
| `npm run check` | Typecheck del backend |
| `npm run check:web` | Typecheck del frontend |
| `npm run build` | Compila el backend a `dist/` |
| `npm run build:web` | Compila el frontend a `apps/web/dist/` |
| `npm run start:api` | Arranca la API compilada |
| `npm run start:worker` | Arranca el worker |
| `npm run dev:web` | Frontend en modo desarrollo con recarga |
| `npm test` | Tests del backend |
| `npm run test:web` | Tests del frontend |
| `npm run test:watch` | Tests del backend en modo watch |

## Variables de entorno

### Backend

| Variable | Obligatoria | Descripción |
|---|---|---|
| `JWT_SECRET` | Sí | Secreto de firma, mínimo 32 caracteres. La API no arranca sin él. |
| `CORS_ALLOWED_ORIGINS` | Sí en producción | Orígenes permitidos, separados por comas. En desarrollo cae a `localhost:5173`. |
| `PORT` | No | Puerto de la API. Por defecto `3100`. |
| `DEV_API_KEY` | No | API key de desarrollo. Sin ella, la API no acepta autenticación por API key. |
| `DEV_TENANT_ID` | No | Tenant de la API key de desarrollo. Por defecto `test-tenant`. |
| `DATA_DIR` | No | Directorio de persistencia JSON. |

### Frontend

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_API_BASE_URL` | Sí en producción | URL de la API. En desarrollo cae a `http://localhost:3100`. |
| `VITE_DEV_API_KEY` | No | Debe coincidir con `DEV_API_KEY`. Sólo se lee en modo desarrollo. |

Los launchers definen un `JWT_SECRET` de desarrollo si no existe. **Nunca** debe usarse fuera de local.

Los secretos van en un `.env` local, que está ignorado por git. No se versionan.

## Autenticación en desarrollo

**No hay ninguna credencial hardcodeada en el repositorio.**

Para autenticarte en local, define el mismo valor en las dos variables:

```bash
DEV_API_KEY=bfk_desarrollo-local       # backend
VITE_DEV_API_KEY=bfk_desarrollo-local  # frontend
```

**El prefijo `bfk_` es obligatorio:** `ApiKeyVerifier` rechaza cualquier clave sin él. La API valida el formato al arrancar y no se levanta si es incorrecto, en lugar de dejarte depurar un `401` opaco.

El backend registra esa API key contra `DEV_TENANT_ID`; el frontend la envía en `X-Api-Key`. Si no las defines, el frontend no manda credencial y la API responde `401`.

**Protecciones activas:**

- La API **se niega a arrancar** si `DEV_API_KEY` está definida con `NODE_ENV=production`.
- `getDevApiKey()` lee la variable dentro de `import.meta.env.DEV`, así que un build de producción **no contiene** el valor.
- En producción `CORS_ALLOWED_ORIGINS` es obligatorio; no existe `Access-Control-Allow-Origin: *`.

Debe retirarse cuando exista identidad real, no antes.

## Datos locales

Los workspaces del builder se guardan en `data/builder-workspaces/<tenantId>/`, escritos por la API. Es datos de runtime, ignorado por git.

Borrar ese directorio deja la aplicación sin automatizaciones guardadas, pero no la rompe: se regenera al crear un flow nuevo.

Los fixtures de prueba viven en `tests/fixtures/` y son otra cosa. No deben mezclarse.

## Tests

```bash
npm test          # backend  — 207 tests
npm run test:web  # frontend — 77 tests
```

Backend: `tests/{contract,security,unit,fixtures}`. `tests/contract/` protege las fronteras: forma de la API, paridad de validación y contratos de grafo. Los fixtures de flow viven uno por archivo en `tests/fixtures/flows/`, y los helpers compartidos en `tests/security/helpers/` y `tests/unit/helpers/`.
Frontend: `apps/web/tests/{components,hooks,routing,services,unit}`.

Un test que falla tras mover archivos casi siempre es una ruta rota, no un fallo funcional: corrige la ruta, nunca el test.

## Verificación de arquitectura

Antes de integrar, las comprobaciones de [`../architecture/dependency-rules.md`](../architecture/dependency-rules.md) deberían dar cero. Son cuatro greps y tardan un segundo.

## Troubleshooting

**La API no arranca y sale `[FATAL] JWT_SECRET no está definido`.**
Define la variable o usa el launcher, que la establece por ti.

**El frontend carga pero no muestra automatizaciones.**
Comprueba que la API responde: `curl http://localhost:3100/health`. Si devuelve `401` en `/automations`, `DEV_API_KEY` y `VITE_DEV_API_KEY` no coinciden, o no están definidas.

**El navegador bloquea las llamadas por CORS.**
El origen del frontend no está en `CORS_ALLOWED_ORIGINS`. En desarrollo se permite `http://localhost:5173` por defecto; si Vite eligió otro puerto, añádelo a la variable.

**El login falla con "Esta dirección no está autorizada para iniciar sesión".**
Estás abriendo la aplicación por `http://127.0.0.1:5173`. Neon Auth sólo confía en `localhost`, así que rechaza ese origen con `INVALID_ORIGIN`. Abre `http://localhost:5173`. Es el único origen de desarrollo soportado, a propósito: ver [`../architecture/auth.md`](../architecture/auth.md).

**El puerto 3100 o 5173 está ocupado.**
Cambia `PORT` para la API. Vite elige otro puerto automáticamente y lo anuncia.

**Un directorio no se deja mover o borrar en Windows.**
Un servidor de desarrollo o el editor mantiene un handle abierto. Cierra ambos y repite.

**Tras cambiar de rama, fallos de tipos raros.**
Borra `dist/` y `apps/web/dist/` y recompila; son artefactos generados y no se versionan.
