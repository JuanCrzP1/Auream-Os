# help — ayuda, documentación y soporte (bounded context)

Opción del menú de la cuenta: **Ayuda** (`/help`), más el botón «?» de cada pantalla. Web: `apps/web/src/features/help/` y `apps/web/src/shared/help/`. Diseño: [`docs/architecture/help.md`](../../docs/architecture/help.md).

## Responsabilidad
Que cada persona (y cada agente de IA) entienda Auream sin preguntar, y que llegar a soporte sea fácil.

## Le pertenece
- Los artículos (Markdown en `content/help`), su búsqueda y «¿Te sirvió?».
- Los tutoriales en video que publica el equipo de Auream.
- Los casos de soporte y cómo contactar a soporte.
- «Empieza aquí»: qué ya hizo la cuenta.

## No le pertenece
- Reproducir los videos: YouTube o Vimeo (solo se guarda el enlace).
- Los datos que mira «Empieza aquí»: los lee por un puerto (`OnboardingProbe`).

## Capas
- `domain/Article.ts`: el formato de un artículo, las secciones y la búsqueda.
- `domain/HelpRules.ts`: los enlaces de video que se aceptan, los casos y los datos de soporte.
- `application/HelpServices`, `TutorialServices` y `SupportServices`. Los puertos van en `HelpPorts.ts`.
- Infraestructura:
  - `infrastructure/help/MarkdownArticleLibrary.ts`
  - `infrastructure/persistence/sql/SqlHelpTutorials.ts`, `SqlSupport.ts` y `SqlOnboardingProbe.ts` (`036_help.sql`)
