# Ayuda — módulo web (`/help`)

El Centro de ayuda. El botón «?» de cada pantalla y el formulario de soporte viven en `shared/help`, porque los usa toda la app (`AppShell`). Diseño: [`docs/architecture/help.md`](../../../../../docs/architecture/help.md).

## Estructura
```
features/help/
├── pages/      HelpPage, con las vistas en `?article=`, `?module=`, `?view=videos|support|admin`
├── home/       buscador, «Empieza aquí», módulos, videos, lo más leído, novedades, banner de soporte
├── article/    el artículo (Markdown seguro, sin HTML crudo), el índice, «¿Te sirvió?» y la lista de un módulo
├── tutorials/  los tutoriales y el reproductor (YouTube sin cookies o Vimeo)
└── admin/      solo el equipo de Auream: tutoriales, casos de soporte y datos de contacto
shared/help/    helpApi, el panel «?» (HelpPanel), SupportForm y el módulo de cada pantalla
```
