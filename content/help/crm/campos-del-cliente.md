---
title: Campos del cliente: lo que sabes de cada cliente, con tipo
module: crm
summary: Ponle nombre y tipo a los datos que guardan tus flujos (ciudad, presupuesto, cumpleaños) para verlos en la ficha y usarlos sin errores.
order: 4
updated: 2026-11-14
keywords: campos, campos personalizados, datos del cliente, ficha, variables, ciudad, tipo, lista, ordenar valores, unir campos, deshacer, filtrar, lo que vende
related: datos-del-negocio, variables-y-nombre, primer-flujo, embudo-y-etapas
---

Un **campo del cliente** es un dato que guardas de cada cliente: su ciudad, su presupuesto, su cumpleaños, si ya compró. Está en **Configuración › Campos y datos**, pestaña **Campos del cliente**.

## ¿En qué se diferencia de un dato del negocio?

Un campo del cliente **cambia con cada persona**: Laura vive en Medellín y Pedro en Lima, y `{ciudad}` le dice a cada uno la suya. Un **dato del negocio** es **igual para todos**: tu horario o tu link de pago (`{g_horario}`). Si buscas eso, está en [Datos del negocio](datos-del-negocio).

## Para qué sirve

- **Queda en la ficha del cliente:** lo que el cliente responde en un flujo no se pierde cuando termina la conversación.
- **Tiene tipo:** texto, número, fecha, sí o no, o lista. Auream lo guarda ordenado: «1.200.000» como número y «13/11/1990» como fecha.
- **Ves de dónde sale y quién lo usa:** qué bloques lo llenan, cuáles lo leen y en cuántos clientes está.

## El primer día

Si tus flujos ya guardan datos (con Esperar respuesta, Menú, Integración o IA), Auream los encuentra y te propone convertirlos en campos, con el nombre y el tipo que mejor les queda.

1. Abre **Configuración › Campos y datos**, pestaña **Campos del cliente**.
2. Revisa cada dato: cambia el nombre si quieres y elige el tipo.
3. Marca los que quieras y toca **Convertir en campos**.

Tus flujos siguen igual: los datos solo ganan nombre, tipo y lugar en la ficha. Los datos técnicos de integraciones (ids, estados, errores) quedan aparte y sin marcar.

> **Consejo:** si dos claves parecen el mismo dato (`respuesta` y `resposta`), Auream te avisa. Convierte una sola.

## Crear un campo

1. Toca **Nuevo dato** y elige **Campo del cliente** (cambia con cada persona).
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

- **En los bloques se elige de una lista:** en Esperar respuesta («Guardar en»), Menú, Integración, IA y Condicional ves tus campos con su tipo y qué tan llenos están. Si falta uno, lo creas ahí mismo. Para un dato de paso que no quieres en la ficha (un código, una nota), elige **Solo en esta conversación**.
- **Preguntar de nuevo:** en Esperar respuesta, si guardas en un campo de lista, número, fecha o sí o no y el cliente responde algo que no encaja, el bloque le vuelve a preguntar (por ejemplo «Elige una de estas: Medellín, Bogotá o Cali»), hasta 2 veces. Puedes escribir tu propio mensaje.
- **En un mensaje,** escribe la clave entre llaves: `Enviamos a {ciudad}`.
- **En un Condicional,** elige «Campo del cliente» y el campo: cada tipo trae sus reglas. Lista: «es una de» (tocas las opciones). Sí o no: Sí / No. Número: «está entre». Fecha: «es hoy (día y mes)» (cumpleaños), «es en los próximos N días», «fue hace N días o más», antes o después de una fecha. Abajo ves la regla en palabras.
- **Lo que el cliente dijo en la conversación manda.** Si hoy dijo «Cartagena», el flujo usa «Cartagena» aunque su ficha diga otra ciudad. Si no lo ha dicho (por ejemplo, vuelve otro día), se usa su ficha.
- **Se escribe como persona:** un sí o no sale como «Sí» o «No», y una fecha como 13/11/1990.
- **El Condicional entiende el tipo:** «Sí» es sí, «13/11/1990» es la misma fecha que 1990-11-13 y «1.200.000» es el mismo número que 1200000.

## En la ficha del cliente

En el CRM, la ficha de cada cliente muestra sus campos en su forma: una lista se elige, una fecha con calendario, sí o no con dos botones. Debajo de cada dato dice **de dónde salió**: «Lo respondió en "¿En qué ciudad estás?" del flujo "Ventas" · hoy» o «Lo cambió Ana · ayer».

- Todo el equipo que edita contactos puede llenar la ficha (también los asesores).
- Al guardar solo se manda lo que cambiaste: si un flujo guarda otro dato mientras la tienes abierta, no se pierde.
- Los datos que guardó un flujo y no son campos aparecen aparte; los dueños y administradores pueden tocar **Convertir en campo**.

## Cambiar o borrar un campo

- Toca un campo para ver su detalle. Puedes cambiar el nombre, el tipo y las opciones. **La clave no cambia**, porque tus flujos la usan.
- Si cambias el tipo, los datos que ya existen se quedan como están; lo nuevo se guarda con el tipo nuevo.
- **Borrar** quita el campo y su dato de todos los clientes, y no se puede deshacer. Si tiene datos o bloques que lo usan, te pide escribir su clave para confirmar. Los bloques siguen funcionando en la conversación, pero lo que guarden ya no queda en la ficha.

## Ordenar valores escritos de varias formas

Si tus clientes escribieron «medellin», «Medellín» y «MDE», Auream te lo avisa en **Por ordenar**.

1. Toca **Ordenar valores** (también está en el detalle del campo).
2. Revisa los grupos: para cada uno eliges a qué opción pasa, **Dejar como está** o **Dejar sin dato**. Auream solo propone lo evidente; lo demás lo decides tú.
3. Confirma. El campo queda como lista con esas opciones.

## Unir campos que guardan lo mismo

Si dos claves guardan el mismo dato (`respuesta` y `resposta`), Auream te propone unirlas.

1. Toca **Revisar y unir** y elige con cuál te quedas.
2. Mira qué bloques cambian: pasan a usar la clave que queda, solos.
3. Confirma. Si un cliente tenía los dos datos, queda el más reciente.

> **Importante:** si alguien tiene un flujo abierto en el editor, ese flujo no se toca: Auream te dice cuál es para que cambies la clave a mano.

## Deshacer

Ordenar y unir se pueden **deshacer durante 7 días**, desde la parte de arriba de Campos del cliente. Vuelve todo lo que siga como quedó: si el dato de un cliente o un bloque cambió después, eso no se toca.

## Lo que vende cada valor

En el detalle de un campo ves cuánto vendieron los clientes de cada valor (por ejemplo, cada ciudad) en los últimos 7, 30 o 90 días. Cuenta las ventas aprobadas, y cada moneda va aparte. Lo ve quien puede ver Ventas.

## Filtrar por campos

- **En Difusiones,** en «¿A quién?», toca **+ Filtrar por campo**: por ejemplo «Ciudad es una de Medellín» y «Ya compró es Sí». El número de personas cambia en vivo.
- **En el CRM,** en Contactos, el mismo filtro deja solo los clientes que lo cumplen.
- Puedes combinar hasta 5 filtros; se cumplen todos a la vez.

## Quién puede

Los dueños y administradores crean, convierten, editan y borran campos. El resto del equipo los ve.

## Los del sistema

Auream llena algunos datos solo: nombre, teléfono, correo, último mensaje, fecha y hora, y el anuncio de origen. Se usan igual que los tuyos (`{first_name}`, `{phone}`…) y no se pueden borrar.
