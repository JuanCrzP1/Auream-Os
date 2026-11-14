---
title: Variables: el nombre del cliente y otros datos
module: automatizaciones
summary: Cómo poner el nombre del cliente, la fecha, el saludo y otros datos en tus mensajes, con el botón «{ } Variables».
order: 6
updated: 2026-11-14
keywords: variables, nombre, first_name, personalizar, saludo, fecha, dia, asesor, leona
related: primer-flujo, primera-difusion, campos-del-cliente, datos-del-negocio, guardar-dato
---

Escribe una variable entre llaves y Auream la reemplaza para cada cliente. «Hola {first_name}» le llega a Laura como «Hola Laura».

## El botón «{ } Variables»

Cada campo de texto de los bloques tiene el botón **{ } Variables**. Ábrelo, busca (por ejemplo «saludo» o «fecha») y toca la que quieras: queda donde tenías el cursor. Están por grupos:

- **Del cliente**: nombre, teléfono, correo, cuándo llegó, quién lo atiende.
- **Campos del cliente** y **Datos del negocio** de tu cuenta.
- **Del sistema**: fecha, hora, día, saludo, el número por el que escribió.
- **Del anuncio**: si llegó desde un anuncio de Meta.
- **De otros bloques**: la respuesta de la IA, el comprobante, la venta, el error de una integración.

También puedes escribirla a mano entre llaves.

## Las que trae Auream

- `{first_name}` y `{full_name}`: el nombre y el nombre completo.
- `{phone}`: el teléfono. `{email}`: el correo.
- `{saludo}`: «Buenos días» (5 a 11 a. m.), «Buenas tardes» (12 a 6 p. m.) o «Buenas noches».
- `{fecha}` (13/11/2026), `{data}` (13/11, solo día y mes), `{hora}` (14:35) y `{dia}` (viernes), con la hora de tu negocio.
- `{created_at}`: cuándo te escribió por primera vez.
- `{attendant_name}`: el asesor que atiende la conversación.
- `{instance_name}` y `{instance_number}`: el nombre y el número de WhatsApp por el que escribió.
- `{integracion.error}`: por qué falló la última Integración (para avisarte o decidir qué hacer).
- Lo que guardó el flujo con Esperar respuesta, Guardar dato o una Integración, por su nombre.

## ¿Vienes de Leona?

Los nombres de Leona también funcionan: `{phone_number}`, `{ai.response}`, `{ai.erro}`, `{ai.fail.reason}`, `{response.erro}` y `{comprovante.valor}`, `{comprovante.currency}`, `{comprovante.data}`, `{comprovante.nome_pagador}`… Así un flujo traído de allá no hay que reescribirlo.

## Comparar con una variable

En el **Condicional**, el valor de una regla puede ser una variable. Por ejemplo, «la referencia nueva es igual a `{ref_anterior}`» para saber si el cliente mandó el mismo comprobante dos veces, o «la fecha del pago empieza con `{data}`» para saber si es de hoy.

## De dónde sale el valor

1. Lo que el cliente dijo **en esta conversación** (lo que guardó el flujo), tal cual lo escribió.
2. Si no lo ha dicho, su **ficha** (Campos del cliente). Un sí o no sale como «Sí» o «No» y una fecha como 13/11/1990.

## Valor por defecto

`{first_name|amigo}` usa «amigo» si no sabemos el nombre.

## En fotos, videos y audios

En el bloque **Mensaje**, el enlace de un archivo también puede ser una variable: por ejemplo `{portada}`, con la imagen que creó una Integración. Al enviar, Auream pone el enlace que tenga la variable en ese momento. Si está vacía o no es un enlace, ese archivo no sale y el resto del mensaje sí.
