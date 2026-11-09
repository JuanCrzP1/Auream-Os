import type { FlowEditingService } from "../../../../domains/automations/editing/application/FlowEditingService";
import { addBlock, connectBlocks, disconnectBlocks, removeBlock, updateBlock } from "../../../../domains/automations/editing/domain/FlowDraftEditor";
import type { BlockData } from "../../../../contracts/blocks/BlockRules";
import type { McpTool } from "../McpTool";
import { presentChange, presentFlow } from "./flowPresenter";

// ---------------------------------------------------------------------------
// Flujos (permiso «Flujos: ver y editar»): crear flujos y armar sus bloques,
// con las MISMAS reglas del editor. Los flujos no se publican: cada cambio se
// guarda y queda activo al instante. Cada respuesta trae la revisión del
// flujo para que el agente corrija lo que falte.
// ---------------------------------------------------------------------------

const LIVE = "El cambio se guarda y queda activo al instante (los flujos no se publican).";
const flowId = { type: "string", description: "Id o clave del flujo (de list_flows)." } as const;
const blockId = (what: string) => ({ type: "string", description: `Id del bloque ${what} (de get_flow).` }) as const;
const output = { type: "string", description: "Salida del bloque de origen (de get_flow / get_block_type). Solo en bloques con varias salidas." } as const;
const config = (what: string) => ({ type: "object", description: `${what} Ver get_block_type.` }) as const;

const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const data = (value: unknown): BlockData | undefined => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as BlockData) : undefined);

export function flowEditTools(editing: FlowEditingService): McpTool[] {
  return [
    {
      name: "create_flow",
      title: "Crear un flujo",
      description: "Crea un flujo nuevo. Nace con el bloque de inicio («Inicio»); agrega los pasos con add_block después de él.",
      scope: "flows.write",
      readOnly: false,
      inputSchema: { type: "object", properties: { name: { type: "string", description: "Nombre del flujo." }, folder_id: { type: "string", description: "Carpeta (opcional)." } }, required: ["name"] },
      run: async (args, { tenantId }) => presentFlow(await editing.createFlow(tenantId, { name: args["name"], ...(text(args["folder_id"]) ? { folderId: text(args["folder_id"])! } : {}) }))
    },
    {
      name: "rename_flow",
      title: "Renombrar un flujo",
      description: "Cambia el nombre de un flujo.",
      scope: "flows.write",
      readOnly: false,
      inputSchema: { type: "object", properties: { flow_id: flowId, name: { type: "string", description: "Nombre nuevo." } }, required: ["flow_id", "name"] },
      run: async (args, { tenantId }) => presentChange(await editing.renameFlow(tenantId, String(args["flow_id"]), args["name"]), null)
    },
    {
      name: "add_block",
      title: "Agregar un bloque",
      description: `Agrega un bloque (tipos en list_block_types) con su configuración y, con «after_block_id», lo conecta después de ese bloque (en «after_output» si tiene varias salidas). Si esa salida ya llevaba a otro bloque, el nuevo se inserta en medio. Devuelve el id del bloque y sus salidas. ${LIVE}`,
      scope: "flows.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          flow_id: flowId,
          type: { type: "string", description: "Tipo de bloque, p. ej. 'message', 'menu', 'question'." },
          name: { type: "string", description: "Nombre visible (opcional)." },
          config: config("Configuración del bloque; lo que no se mande queda con su valor por defecto."),
          after_block_id: blockId("después del cual va (opcional; el de inicio es entryBlockId)"),
          after_output: output
        },
        required: ["flow_id", "type"]
      },
      run: async (args, { tenantId }) => {
        const after = text(args["after_block_id"]);
        const edited = await editing.edit(tenantId, String(args["flow_id"]), (draft, ids) =>
          addBlock(draft, { type: String(args["type"]), name: text(args["name"]), config: data(args["config"]), ...(after ? { after: { blockId: after, output: text(args["after_output"]) ?? null } } : {}) }, ids)
        );
        return presentChange(edited, edited.detail.blockId);
      }
    },
    {
      name: "update_block",
      title: "Configurar un bloque",
      description: `Cambia el nombre o la configuración de un bloque. «config» se fusiona con la actual (las listas se reemplazan enteras: al editar opciones de un Menú o intenciones de una IA, conserva sus «id» para no perder las conexiones). Las conexiones de salidas que dejen de existir se quitan y se informan. ${LIVE}`,
      scope: "flows.write",
      readOnly: false,
      inputSchema: { type: "object", properties: { flow_id: flowId, block_id: blockId("a configurar"), name: { type: "string", description: "Nombre nuevo (opcional)." }, config: config("Campos a cambiar.") }, required: ["flow_id", "block_id"] },
      run: async (args, { tenantId }) => {
        const id = String(args["block_id"]);
        return presentChange(await editing.edit(tenantId, String(args["flow_id"]), (draft, ids) => updateBlock(draft, id, { name: text(args["name"]), config: data(args["config"]) }, ids)), id);
      }
    },
    {
      name: "delete_block",
      title: "Borrar un bloque",
      description: `Borra un bloque y sus conexiones (el de inicio no se puede borrar). ${LIVE}`,
      scope: "flows.write",
      readOnly: false,
      inputSchema: { type: "object", properties: { flow_id: flowId, block_id: blockId("a borrar") }, required: ["flow_id", "block_id"] },
      run: async (args, { tenantId }) => presentChange(await editing.edit(tenantId, String(args["flow_id"]), (draft) => removeBlock(draft, String(args["block_id"]))), null, { deletedBlockId: String(args["block_id"]) })
    },
    {
      name: "connect_blocks",
      title: "Conectar dos bloques",
      description: `Conecta una salida de un bloque con otro bloque. De cada salida sale una sola conexión: si ya está conectada, usa «replace: true» para cambiar su destino. Al bloque de inicio no llega ninguna. ${LIVE}`,
      scope: "flows.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: { flow_id: flowId, from_block_id: blockId("de origen"), to_block_id: blockId("de destino"), output, replace: { type: "boolean", description: "Reemplazar la conexión que ya tenga esa salida." } },
        required: ["flow_id", "from_block_id", "to_block_id"]
      },
      run: async (args, { tenantId }) => {
        const from = String(args["from_block_id"]);
        const request = { from, to: String(args["to_block_id"]), output: text(args["output"]) ?? null, replace: args["replace"] === true };
        return presentChange(await editing.edit(tenantId, String(args["flow_id"]), (draft, ids) => connectBlocks(draft, request, ids)), from);
      }
    },
    {
      name: "disconnect_blocks",
      title: "Desconectar una salida",
      description: `Quita la conexión que sale de un bloque (por la salida indicada, si tiene varias). ${LIVE}`,
      scope: "flows.write",
      readOnly: false,
      inputSchema: { type: "object", properties: { flow_id: flowId, from_block_id: blockId("de origen"), output }, required: ["flow_id", "from_block_id"] },
      run: async (args, { tenantId }) => {
        const from = String(args["from_block_id"]);
        return presentChange(await editing.edit(tenantId, String(args["flow_id"]), (draft) => disconnectBlocks(draft, { from, output: text(args["output"]) ?? null })), from);
      }
    }
  ];
}
