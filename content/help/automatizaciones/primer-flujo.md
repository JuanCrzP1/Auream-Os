---
title: Crear tu primer flujo de bienvenida
module: automatizaciones
summary: Un flujo que saluda, muestra lo que vendes y deja al cliente listo para comprar.
order: 1
updated: 2026-11-11
keywords: flujo, bienvenida, crear, automatización, editor
related: las-13-herramientas, laboratorio-de-pruebas, disparadores
---

Un **flujo** es un recorrido de bloques que responde solo por WhatsApp. Se guarda mientras lo armas: lo guardado es lo que corre.

## Pasos

1. Entra a **Automatizaciones** y toca **+ Nuevo flujo**. Ponle un nombre, por ejemplo «Bienvenida».
2. Agrega un bloque **Mensaje**: «Hola {first_name} 👋 Bienvenido a [tu negocio]».
3. Agrega un **Menú** con tus opciones (ver productos, precios, hablar con un asesor).
4. Une cada opción con lo que debe pasar: otro Mensaje, un Condicional o una Notificación a tu equipo.
5. Pruébalo en el **laboratorio** antes de usarlo con clientes.
6. En **Conexiones → Disparadores**, elige que este flujo arranque con el primer mensaje.

> **Consejo:** usa `{first_name}` para saludar con el nombre. Si Auream no lo sabe, el saludo queda sin hueco.

> **Importante:** como no hay un «publicar» aparte, cada cambio que guardas llega de inmediato a los clientes que estén en el flujo.
