---
title: Variables: el nombre del cliente y otros datos
module: automatizaciones
summary: Cómo usar {first_name} y los datos que guarda el flujo en tus mensajes.
order: 6
updated: 2026-11-11
keywords: variables, nombre, first_name, personalizar
related: primer-flujo, primera-difusion
---

Escribe una variable entre llaves y Auream la reemplaza para cada cliente.

## Las más usadas

- `{first_name}`: el nombre.
- `{full_name}`: el nombre completo.
- `{phone}`: el teléfono.
- `{fecha}` y `{hora}`: con tu zona horaria.
- Lo que guardó el flujo con Esperar respuesta, por su nombre.

## Valor por defecto

`{first_name|amigo}` usa «amigo» si no sabemos el nombre.
