# Ayuda, documentación y soporte

**Ayuda** (`/help`) es el Centro de ayuda. Además, cada pantalla tiene su **ayuda** (se abre desde la diadema de soporte, «Ayuda de esta pantalla»), y la **documentación** sirve también a los agentes de IA (MCP) y a los modelos de lenguaje (`/llms.txt`).

| Pieza | Dónde vive |
|---|---|
| Artículos | `content/help/<módulo>/<slug>.md`: una sola fuente para la app, el MCP y `llms.txt` |
| Dominio | [`domains/help`](../../domains/help/README.md) |
| API | `apps/api/routes/routeHelpRequest.ts` (con sesión) y `routeHelpDocs.ts` (pública) |
| MCP | `apps/api/mcp/tools/helpTools.ts` |
| Web | `apps/web/src/features/help`; el panel de ayuda de cada pantalla en `apps/web/src/shared/help` (se abre desde la diadema de soporte, «Ayuda de esta pantalla»: no hay botón flotante que tape la pantalla) |

## Por qué así

Los centros de ayuda modernos coinciden en cuatro cosas:
- las categorías siguen el mismo menú del producto;
- el buscador va primero;
- la ayuda está dentro de la app, junto a la pantalla donde surge la duda;
- cada artículo se lee cómodo: índice que sigue la lectura, los demás artículos del módulo y anterior/siguiente.

Hoy la documentación también la leen agentes de IA, así que los mismos artículos se publican para ellos.

## Artículos

- Son Markdown con metadatos: título, módulo, resumen, orden, fecha, palabras clave y relacionados. El formato está en `content/help/README.md`.
- Se versionan con el código, así que cada versión de Auream trae su ayuda al día.
- El lector de la web convierte el Markdown en elementos de React, sin HTML crudo. Entiende títulos con ancla, pasos numerados, avisos (`> **Importante:** …`), tablas y enlaces entre artículos.
- **La guía para agentes** (`content/help/agentes/guia-para-agentes.md`, módulo `agentes`) no sale en el Centro de ayuda. Explica:
  - qué es cada módulo y cómo se relacionan;
  - las reglas que un agente no puede romper;
  - qué herramienta usar para cada tarea.

## Para agentes y modelos

- **MCP:** tres herramientas sin permiso, porque no tocan datos de la cuenta:
  - `read_platform_guide`: la guía para agentes;
  - `search_help`: buscar en la documentación;
  - `read_help_article`: leer un artículo.

  Las instrucciones del servidor piden leer la guía antes de cambiar algo.
- **`GET /llms.txt`:** el índice estándar, con la guía primero y cada artículo por módulo.
- **`GET /api/help/docs/<slug>.md`:** cada artículo en Markdown, público.

En Vercel, `/llms.txt` se reescribe a la API y `content/help/**` viaja con la función (`vercel.json`).

## Tutoriales en video

- El equipo de Auream pega el enlace de **YouTube (no listado) o Vimeo**, con título, módulo, duración, el artículo donde aparece y si va destacado. Puede guardarlo como borrador o publicarlo para todas las cuentas.
- Se reproducen dentro de Auream: YouTube sin cookies (`youtube-nocookie.com`) o el reproductor de Vimeo.
- Cada persona deja marcado lo que vio («✓ Visto»), y el equipo ve las vistas.
- Aparecen en tres lugares: el Centro de ayuda, el panel de ayuda del módulo y dentro del artículo.
- Si un módulo no tiene videos, no aparece ningún espacio vacío.

## Soporte

- Ni el artículo ni el panel de ayuda muestran soporte: son solo ayuda.
- **La diadema**, debajo de la tarjeta de la cuenta, abre al lado del menú «¿Necesitas ayuda?»: WhatsApp, correo, horario y tiempo de respuesta. Si aún no están configurados, lo dice y deja el Centro de ayuda.
- **Banner** solo en la portada del Centro de ayuda, con WhatsApp y correo, y solo si el equipo de Auream los configuró (WhatsApp, correo, horario y tiempo de respuesta en «Administrar ayuda»).
- **Casos de soporte:** la web ya no los ofrece. La API y la tabla `support_cases` siguen (`/help/support/cases`), sin pantalla, por si se retoman.

## «Empieza aquí»

Seis pasos que se marcan solos porque se leen de los datos de la cuenta (`SqlOnboardingProbe`):
1. número conectado;
2. un flujo;
3. productos;
4. más de una persona en el equipo;
5. Meta Ads;
6. una difusión.

## Permisos

- **Toda persona con sesión** lee, busca, ve videos y opina.
- **El equipo de Auream** administra con `help.manage`, que es solo del rol `platform_admin`. Lo usa para:
  - publicar tutoriales;
  - configurar los datos de contacto.
- Las páginas públicas (`/llms.txt` y `/api/help/docs/*.md`) no llevan datos de ninguna cuenta.

## Datos

`036_help.sql` es aditiva y crea:
- `help_tutorials`
- `help_tutorial_views`
- `help_feedback`
- `support_cases`
- `platform_settings`

## Pruebas

**Backend:**
- `tests/unit/helpRules.test.ts`: incluye que todos los artículos se lean y que sus relacionados existan.
- `tests/security/routeHelp.test.ts`
- `tests/integration/helpPersistence.test.ts` (PostgreSQL real)

**Web:**
- `apps/web/tests/components/HelpPage.test.tsx`
