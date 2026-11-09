import { describe, expect, it } from "vitest";
import { buildInitialBuilderWorkspace } from "../../apps/api/composition/buildInitialBuilderWorkspace.js";
import { addBlock, connectBlocks, disconnectBlocks, removeBlock, updateBlock } from "../../domains/automations/editing/domain/FlowDraftEditor.js";
import { reviewDraft } from "../../domains/automations/editing/domain/draftGraph.js";
import type { BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";

// ---------------------------------------------------------------------------
// Editar un borrador como lo hace una persona en el lienzo, con las MISMAS
// reglas del editor (contracts/blocks): valores por defecto, forma canónica,
// salidas y reglas de conexión. Nada de esto toca almacenamiento.
// ---------------------------------------------------------------------------

function setup() {
  let n = 0;
  const ids = { newId: (prefix: string) => `${prefix}-${++n}` };
  const draft = buildInitialBuilderWorkspace("t1", "f1").draft;
  return { ids, draft, start: draft.version.entryNodeId };
}

const edgesOf = (draft: BuilderFlowSnapshot) => Object.values(draft.edgesBySource).flat().map((edge) => [edge.fromNodeId, edge.fromOutput ?? null, edge.toNodeId]);

describe("FlowDraftEditor", () => {
  it("agrega un bloque con su configuración canónica y lo conecta después del inicio, a su derecha", () => {
    const { ids, draft, start } = setup();
    const added = addBlock(draft, { type: "message", config: { items: [{ kind: "text", text: "Hola {first_name}" }], color: "rojo" } }, ids).draft;
    const result = addBlock(draft, { type: "message", config: { items: [{ kind: "text", text: "Hola {first_name}" }], color: "rojo" }, after: { blockId: start } }, ids);
    const node = result.draft.nodes[result.blockId]!;
    expect([node.type, node.name, node.config]).toEqual(["message", "Mensaje", { items: [{ id: expect.stringMatching(/^mi-/), kind: "text", text: "Hola {first_name}" }] }]);
    expect(result.ignoredFields).toEqual(["color"]);
    expect(edgesOf(result.draft)).toEqual([[start, null, result.blockId]]);
    expect((node.metadata["ui"] as { x: number }).x).toBeGreaterThan((draft.nodes[start]!.metadata["ui"] as { x: number }).x);
    expect(Object.keys(added.nodes)).toHaveLength(2);
  });

  it("un Menú: sus opciones reciben id y son sus salidas; conectar exige una salida que exista", () => {
    const { ids, draft, start } = setup();
    const menu = addBlock(draft, { type: "menu", config: { format: "buttons", message: "¿Qué quieres?", options: [{ title: "Precios" }, { title: "Asesor" }] }, after: { blockId: start } }, ids);
    const options = (menu.draft.nodes[menu.blockId]!.config["options"] as Array<{ id: string }>).map((option) => option.id);
    expect(options).toEqual([expect.stringMatching(/^opt-/), expect.stringMatching(/^opt-/)]);

    const reply = addBlock(menu.draft, { type: "message", after: { blockId: menu.blockId, output: options[0] } }, ids);
    expect(edgesOf(reply.draft)).toContainEqual([menu.blockId, options[0], reply.blockId]);
    expect(() => connectBlocks(reply.draft, { from: menu.blockId, to: reply.blockId }, ids)).toThrow(/varias salidas: indica cuál.*Precios/);
    expect(() => connectBlocks(reply.draft, { from: menu.blockId, to: reply.blockId, output: "no-existe" }, ids)).toThrow(/no tiene la salida/);
    expect(() => connectBlocks(reply.draft, { from: reply.blockId, to: reply.blockId }, ids)).toThrow(/consigo mismo/);
    expect(() => connectBlocks(reply.draft, { from: reply.blockId, to: start }, ids)).toThrow(/inicio no recibe/);
    // «Otra respuesta» sí puede volver al mismo menú (como en Leona).
    expect(edgesOf(connectBlocks(reply.draft, { from: menu.blockId, to: menu.blockId, output: "menu-other" }, ids).draft)).toContainEqual([menu.blockId, "menu-other", menu.blockId]);
  });

  it("una salida ocupada no se pisa sin «replace»; agregar en una salida ocupada inserta el bloque en medio", () => {
    const { ids, draft, start } = setup();
    const first = addBlock(draft, { type: "message", after: { blockId: start } }, ids);
    const tags = addBlock(first.draft, { type: "tags", config: { tags: ["nuevo"] } }, ids);
    expect(() => connectBlocks(tags.draft, { from: start, to: tags.blockId }, ids)).toThrow(/ya está conectada.*replace/);
    const replaced = connectBlocks(tags.draft, { from: start, to: tags.blockId, replace: true }, ids);
    expect(replaced.replaced).toEqual({ from: start, to: first.blockId, output: null });

    const inserted = addBlock(first.draft, { type: "tags", config: { tags: ["nuevo"] }, after: { blockId: start } }, ids);
    expect(inserted.insertedBefore).toBe(first.blockId);
    expect(edgesOf(inserted.draft)).toEqual([[start, null, inserted.blockId], [inserted.blockId, null, first.blockId]]);
  });

  it("al quitar una opción del Menú, su conexión se quita y se informa; los tipos de sistema no se configuran", () => {
    const { ids, draft, start } = setup();
    const menu = addBlock(draft, { type: "menu", config: { message: "Elige", options: [{ id: "si", title: "Sí" }, { id: "no", title: "No" }] }, after: { blockId: start } }, ids);
    const yes = addBlock(menu.draft, { type: "message", after: { blockId: menu.blockId, output: "si" } }, ids);
    const no = addBlock(yes.draft, { type: "message", after: { blockId: menu.blockId, output: "no" } }, ids);
    const updated = updateBlock(no.draft, menu.blockId, { name: "¿Compras?", config: { options: [{ id: "si", title: "Sí" }] } }, ids);
    expect(updated.removedConnections).toEqual([{ from: menu.blockId, to: no.blockId, output: "no" }]);
    expect(updated.draft.nodes[menu.blockId]!.name).toBe("¿Compras?");
    expect(() => updateBlock(no.draft, start, { config: { x: 1 } }, ids)).toThrow(/sistema/);
    expect(() => addBlock(draft, { type: "end" }, ids)).toThrow(/No se puede agregar/);
    expect(() => addBlock(draft, { type: "inventado" }, ids)).toThrow(/list_block_types/);
  });

  it("borrar quita el bloque y sus conexiones (el inicio no se borra); desconectar quita una salida", () => {
    const { ids, draft, start } = setup();
    const first = addBlock(draft, { type: "message", after: { blockId: start } }, ids);
    const second = addBlock(first.draft, { type: "message", after: { blockId: first.blockId } }, ids);
    const removed = removeBlock(second.draft, first.blockId);
    expect(removed.removedConnections).toHaveLength(2);
    expect(Object.keys(removed.draft.nodes)).toEqual([start, second.blockId]);
    expect(() => removeBlock(draft, start)).toThrow(/inicio no se puede borrar/);

    const cut = disconnectBlocks(second.draft, { from: first.blockId });
    expect(cut.removed).toEqual({ from: first.blockId, to: second.blockId, output: null });
    expect(() => disconnectBlocks(cut.draft, { from: first.blockId })).toThrow(/no tiene una conexión/);
  });

  it("la revisión dice lo mismo que el editor: configuración incompleta y salidas sin conectar", () => {
    const { ids, draft, start } = setup();
    const menu = addBlock(draft, { type: "menu", after: { blockId: start } }, ids);
    const messages = reviewDraft(menu.draft).issues.map((issue) => issue.message);
    expect(messages).toContainEqual(expect.stringMatching(/Menú.*Añade al menos una opción/));
    expect(messages).toContainEqual(expect.stringMatching(/salidas sin conectar \(Otra respuesta\)/));
  });
});
