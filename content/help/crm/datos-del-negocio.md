---
title: Datos del negocio: lo que repites en tus mensajes, escrito una vez
module: crm
summary: Tu Pago Móvil, el horario, la dirección o el enlace del grupo se escriben una vez como {g_…} y se cambian en un solo lugar para todos tus flujos, difusiones y respuestas rápidas.
order: 5
updated: 2026-11-13
keywords: datos del negocio, variables globales, g_, pago móvil, horario, dirección, enlace, condicional, variable global, leona
related: campos-del-cliente, variables-y-nombre, primer-flujo
---

Un **dato del negocio** es algo que repites en tus mensajes y es igual para todos tus clientes: tu Pago Móvil, el horario, la dirección, el enlace del grupo VIP. Está en **Configuración › Datos › Datos del negocio**.

## Para qué sirve

Si tu cuenta de pago aparece en 15 mensajes, cambiarla significa abrir los 15. Con un dato del negocio la escribes **una sola vez** y en tus mensajes pones su clave, por ejemplo `{g_pago_movil}`. El día que cambie, la cambias en Configuración y todos tus mensajes salen con la nueva, desde el siguiente mensaje.

## Crear uno

1. Toca **Nuevo dato**.
2. Ponle un nombre, por ejemplo «Pago Móvil». La clave sale sola: `{g_pago_movil}`.
3. Elige el tipo: **Texto**, **Número**, **Fecha** o **Sí o no**.
4. Escribe el valor y, si quieres, para qué es.

> **Consejo:** las claves llevan `g_` al principio, igual que en Leona. Un flujo que traes de Leona con `{g_algo}` funciona en cuanto creas el dato con esa clave.

## Dónde se usa

- **Mensajes de los flujos:** escribe `{g_horario}` en cualquier texto. Con un valor por si falta: `{g_horario|consúltanos}`.
- **Difusiones:** igual que en los flujos; la vista previa lo muestra con su valor.
- **Respuestas rápidas:** al elegirla en el chat ya sale con el valor puesto.
- **Condicional:** la regla **Dato del negocio (variable global)** compara según su tipo. Por ejemplo, «Promo activa es Sí» o «Cupos está entre 1 y 20». Con un dato de **Sí o no** prendes o apagas una promoción en todos tus flujos sin abrirlos.

Al abrir un dato verás **Así lo ve tu cliente**: un mensaje real que lo usa, con el valor resaltado, y la lista de bloques, difusiones por enviar y respuestas rápidas donde aparece. Mientras escribes el valor nuevo, la vista previa cambia.

## Quién puede cambiarlos

Los cambian los **dueños y administradores**. Tu equipo los ve y los usa. Los flujos solo los leen: ningún bloque puede cambiarlos.

## Borrar uno

Si un mensaje lo usa, Auream te dice cuáles y te pide escribir su clave para confirmar: esos mensajes saldrían sin ese dato y la regla del Condicional dejaría de cumplirse.

## ¿Y los precios?

Los precios **no** van aquí: van en **Ventas › Productos**, con su precio por país. Es el que usan Registrar venta y tu ROAS, así nunca le dices un precio al cliente y anotas otro.
