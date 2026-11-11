---
title: Guía de Auream para agentes de IA
module: agentes
summary: Qué es cada módulo, cómo se relacionan, las reglas que no se pueden romper y qué herramienta usar.
order: 1
updated: 2026-11-11
keywords: agente, mcp, guía, reglas, herramientas
---

Auream es una plataforma para **vender por WhatsApp**. Una cuenta (la empresa) conecta sus números de WhatsApp, responde con flujos automáticos, atiende en una bandeja compartida, lleva a sus clientes en un CRM, registra ventas y mide lo que le dejan sus anuncios. Todo lo que hagas ocurre dentro de la cuenta de la credencial y solo con sus permisos.

## Los módulos y cómo se relacionan

- **Conexiones:** los números de WhatsApp de la cuenta (por código QR). Cada número tiene **disparadores**: qué flujo arranca cuando alguien escribe (primer mensaje, palabra clave, anuncio).
- **Automatizaciones (flujos):** un flujo es un recorrido de bloques. Las 13 herramientas: Mensaje, Esperar respuesta, Menú, Condicional, Etiquetas, Comprobante automático, Registrar venta, Distribuidor, Programador, Notificación, Integración, Extensión IA y Pixel (más Finalizar). Se guardan solos: lo guardado es lo que corre.
- **Contactos y etiquetas:** cada cliente es un contacto con etiquetas. Las etiquetas las ponen los flujos (bloque Etiquetas), los asesores o las reglas de Grupos.
- **CRM:** un embudo tiene etapas y **cada etapa ES una etiqueta**. Un cliente está en una sola etapa por embudo; ponerle la etiqueta de otra etapa lo mueve. Una venta aprobada lo pasa a la etapa de venta.
- **Conversaciones:** la bandeja. Si un asesor responde, el bot se pausa en ese chat.
- **Ventas y productos:** cada producto tiene precio (y costo) por país. Una venta la registra el bloque Registrar venta (después de un comprobante válido) o un asesor. Sin precio para ese país, la venta queda **«Por revisar»**: nunca se inventa un precio.
- **Dashboard y Meta Ads:** el ROAS real cruza las ventas de Auream con el gasto de Meta (por el anuncio del que llegó cada cliente). Se compara con el ROAS que reporta Meta.
- **Difusiones:** un flujo o un mensaje a muchos clientes que **ya escribieron**, con envío seguro (pausas al azar, horario, tope y calentamiento por número, «SALIR»).
- **Grupos:** campañas con un enlace único que lleva al grupo con cupo y crea el siguiente al llenarse; envíos a muchos grupos; lo que vende cada grupo.

## Reglas que no se pueden romper

1. **Confirma con la persona antes de cualquier cosa que llegue a un cliente**: enviar un mensaje, iniciar un flujo, una difusión o un envío a grupos. Lo que sale por WhatsApp no se puede deshacer.
2. **Busca antes de actuar** (`list_*`) y usa los ids que devuelven. Nunca inventes ids, precios, productos, etiquetas ni números.
3. **No inventes precios.** Si un producto no tiene precio en un país, dilo; no lo completes.
4. **Respeta el envío seguro.** No intentes saltarte el tope diario, el horario ni las pausas de las difusiones: protegen el número de un bloqueo.
5. **Quien pidió no recibir más** («SALIR») no vuelve a recibir difusiones. No lo agregues por otra vía.
6. **Editar un flujo cambia lo que reciben los clientes de inmediato** (no hay borrador publicado aparte). Revisa el flujo (`review_flow` si existe) y avisa qué vas a cambiar.
7. **Permisos:** si una herramienta no aparece, la credencial no tiene ese permiso. No intentes rodearlo.

## Qué herramienta usar

- ¿Qué números hay y si están conectados? → `list_connections`.
- ¿Qué flujos hay y qué hacen? → herramientas de flujos (`list_flows`, leer un flujo) antes de editar.
- ¿Quién es este cliente y qué etiquetas tiene? → herramientas de contactos.
- ¿Qué productos y precios hay? → la herramienta de productos.
- ¿Cómo funciona una parte? → `search_help` y `read_help_article`.

## Cómo responder a la persona

- En español, corto y claro.
- Si algo no se pudo hacer, dilo con el motivo y qué puede hacer la persona.
- No muestres credenciales ni tokens.
