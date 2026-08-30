# Autenticación, identidad y tenancy

Quién eres lo decide Neon Auth. Dónde estás y qué puedes hacer lo decide esta
plataforma. Esa frontera es el eje de todo este documento.

## Reparto de responsabilidades

| Responsabilidad | Dueño |
|---|---|
| Registro, login, contraseñas, OAuth | Neon Auth |
| Sesión (crear, restaurar, revocar) | Neon Auth |
| Verificación de email | Neon Auth |
| **Recuperación y cambio de contraseña** | Neon Auth |
| **Tokens de recuperación (emisión, caducidad, un solo uso)** | Neon Auth |
| **Envío del correo de recuperación** | Neon Auth |
| Emisión de JWT y JWKS | Neon Auth |
| **Verificación del JWT** | `platform/identity/application/JwksTokenVerifier` |
| **Tenant** | `platform/tenancy` + tabla `tenants` |
| **Membership** | `domains/team` + tabla `memberships` |
| **Rol y scopes** | `platform/authorization` (`ROLE_SCOPES`) |
| **Autorización de recursos** | `platform/authorization` (guards y policies) |

`neon_auth.organization`, `member` e `invitation` **no se usan**: su `role` es
texto libre y no puede expresar nuestros scopes tipados. El plugin está
desactivado en ambas ramas para que no exista un segundo sistema de organizaciones.

## Cadena completa

```
USUARIO
  ↓ login / register        Neon Auth (cookie de sesión en su dominio)
SESIÓN
  ↓ GET /token               JWT EdDSA, 15 min de vida
JWT
  ↓ JwksTokenVerifier        firma + alg + kid + iss + aud + exp + iat
UserIdentity { actorId }     ← lo ÚNICO que aporta el token
  ↓ resolveRequestContext
MEMBERSHIP                   memberships(user_id, tenant_id, status='active')
  ↓
ROLE → ROLE_SCOPES → SCOPES  derivados en servidor, nunca del token
  ↓
RequestContext               { tenantId, actorId, authMethod, requestId, scopes }
  ↓
guards / policies            requireScope, requireRole, requireTenantAccess
  ↓
RECURSO
```

**Los scopes nunca viajan en el JWT.** Inyectarlos en los claims no tiene efecto:
el verificador no los lee. Consecuencia útil: revocar un rol surte efecto en la
petición siguiente, sin esperar a que caduque ningún token.

## Aislamiento entre ramas de Neon

Las ramas heredan la **misma clave JWKS** del padre: la firma no distingue
`production` de `test`. Lo que las separa es `iss`/`aud`, que contienen el
endpoint de cada rama.

Por eso `JwksTokenVerifier` valida issuer y audiencia **obligatoriamente**, con
el valor de un único entorno por proceso. Un token de test presentado a la API de
producción se rechaza con 401 aunque su firma sea criptográficamente válida.
Verificado contra la API real y fijado en `tests/security/jwtCrossBranch.test.ts`.

### Qué rama usa cada cosa

| | Rama | Uso |
|---|---|---|
| Desarrollo local y suite de integración | `test` | única rama que recibe datos de prueba |
| Despliegue real | `production` | **nunca** recibe pruebas automáticas |

`TEST_DATABASE_URL` y `TEST_NEON_AUTH_URL` son variables **propias**, sin
fallback a las de producción. Antes de abrir una conexión o crear un usuario,
`globalSetup` comprueba el **host real** de ambos destinos y aborta la suite
entera si no son los de la rama `test` — la comprobación es por host, no por el
nombre de la variable, así que una variable mal configurada se detecta igual.

Los usuarios que crea la suite llevan el prefijo `it-auth-` y se borran en
`afterAll` por ese prefijo, no por una lista en memoria: un fallo a mitad de
test no deja cuentas huérfanas.

## Configuración externa pendiente

Estos puntos no se pueden resolver desde el repositorio. Están abiertos:

| Bloqueador | Estado | Qué hace falta |
|---|---|---|
| Dominio de producción | **abierto** | Ningún dominio de confianza registrado en Neon Auth (ni en `test` ni en `production`). Con un dominio real, autenticar falla con `INVALID_ORIGIN`. Se registra con `neonctl neon-auth domain add` una vez exista el dominio. |
| Remitente de correo | **abierto** | Ambas ramas usan el proveedor compartido de Neon, de desarrollo. Producción necesita dominio verificado y SMTP propio, configurado **en Neon**, nunca en este repositorio. |
| Validación manual | **abierta** | Refresh de navegador, cerrar/abrir navegador y recepción real del correo de recuperación no están verificados de forma automática. |

Mientras el primero siga abierto, la aplicación **no puede autenticar en
producción**, por muy verde que esté la suite.

## Selección de tenant

El cliente envía `X-Tenant-Id`. Es una **selección**, no una afirmación: el
servidor la valida contra una membership activa antes de aceptarla.

| Situación | Respuesta |
|---|---|
| Membership activa en el tenant pedido | contexto resuelto |
| Sin membership en ese tenant | **403** |
| Sin cabecera y un solo tenant | se resuelve automáticamente |
| Sin cabecera y varios tenants | **400** — exige elegir |
| Sin ninguna membership | **403** |

Una credencial de máquina (`X-Api-Key`) trae su tenant de origen; la cabecera no
puede reasignarlo.

## Códigos de error

`401` sin identidad válida · `403` identidad válida sin acceso · `400` falta
seleccionar tenant. Los errores no exponen SQL, trazas ni tokens.

## Onboarding

