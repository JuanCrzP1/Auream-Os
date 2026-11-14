---
title: Datos del negocio: lo que les dices igual a todos tus clientes, escrito una vez
module: crm
summary: Tu horario, tu dirección o tu link de pago se escriben una vez como {g_…} y se cambian en un solo lugar para todos tus flujos, difusiones y respuestas rápidas. Puedes programar otro valor por unas fechas (Navidad, una promo) y ver quién cambió qué.
order: 5
updated: 2026-11-14
keywords: datos del negocio, variables globales, g_, horario, dirección, link de pago, enlace, condicional, variable global, cambio programado, navidad, festivo, historial, leona
related: campos-del-cliente, variables-y-nombre, primer-flujo
---

Un **dato del negocio** es algo que les dices **igual a todos tus clientes**: tu horario, tu dirección, tu link de pago, el enlace de tu grupo. Está en **Configuración › Campos y datos**, pestaña **Datos del negocio**.

## ¿En qué se diferencia de un campo del cliente?

| | Campo del cliente | Dato del negocio |
|---|---|---|
| ¿De quién es? | De **cada cliente**: cambia de uno a otro | De **tu negocio**: igual para todos |
| Ejemplos | Su ciudad, su cumpleaños, su talla | Tu horario, tu dirección, tu link de pago |
| Se escribe | `{ciudad}` | `{g_horario}` |

Un mismo mensaje puede usar los dos: «Hola Laura, te escribimos desde `{ciudad}`. Atendemos `{g_horario}`.» Laura lee *Medellín* y Pedro lee *Lima*, pero los dos leen el mismo horario.

## Para qué sirve

Si tu link de pago aparece en 15 mensajes, cambiarlo significa abrir los 15. Con un dato del negocio lo escribes **una sola vez** y en tus mensajes pones su clave, por ejemplo `{g_link_de_pago}`. El día que cambie, lo cambias aquí y todos tus mensajes salen con el nuevo, desde el siguiente mensaje.

## Crear uno

1. Toca **Nuevo dato** y elige **Dato del negocio** (igual para todos tus clientes).
2. Ponle un nombre, por ejemplo «Horario». La clave sale sola: `{g_horario}`.
3. Elige el tipo: **Texto**, **Número**, **Fecha** o **Sí o no**.
4. Escribe el valor y, si quieres, para qué es.

> **Consejo:** las claves llevan `g_` al principio, igual que en Leona. Un flujo que traes de Leona con `{g_algo}` funciona en cuanto creas el dato con esa clave.

## Dónde se usa

- **Mensajes de los flujos:** escribe `{g_horario}` en cualquier texto. Con un valor por si falta: `{g_horario|consúltanos}`.
- **Difusiones:** igual que en los flujos; la vista previa lo muestra con su valor.
- **Respuestas rápidas:** al elegirla en el chat ya sale con el valor puesto.
- **Condicional:** la regla **Dato del negocio** compara según su tipo. Por ejemplo, «Promo activa es Sí» o «Cupos está entre 1 y 20». Con un dato de **Sí o no** prendes o apagas una promoción en todos tus flujos sin abrirlos.

Al abrir un dato verás **Así lo ve tu cliente**: un mensaje real que lo usa, con el valor resaltado, y la lista de bloques, difusiones por enviar y respuestas rápidas donde aparece. Mientras escribes el valor nuevo, la vista previa cambia.

## Programar un cambio (Navidad, festivos, promos)

¿Cierras en Navidad o tu link de pago cambia por una promo? En el dato, abre **Cambios programados** y toca **Programar un cambio**:

1. Escribe el **valor mientras dura**: «Hoy cerramos por Navidad. Abrimos el 26 desde las 8 a. m.».
2. Elige **desde** y **hasta** (fecha y hora). Son las de tu empresa, las de **Configuración › General**.
3. Si quieres, ponle una nota: «Navidad».

Mientras dura, ese valor sale en **todo**: flujos, Condicional, difusiones, respuestas rápidas y el MCP. Cuando termina, vuelve **solo** al de siempre, sin que tengas que acordarte.

- En la lista verás la etiqueta **Navidad · 24 → 26 dic**, y mientras rige, **Ahora: Navidad** con el valor de siempre debajo.
- En **Así lo ve tu cliente** puedes ver el mensaje **ahora** o **durante** cada cambio.
- Si una difusión programada sale durante el cambio, te lo avisa: dirá ese valor.
- Uno que no ha empezado se edita o se quita. Uno que ya rige se puede alargar, o **terminar ya**: vuelve el de siempre en ese momento.
- Dos cambios del mismo dato no se pueden cruzar, y caben hasta 10 a la vez, hasta un año adelante.
- Mientras un dato tenga cambios programados, no se le cambia el tipo.

## Historial

En **Historial** ves quién cambió qué y cuándo: «Laura cambió el valor de "8 a 6" a "9 a 7" · hace 2 h», y también lo que se programó, se editó o se quitó. Con **Volver a este valor** pones el de antes: no se borra nada, queda como un cambio más. Se guardan los últimos 50 cambios de cada dato, aunque lo borres y lo crees de nuevo con la misma clave.

## Quién puede cambiarlos

Los cambian y programan los **dueños y administradores**. Tu equipo los ve, ve su historial y los usa. Los flujos solo los leen: ningún bloque puede cambiarlos.

## Borrar uno

Si un mensaje lo usa, Auream te dice cuáles y te pide escribir su clave para confirmar: esos mensajes saldrían sin ese dato y la regla del Condicional dejaría de cumplirse. Sus cambios programados se borran con él.

## ¿Y los precios?

Los precios **no** van aquí: van en **Ventas › Productos**, con su precio por país. Es el que usan Registrar venta y tu ROAS, así nunca le dices un precio al cliente y anotas otro.
