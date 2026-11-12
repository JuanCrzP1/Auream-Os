---
title: Guía de Auream para agentes de IA
module: agentes
summary: Qué es cada módulo, cómo se relacionan, las reglas que no se pueden romper y qué herramienta usar.
order: 1
updated: 2026-11-12
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
7. **Permisos:** si una herramienta no aparece, la credencial no tiene ese permiso. No intentes rodearlo: dile a la persona qué área debe darte («Ventas y productos: ver y editar», por ejemplo).
8. **Anular una venta, quitar un disparador o cambiar qué flujo arranca** cambia números y lo que reciben los clientes: confírmalo antes y di qué cambió.
9. **Una venta solo cuenta si se registra.** Mover a un cliente a la etapa de venta del CRM no crea una venta: usa `record_sale` o el bloque Registrar venta.

## Qué herramienta usar

Cada herramienta aparece solo si la credencial tiene permiso en su área.

| Quieres… | Herramienta | Área |
|---|---|---|
| Entender cómo funciona algo | `read_platform_guide`, `search_help`, `read_help_article` | (siempre) |
| Ver números y si están conectados | `list_connections` | Números de WhatsApp |
| Ver o cambiar qué flujo arranca en un número | `list_triggers`, `create_trigger`, `update_trigger`, `delete_trigger` | Números de WhatsApp |
| Ver o editar flujos | `list_flows`, `get_flow`, `list_block_types`, `get_block_type`, `list_flow_resources`, `add_block`, `update_block`, `connect_blocks`… | Flujos |
| Buscar clientes, etiquetarlos o crear etiquetas | `list_contacts`, `get_contact`, `list_labels`, `tag_contact`, `create_label` | Contactos y etiquetas |
| Leer o responder chats | `list_conversations`, `get_conversation_messages`, `send_message`, `start_flow` | Conversaciones |
| Ver o crear productos y precios | `list_products`, `create_product`, `update_product` | Ventas y productos |
| Ver, anotar, corregir o anular ventas | `list_sales`, `sales_summary`, `record_sale`, `update_sale` | Ventas y productos |
| Ver el CRM o mover clientes de etapa | `list_pipelines`, `get_pipeline_board`, `get_contact_crm`, `move_contact_stage`, `update_deal` | CRM |
| Ver ROAS real, gasto, anuncios y atención (de todo el negocio o de una línea, en la moneda que pidan) | `dashboard_sales`, `dashboard_ads`, `dashboard_attention` | Dashboard y anuncios |
| Ver o armar líneas de venta («Venezuela», «Colombia») | `list_sales_lines`, `create_sales_line`, `update_sales_line`, `delete_sales_line` | Dashboard (ver) · Ventas y productos (editar) |

## Tareas completas

- **Que un flujo registre sus ventas:** `list_products` (si no existe, pide nombre y precio y usa `create_product`) → `get_flow` → `add_block` de tipo `record-sale` con `after_block_id` = el bloque tras el pago confirmado (la salida «válido» del Comprobante o la etiqueta de pagado; se inserta en medio y conserva lo que seguía), con el producto, `amountMode: variable`, el monto `{comprobante.valor}`, la moneda `{comprobante.moneda}` y la referencia `{comprobante.referencia}` → `get_flow` para revisar.
- **Que un flujo arranque en un número:** `list_connections` → `list_flows` → `list_triggers` (para no chocar con uno igual) → confirma con la persona → `create_trigger`.
- **¿Cómo va una parte del negocio?:** `list_sales_lines` → `dashboard_sales` con su `line_id` (y `currency`, p. ej. `VES`). Si no existe la línea, propón crearla con `create_sales_line` (productos de `list_products`, campañas de `dashboard_ads`).
- **¿Cómo voy?:** `dashboard_sales` (ROAS real, ventas, gasto y qué hacer con cada campaña) y `sales_summary` (lo vendido por producto y por día).
- **Corregir ventas «Por revisar»:** `list_sales` con `status: review` → completa producto, monto y moneda con `update_sale` → apruébala (`status: approved`) solo si la persona lo confirma.

## Cómo responder a la persona

- En español, corto y claro.
- Si algo no se pudo hacer, dilo con el motivo y qué puede hacer la persona.
- No muestres credenciales ni tokens.
