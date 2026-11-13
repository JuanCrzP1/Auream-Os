---
title: Campos del cliente: lo que sabes de cada cliente, con tipo
module: crm
summary: Ponle nombre y tipo a los datos que guardan tus flujos (ciudad, presupuesto, cumpleaños) para verlos en la ficha y usarlos sin errores.
order: 4
updated: 2026-11-13
keywords: campos, campos personalizados, datos del cliente, ficha, variables, ciudad, tipo, lista
related: variables-y-nombre, primer-flujo, embudo-y-etapas
---

Un **campo del cliente** es un dato que guardas de cada cliente: su ciudad, su presupuesto, su cumpleaños, si ya compró. Está en **Configuración › Datos › Campos del cliente**.

## Para qué sirve

- **Queda en la ficha del cliente:** lo que el cliente responde en un flujo no se pierde cuando termina la conversación.
- **Tiene tipo:** texto, número, fecha, sí o no, o lista. Auream lo guarda ordenado: «1.200.000» como número y «13/11/1990» como fecha.
- **Ves de dónde sale y quién lo usa:** qué bloques lo llenan, cuáles lo leen y en cuántos clientes está.

## El primer día

Si tus flujos ya guardan datos (con Esperar respuesta, Menú, Integración o IA), Auream los encuentra y te propone convertirlos en campos, con el nombre y el tipo que mejor les queda.

1. Abre **Configuración › Datos › Campos del cliente**.
2. Revisa cada dato: cambia el nombre si quieres y elige el tipo.
3. Marca los que quieras y toca **Convertir en campos**.

Tus flujos siguen igual: los datos solo ganan nombre, tipo y lugar en la ficha. Los datos técnicos de integraciones (ids, estados, errores) quedan aparte y sin marcar.

> **Consejo:** si dos claves parecen el mismo dato (`respuesta` y `resposta`), Auream te avisa. Convierte una sola.

## Crear un campo

1. Toca **Nuevo campo**.
2. Escribe el nombre. Debajo ves cómo se escribe en tus mensajes: «Producto de interés» se usa como `{producto_de_interes}`.
3. Elige el tipo. Si es **Lista**, escribe sus opciones (al menos 2).
4. Toca **Crear campo**.

Desde ahí, lo que un bloque guarde con esa clave también queda en la ficha del cliente.

## Los tipos

- **Texto:** cualquier respuesta escrita.
- **Número:** acepta 1.200.000, 1,200.50 o $ 49.900.
- **Fecha:** acepta 13/11/2026, 13-11-26 o 2026-11-13.
- **Sí o no:** acepta sí, si, no, yes, 1, 0. «No sé» no cuenta como no.
- **Lista:** solo las opciones que definiste, sin importar tildes, mayúsculas ni signos («medellin.» es «Medellín»).

> **Importante:** si la respuesta no encaja en el tipo (una ciudad que no está en la lista, una fecha que no existe), no se guarda en la ficha. Tu flujo sigue funcionando con lo que el cliente escribió, tal cual.

## Cómo se usa en tus flujos

- **En un mensaje,** escribe la clave entre llaves: `Enviamos a {ciudad}`.
- **En un Condicional,** elige «Campo del cliente» y su clave.
- **Lo que el cliente dijo en la conversación manda.** Si hoy dijo «Cartagena», el flujo usa «Cartagena» aunque su ficha diga otra ciudad. Si no lo ha dicho (por ejemplo, vuelve otro día), se usa su ficha.
- **Se escribe como persona:** un sí o no sale como «Sí» o «No», y una fecha como 13/11/1990.
- **El Condicional entiende el tipo:** «Sí» es sí, «13/11/1990» es la misma fecha que 1990-11-13 y «1.200.000» es el mismo número que 1200000.

## Cambiar o borrar un campo

- Toca un campo para ver su detalle. Puedes cambiar el nombre, el tipo y las opciones. **La clave no cambia**, porque tus flujos la usan.
- Si cambias el tipo, los datos que ya existen se quedan como están; lo nuevo se guarda con el tipo nuevo.
- **Borrar** quita el campo y su dato de todos los clientes, y no se puede deshacer. Si tiene datos o bloques que lo usan, te pide escribir su clave para confirmar. Los bloques siguen funcionando en la conversación, pero lo que guarden ya no queda en la ficha.

## Quién puede

Los dueños y administradores crean, convierten, editan y borran campos. El resto del equipo los ve.

## Los del sistema

Auream llena algunos datos solo: nombre, teléfono, correo, último mensaje, fecha y hora, y el anuncio de origen. Se usan igual que los tuyos (`{first_name}`, `{phone}`…) y no se pueden borrar.
