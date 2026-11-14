---
title: Crear tu primer flujo de bienvenida
module: automatizaciones
summary: Un flujo que saluda, muestra lo que vendes y deja al cliente listo para comprar.
order: 1
updated: 2026-11-13
keywords: flujo, bienvenida, crear, automatización, editor
related: herramientas-del-editor, laboratorio-de-pruebas, disparadores
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

## Que nada falle en silencio

- **En la lista de Automatizaciones**, cada flujo tiene un punto: **verde** si está en orden, **ámbar** si tiene avisos y **rojo** si algo no funcionará (por ejemplo, un Píxel sin píxel elegido). Con problemas, lo dice bajo el nombre: «⚠ 3 puntos por revisar». Ábrelo y toca **puntos por revisar** para ir a cada bloque.
- **En la campana** te avisamos si un flujo falló en las últimas 24 horas mientras atendía clientes: qué bloque, por qué y cuántas veces. Por ejemplo: «El Píxel no envió el evento a Meta: el bloque no tiene píxel elegido». El aviso te lleva al flujo.
