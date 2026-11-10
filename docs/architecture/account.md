# Cuenta: menú de la cuenta, Mi perfil y Configuración

`domains/profiles` · `domains/company` · `domains/media/application/ImageUploads.ts` · `028_account_profiles.sql` · `apps/api/routes/routeMyProfileRequest.ts` · `apps/api/routes/routeCompanyRequest.ts` · `infrastructure/persistence/sql/SqlTenantResolver.ts` · `apps/web/src/shared/account/` · `apps/web/src/features/account/`

## Qué resuelve

Lo que es de la persona (su foto, cómo se llama, su WhatsApp personal y su contraseña) y lo que es de la empresa (nombre, logo y zona horaria), con un lugar estándar para verlo: la **tarjeta de la cuenta**, abajo en la barra lateral, y su menú.

## La tarjeta y el menú de la cuenta

Abajo en la barra lateral, como en las apps con barra lateral (Slack, Linear, Notion, Vercel). Muestra la foto (o las iniciales), el nombre y la empresa activa. Al tocarla se abre hacia arriba, **de borde a borde de la barra lateral** (ni más angosto ni saliéndose; se extiende lo que mide el margen de la barra más su borde, `--app-sidebar-inset`):

```
(foto) Nombre            ⌄     ← la flecha baja (cierra) el menú
       correo de acceso
[logo] Empresa activa · rol  ›        ← abre Configuración → General; con varias empresas, «Cambiar a …»
──────────────────────
Mi perfil                     /settings/profile
Configuración                 /settings/general
──────────────────────
TEMA  [☀ Claro] [☾ Oscuro] [▭ Sistema]
Ayuda               Pronto    /help
──────────────────────
Cerrar sesión
```

- Lo del día a día queda en la barra; lo administrativo, en Configuración. El menú es corto (como Linear o Vercel): Equipo, Plan y pagos y Seguridad son secciones de Configuración, no opciones sueltas. Las opciones están en `app/navigation/account/account-menu-items.tsx`.
- **«Pronto»** (Ayuda): la opción ya se ve, pero su módulo llega después. Abre una página «Próximamente», en vez de mandar a otra pantalla sin avisar.
- **Al ancho de la barra**: las etiquetas largas bajan a un segundo renglón en vez de cortarse, y el tema pone el icono sobre el nombre.
- **Cerrar**: la flecha junto al nombre y el correo, Escape, elegir algo o tocar fuera: el menú baja y se desvanece (0,14 s; sin animación si el equipo pide menos movimiento) y el foco vuelve a la tarjeta. Al cambiar de página se quita enseguida.
- **Teclado**: el foco entra al menú; flechas, Inicio y Fin lo recorren.
- **Tema**: claro, oscuro o «sistema» (sigue al equipo y cambia solo con él). El script anti-parpadeo de `index.html` también entiende «sistema».
- `AccountProvider` (`shared/account/AccountContext.tsx`) carga el perfil y la empresa una vez y los comparte. Por eso cambiar la foto en Mi perfil la cambia al instante en la tarjeta. Un fallo pasajero se reintenta solo (2 s, 4 s y 8 s).

## Mi perfil (`/settings/profile`)

Una sola página, de arriba abajo: foto, datos personales, correo de acceso y contraseña (`features/account/components/ProfileSettings.tsx`).

| Dato | Dónde vive | Cómo se cambia |
|---|---|---|
| Foto | Almacén de medios (Vercel Blob) + `user_profiles.photo_*` | Subida con permiso a `users/<id>/photo/` |
| Nombre visible | `user_profiles.display_name` (nulo: el del registro en Neon Auth) | `PATCH /me/profile` |
| WhatsApp personal | `user_profiles.phone` (formato internacional) | `PATCH /me/profile`, con prefijo del país |
| Correo de acceso | Neon Auth | No desde la app (ver abajo) |
| Contraseña | Neon Auth | `passwordClient.change`: pide la actual y cierra las demás sesiones |

El perfil es del **usuario**, no de una empresa: el mismo en todas a las que pertenece. Las rutas `/me/profile*` exigen una identidad de usuario, y el `userId` sale de ella, nunca de la petición.

**Correo de acceso.** Es una credencial: su única autoridad es Neon Auth, que hoy responde `CHANGE_EMAIL_DISABLED` (verificado en la rama `test` el 2026-11-10) y no documenta cómo activarlo. Por eso se muestra sin editar, con la nota de que soporte lo cambia. Si Neon lo habilita, se agrega el flujo de confirmación por correo.

