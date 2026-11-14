---
title: Guardar dato: poner o cambiar un dato del cliente
module: automatizaciones
summary: Copia un valor en un dato, marca algo («usada») o lleva una cuenta (reintentos, puntos) sin pedirle nada al cliente.
order: 7
updated: 2026-11-14
keywords: guardar dato, manipulador, campo, variable, sumar, restar, contar, reintentos, copiar
related: herramientas-del-editor, variables-y-nombre, campos-del-cliente, ir-a-otro-flujo
---

El bloque **Guardar dato** pone o cambia un dato en el momento en que el cliente pasa por él. No le envía nada al cliente: trabaja por detrás. En Leona se llama «Manipulador».

## Para qué sirve

- **Copiar un dato en otro:** guardar en `{cancion_video}` la canción que eligió, `{cancion_2}`.
- **Marcar algo:** poner `{cancion_2}` en «usada» para no ofrecerla otra vez.
- **Llevar una cuenta:** sumar 1 a `{reintentos}` cada vez que el cliente reenvía la foto.
- **Guardar lo que trajo una Integración** con otro nombre, por ejemplo `{portada}`.

## Cómo se configura

1. **Dato:** elige un Campo del cliente, o escribe uno que solo viva en esta conversación. Si es un Campo del cliente, queda en su ficha y lo ven todos tus flujos.
2. **Qué hacer:**
   - **Poner un valor:** un texto fijo o con variables (`usada`, `{cancion_2}`).
   - **Hacer una cuenta:** sumar, restar, multiplicar o dividir el número que ya tiene.
3. **Valor:** lo que se guarda, o el número de la cuenta.

Abajo ves cómo quedará: `{reintentos} = {reintentos} + 1`.

## Bueno saber

- Si el dato está vacío, en una cuenta vale 0.
- Si el dato o el número no son números (o se divide entre 0), el dato **no cambia** y el flujo sigue. Nunca se guarda un valor a medias.
- Los **Datos del negocio** (`{g_…}`) no se cambian desde un flujo: se cambian en Configuración › Campos y datos.
- En el Laboratorio de pruebas ves qué guardó: «Guardó {reintentos} = 2».
