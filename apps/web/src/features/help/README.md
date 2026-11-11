# Ayuda — módulo web (`/help`)

El Centro de ayuda. El panel de ayuda de cada pantalla (solo ayuda, con buscador; se abre desde la diadema de soporte, «Ayuda de esta pantalla») vive en `shared/help`, porque los usa toda la app (`AppShell`). Diseño: [`docs/architecture/help.md`](../../../../../docs/architecture/help.md).

## Estructura
```
features/help/
├── pages/      HelpPage, con las vistas en `?article=`, `?module=`, `?view=videos|admin`
├── home/       buscador, «Empieza aquí», módulos, videos, lo más leído, novedades, banner de contacto (solo si hay WhatsApp o correo)
├── article/    el artículo (Markdown seguro, sin HTML crudo), el índice que sigue la lectura, «Más del módulo», anterior/siguiente, «¿Te sirvió?» y la lista de un módulo
├── tutorials/  los tutoriales y el reproductor (YouTube sin cookies o Vimeo)
└── admin/      solo el equipo de Auream: tutoriales y datos de contacto
shared/help/    helpApi, el panel de ayuda de cada pantalla (HelpPanel, abierto con `openHelpPanel`), sus íconos, la búsqueda y el módulo de cada pantalla
```
