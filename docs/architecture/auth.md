# Autenticación, identidad y tenancy

Quién eres lo decide Neon Auth. Dónde estás y qué puedes hacer lo decide esta
plataforma. Esa frontera es el eje de todo este documento.

## Reparto de responsabilidades

| Responsabilidad | Dueño |
|---|---|
| Registro, login, contraseñas, OAuth | Neon Auth |
| Sesión (crear, restaurar, revocar) | Neon Auth |
| Verificación de email | Neon Auth |
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