`POST /me/onboarding` garantiza que el usuario tenga un tenant inicial. Es
**transaccional** (tenant y membership se crean juntos o ninguno) e
**idempotente** (repetirlo no duplica). El rol inicial es `tenant_owner`.

## Sesión en el frontend

La sesión vive en la cookie del proveedor; el JWT vive **sólo en memoria**
(`tokenStore`), nunca en `localStorage`, para no exponerlo a XSS. Al recargar, la
cookie restaura la sesión y se pide un token nuevo.

`tokenStore` sólo pide token si `AuthContext` ha confirmado que hay sesión: sin
esa comprobación cada petición dispararía una llamada de red inútil.

La cookie (`__Secure-…`, `HttpOnly`, `Secure`, `SameSite=None`, `Partitioned`)
dura 7 días, así que la sesión sobrevive a cerrar el navegador. Cerrar sesión la
invalida en el proveedor; si esa llamada falla, el estado local se limpia
igualmente — `AuthContext.signOut` nunca propaga el error, porque quien llama
todavía tiene que limpiar el tenant activo y navegar.

## Origen de confianza

Neon Auth rechaza con `INVALID_ORIGIN` toda petición cuyo `Origin` no confíe.
Hoy la confianza sale de `allow_localhost`, que cubre **`localhost` pero no
`127.0.0.1`** (verificado contra la rama `test`).

| Entorno | Origen | Estado |
|---|---|---|
| Desarrollo | `http://localhost:5173` | único origen soportado |
| Desarrollo | `http://127.0.0.1:5173` | **no soportado**: el login falla |
| Producción | *(sin dominio definido todavía)* | **sin dominios de confianza registrados** |

`CORS_ALLOWED_ORIGINS` de la API usa el mismo origen canónico a propósito: si
la API aceptara `127.0.0.1` y el proveedor no, la aplicación cargaría pero
nadie podría iniciar sesión, que es el fallo más difícil de diagnosticar.

Antes de desplegar a producción hay que registrar el dominio real con
`neonctl neon-auth domain add`. Sin ese paso, en producción no se puede ni
registrar ni iniciar sesión.

## Recuperación de contraseña

La plataforma **no** guarda contraseñas, tokens de recuperación ni hashes. No
existe tabla `password_reset` ni servicio propio de contraseñas: todo lo emite
y valida Neon Auth.

```
/login  →  ¿Olvidaste tu contraseña?
   ↓
/forgot-password        POST /request-password-reset
   ↓                    (correo enviado por Neon Auth)
enlace del correo
   ↓
/reset-password?token=  POST /reset-password
   ↓
/login con la contraseña nueva
```

Garantías, todas verificadas contra la rama `test` y fijadas en
`tests/integration/authPasswordLifecycle.test.ts`:

| Propiedad | Comportamiento |
|---|---|
| Caducidad del token | 60 minutos — *gestionado por Neon Auth* |
| Un solo uso | reutilizarlo devuelve `INVALID_TOKEN` — *gestionado por Neon Auth* |
| Contraseña anterior | deja de funcionar tras el cambio |
| Enumeración de cuentas | misma respuesta exista o no el email — *gestionado por Neon Auth* |
| Longitud mínima | 8 caracteres — *gestionado por Neon Auth*, replicada en `passwordPolicy` para avisar antes de enviar |
| Límite de tasa | el proveedor responde `429` si se piden demasiados enlaces |

`/reset-password` es una ruta **pública**: el usuario llega desde el correo sin
sesión, y la autoridad es el token, no una sesión nuestra.

El cambio de contraseña con sesión activa (`passwordClient.change`) ya existe
en el cliente y exige la contraseña actual; la pantalla de Configuración →
Seguridad que lo usará es de una fase posterior.

## Errores

`AuthRequestError` conserva `status`, `code` y `message`. Los mensajes se
deciden por **código**, no por status: el proveedor devuelve 400 tanto para
"contraseña corta" como para "token inválido", y 401 tanto para credenciales
incorrectas como para sesión ausente. Traducirlos por status hacía
indistinguible un registro rechazado de un login fallido.

`authErrorMessage` es el único punto que traduce, y nunca devuelve el mensaje
crudo del proveedor: podría filtrar detalles internos y no está traducido.

## Dónde vive cada cosa

| Pieza | Ubicación |
|---|---|
| Pantallas de auth | `apps/web/src/features/auth/pages/` |
| Formularios y campos | `apps/web/src/features/auth/components/` |
| Cliente de sesión e identidad | `apps/web/src/shared/auth/client/authClient.ts` |
| Cliente de contraseñas | `apps/web/src/shared/auth/client/passwordClient.ts` |
| Transporte y error tipado | `apps/web/src/shared/auth/client/authFetch.ts` |
| Traducción de errores | `apps/web/src/shared/auth/errors/authErrorMessage.ts` |
| Estado de sesión | `apps/web/src/shared/auth/context/AuthContext.tsx` |
| Acciones y estado de formularios | `apps/web/src/shared/auth/hooks/` |
| Protección de rutas | `apps/web/src/app/router/ProtectedRoute.tsx` |
| Verificación del JWT | `platform/identity/application/JwksTokenVerifier` |

## Correo

Ambas ramas usan el proveedor **compartido** de Neon (`auth@mail.myneon.app`),
pensado para desarrollo: lleva marca de Neon y no está dimensionado para
tráfico real. Producción necesitará un remitente propio
(`neonctl neon-auth config email-provider update`) con dominio verificado antes
de exponer la recuperación a usuarios reales. Las credenciales SMTP se
configuran en Neon, **nunca en este repositorio**.
