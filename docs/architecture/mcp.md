# Servidor MCP: permisos y herramientas

`contracts/McpContracts.ts` · `domains/mcp` · `apps/api/mcp` · `content/help/agentes/guia-para-agentes.md`

El transporte, las credenciales y OAuth están en [integrations.md](integrations.md#agentes-de-ia-mcp). Este documento cubre **qué puede hacer un agente** y **cómo se agrega una herramienta**.

## Principios

1. **Mismos servicios que la web.** Cada herramienta es un adaptador fino sobre el servicio de la aplicación que usa la pantalla correspondiente. Valida y decide lo mismo: no hay lógica de negocio en `apps/api/mcp/tools`.
2. **Permisos por área.** Quien conecta un agente elige, por área, «ver» o «ver y editar» (`MCP_AREAS`). `domains/mcp/domain/McpCredential.ts` traduce cada nivel a los permisos internos (`Scope`). Cada herramienta exige UN permiso; `tools/list` solo muestra las permitidas y `tools/call` lo vuelve a comprobar.
3. **El agente actúa como su credencial.** Lo que anota o mueve queda a nombre de la credencial (`credentialId`), y cada llamada queda en el registro `mcp.tool_call` (credencial, herramienta, resultado y duración; sin datos).
4. **Nada se inventa.** Precios, productos, etiquetas e ids salen de las herramientas `list_*`. Lo que llega a un cliente, anula una venta o cambia qué flujo arranca se confirma con la persona (lo piden la descripción de la herramienta y la guía).
5. **La documentación viaja con el servidor.** `read_platform_guide`, `search_help` y `read_help_article` no piden permiso y leen `content/help`, la misma fuente que el Centro de ayuda y `llms.txt`.

## Áreas y herramientas

| Área (`McpAreaId`) | Ver | Ver y editar | Permisos internos |
|---|---|---|---|
| Flujos (`flows`) | `list_flows`, `get_flow`, `list_block_types`, `get_block_type`, `list_flow_resources` | `create_flow`, `rename_flow`, `add_block`, `update_block`, `delete_block`, `connect_blocks`, `disconnect_blocks` | `flows.read` / `+flows.write` |
| Contactos y etiquetas (`contacts`) | `list_contacts`, `get_contact`, `list_labels` | `create_contact`, `update_contact`, `tag_contact`, `create_label` | `contacts.read` / `+contacts.write` |
| Conversaciones (`conversations`) | `list_conversations`, `get_conversation_messages` | `send_message`, `start_flow` | `conversations.read` / `+conversations.write` |
| Números de WhatsApp (`connections`) | `list_connections`, `list_triggers` | `create_trigger`, `update_trigger`, `delete_trigger` | `connections.read` / `+connections.write` |
| Ventas y productos (`sales`) | `list_products`, `list_sales`, `sales_summary` | `create_product`, `update_product`, `record_sale`, `update_sale`, `create_sales_line`, `update_sales_line`, `delete_sales_line`, `create_other_expense`, `update_other_expense`, `delete_other_expense` | `sales.read` / `+sales.write`, `sales.manage` |
| CRM (`crm`) | `list_pipelines`, `get_pipeline_board`, `get_contact_crm` | `move_contact_stage`, `update_deal` | `crm.read` / `+crm.write` |
| Dashboard y anuncios (`analytics`) | `dashboard_sales`, `dashboard_ads`, `dashboard_attention` (con `line_id`, listas de números, productos y campañas, y `currency`), `list_sales_lines`, `list_other_expenses` | — (solo ver) | `analytics.read`, `ads.read` |
| (sin área) | `read_platform_guide`, `search_help`, `read_help_article` | — | ninguno |

Detalles que importan:

- **Productos:** `update_product` lee el producto y cambia solo lo pedido. Si llegan `prices`, reemplazan la lista completa. El servicio exige precio en al menos un país: el agente debe pedirlo, nunca inventarlo.
- **Ventas:** sin producto, monto o moneda, una venta queda «Por revisar» y no suma. Anular (`status: void`) exige motivo.
- **Disparadores:** el servicio combina lo que llega con el disparador actual. Conectar o desconectar un número NO está en el MCP: exige escanear el QR con el teléfono.
- **CRM:** `move_contact_stage` cambia la etiqueta de etapa; no crea una venta. La configuración de embudos (crear, renombrar etapas) sigue en la web.
- **Dashboard:** devuelve las mismas respuestas que la pantalla (`DashboardContracts`, `AttentionContracts`).

Una credencial creada antes de que existiera un área no la tiene: hay que autorizarla de nuevo (OAuth) o crear otra credencial con esa área.

## Agregar una herramienta

1. **Área.** Si encaja en una existente, úsala; si no, agrégala en `MCP_AREAS` (texto para la persona: qué deja ver y qué deja hacer) y su traducción en `SCOPES` (`McpCredential.ts`). La pantalla de permisos y el consentimiento de OAuth la muestran solos.
2. **Herramienta.** En `apps/api/mcp/tools/<tema>Tools.ts`, con hasta 200 líneas por archivo. Lee los argumentos con `toolArgs.ts`, llama al servicio de la aplicación y devuelve su respuesta. La descripción le dice al agente cuándo usarla, de dónde sacar cada id y qué confirmar antes.
3. **Composición.** Agrega el servicio a `McpDependencies` (`composeMcpServer.ts`) y pásalo desde `composeApiApplication.ts`.
4. **Pruebas.** Que llame al servicio con lo pedido y a nombre de la credencial, y que solo aparezca con su permiso (`tests/unit/mcpPlatformTools.test.ts`).
5. **Documentación.** Esta tabla, la guía para agentes (`content/help/agentes/guia-para-agentes.md`) y, si cambia lo que la persona elige, `content/help/equipo/conectar-un-agente-mcp.md`.

## Lo que todavía no está (y por qué)

| Módulo | Motivo |
|---|---|
| Difusiones y envíos a grupos | Llegan a muchos clientes a la vez y tienen envío seguro (tope, horario, calentamiento). Necesitan confirmación en la web con la vista previa del público. Primero vendrá solo verlas. |
| Configurar embudos del CRM, equipo y roles | Cambian permisos o la estructura de la cuenta: quedan en la web. |
| Conectar números | Requiere escanear el QR con el teléfono. |
| Respuestas rápidas | Fáciles de agregar (área Conversaciones) cuando un agente las necesite. |
