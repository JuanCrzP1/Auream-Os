---
title: Ir a otro flujo: pasar al cliente a otro flujo
module: automatizaciones
summary: Este flujo termina y el cliente sigue, en ese mismo momento, en el inicio de otro flujo, con todo lo que ya contó.
order: 8
updated: 2026-11-14
keywords: ir a otro flujo, conexión de flujo, saltar, pasar, otro flujo, subflujo
related: herramientas-del-editor, guardar-dato, primer-flujo
---

El bloque **Ir a otro flujo** termina el flujo actual y pasa al cliente al **inicio** del flujo que elijas, en ese mismo momento. Así puedes tener flujos más cortos y reusar uno en varios lugares (por ejemplo, «Después de pagar» o «Promoción»). En Leona se llama «Conexión de flujo».

## Cómo se configura

Elige el flujo de la lista. No aparecen este mismo flujo ni los archivados; uno pausado se ve pero no se puede elegir.

El bloque **no tiene salidas**: la conversación sigue en el otro flujo.

## Qué pasa al llegar al bloque

- Lo que envió este flujo antes del bloque sale normal, y enseguida lo que envíe el otro.
- **Los datos de la conversación pasan al otro flujo:** las respuestas guardadas, `{ia.respuesta}`, lo que trajo una Integración… El otro flujo los usa igual.
- Desde ahí, los mensajes del cliente siguen en el otro flujo.

## Protecciones

- Si el flujo de destino está **pausado o archivado** cuando llega el cliente, no pasa y queda anotado.
- Un flujo no puede pasarse a sí mismo.
- Si dos flujos se pasan el cliente sin parar, Auream corta después de 5 saltos seguidos.

## En el Laboratorio de pruebas

El laboratorio prueba un flujo a la vez: al llegar al bloque te dice «Aquí el cliente pasa al flujo…». Abre ese flujo y pruébalo para seguir.