## Configuración (`/settings/:section`)

**A pantalla completa**, como Linear, Vercel o Stripe: la barra de la app se esconde y queda el menú de Configuración, con «← Volver a Auream» arriba, que regresa a la última pantalla de trabajo (`shared/navigation/lastAppLocation.ts`: la recuerda `AppShell` en la pestaña del navegador; nunca una de Configuración; sin nada guardado, el inicio).

```
← Volver a Auream
Configuración
TU CUENTA   Mi perfil · Apariencia
EMPRESA     General · Equipo · Plan y pagos (Pronto) · Seguridad (Pronto)
```

- **El marco** (`shared/ui/settings-layout/SettingsLayout.tsx`) no conoce ningún módulo: recibe los grupos, la sección activa (título y descripción del encabezado) y el contenido. En celular el menú pasa arriba.
- **Las secciones** las arma la app (`app/settings/settings-sections.tsx` y `SettingsScreen.tsx`, que dice qué módulo pone cada contenido): Cuenta no importa a Equipo ni al revés. Un módulo nuevo con ajustes propios (Ventas: monedas; CRM: etapas; Plan y pagos en la FASE F) suma su entrada ahí. Una sección que no existe lleva a General.
- **Direcciones de antes**: `/settings` y `?tab=team|appearance`, `/profile`, `/team` y `/billing` llevan a su sección.
- **Apariencia**: el tema, con una vista previa de cada opción (el mismo del menú). **Equipo**: [`team.md`](team.md).

**General** (la empresa): nombre, logo y zona horaria de la cuenta activa (`tenants.name`, `logo_*`, `timezone`). Todo el equipo los ve; solo los dueños los cambian (`tenant.manage`, `CompanyPermissions`). Quien no es dueño ve la página sin poder editar.

**La zona horaria rige los flujos.** El motor resuelve cada cuenta con `SqlTenantResolver`: la zona que eligió la empresa o, si no eligió, la de la plataforma (`DEFAULT_TENANT_TIMEZONE`). La recuerda 30 s por instancia, así que un cambio llega a los flujos en menos de medio minuto, sin una consulta por turno. Si la base no responde, sigue con la última conocida. La usan el Programador, los horarios, las fechas de los bloques, el Laboratorio y «Probar» del comprobante.

## Imágenes (foto y logo)

`ImageUploads` tiene las mismas garantías que los medios de los bloques:

1. `POST …/uploads`: valida tipo (JPG, PNG o WebP) y tamaño (5 MB) y da un permiso de un solo uso para UNA ruta nueva dentro de la carpeta del dueño (máximo 20 por minuto).
2. El navegador sube los bytes directo al almacén (`shared/media/putToStorage.ts`, el mismo de los medios).
3. `PUT …`: el servidor mira lo que REALMENTE quedó (si no es imagen o pesa de más, lo borra) y lo guarda.

Al cambiar la imagen, se borra la anterior. Nada fuera de la carpeta del dueño se acepta ni se borra.

## API

| Ruta | Quién | Para qué |
|---|---|---|
| `GET /me/profile` | El usuario | Su perfil |
| `PATCH /me/profile` | El usuario | Nombre visible, WhatsApp personal |
| `POST /me/profile/photo/uploads` · `PUT` · `DELETE /me/profile/photo` | El usuario | Su foto |
| `GET /company` | Todo el equipo | Nombre, logo, zona (y `canEdit`) |
| `PATCH /company` | `tenant.manage` | Nombre y zona horaria |
| `POST /company/logo/uploads` · `PUT` · `DELETE /company/logo` | `tenant.manage` | El logo |

Sin almacén de archivos, las rutas de imágenes responden 503; el resto funciona igual.

## Pruebas

`tests/unit/accountProfiles.test.ts`, `tests/unit/sqlTenantResolver.test.ts`, `tests/security/routeAccount.test.ts`, `tests/integration/accountPersistence.test.ts` (PostgreSQL real), `apps/web/tests/components/AccountMenu.test.tsx`, `apps/web/tests/components/AccountPages.test.tsx`, `SettingsScreen.test.tsx` y `apps/web/tests/unit/accountHelpers.test.ts`.
