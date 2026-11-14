---
title: Variables: el nombre del cliente y otros datos
module: automatizaciones
summary: Cómo usar {first_name} y los datos que guarda el flujo en tus mensajes.
order: 6
updated: 2026-11-14
keywords: variables, nombre, first_name, personalizar
related: primer-flujo, primera-difusion, campos-del-cliente, datos-del-negocio, guardar-dato
---

Escribe una variable entre llaves y Auream la reemplaza para cada cliente.

## Las más usadas

- `{first_name}`: el nombre.
- `{full_name}`: el nombre completo.
- `{phone}`: el teléfono.
- `{fecha}` y `{hora}`: con tu zona horaria.
- Lo que guardó el flujo con Esperar respuesta, Guardar dato o una Integración, por su nombre.
- Los **campos del cliente** (`{ciudad}`, `{presupuesto}`): ver el artículo «Campos del cliente».

## De dónde sale el valor

1. Lo que el cliente dijo **en esta conversación** (lo que guardó el flujo), tal cual lo escribió.
2. Si no lo ha dicho, su **ficha** (Campos del cliente). Un sí o no sale como «Sí» o «No» y una fecha como 13/11/1990.

## Valor por defecto

`{first_name|amigo}` usa «amigo» si no sabemos el nombre.

## En fotos, videos y audios

En el bloque **Mensaje**, el enlace de un archivo también puede ser una variable: por ejemplo `{portada}`, con la imagen que creó una Integración (Kie.ai, Shotstack…). Al enviar, Auream pone el enlace que tenga la variable en ese momento. Si está vacía o no es un enlace, ese archivo no sale y el resto del mensaje sí.
