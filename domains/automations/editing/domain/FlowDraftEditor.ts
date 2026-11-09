import type { BuilderFlowEdge, BuilderFlowNode, BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { BlockData, BlockOutput } from "../../../../contracts/blocks/BlockRules";
import { blockOutputs, findBlockRules } from "../../../../contracts/blocks/blockCatalog";
import { checkConnection, isValidOutput } from "../../../../contracts/blocks/connectionRules";
import { NotFoundError } from "../../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";
import { placeNewBlock } from "./blockPlacement";
import { allEdgesOf, graphEdgesOf, graphNodesOf, withEdges } from "./draftGraph";
import { prepareBlockConfig } from "./prepareBlockConfig";

// ---------------------------------------------------------------------------
// Editar el borrador de un flujo con operaciones pequeñas y seguras, como las
// hace una persona en el lienzo: agregar, configurar, borrar, conectar y
// desconectar bloques. Puras: reciben el borrador y devuelven el nuevo.
//
// Las reglas son las del editor (`contracts/blocks`): mismos bloques, mismos
// valores por defecto, misma forma canónica de la configuración y mismas
// reglas de conexión. Un cambio que el editor no permitiría, aquí tampoco.
// ---------------------------------------------------------------------------

export interface EditIds {
  /** Id nuevo y único (`prefix` orienta: «edge», «opt»…). */
  readonly newId: (prefix: string) => string;
}

/** Una conexión, como se le cuenta a quien edita. */
export interface ConnectionRef {
  readonly from: string;
  readonly to: string;
  readonly output: string | null;
}

export type EditResult<T> = { readonly draft: BuilderFlowSnapshot } & T;

const MAX_NAME = 80;
const refOf = (edge: BuilderFlowEdge): ConnectionRef => ({ from: edge.fromNodeId, to: edge.toNodeId, output: edge.fromOutput ?? null });

function requireBlock(draft: BuilderFlowSnapshot, blockId: string): BuilderFlowNode {
  const node = draft.nodes[blockId];
  if (!node) throw new NotFoundError(`El bloque «${blockId}» no existe en este flujo. Usa get_flow para ver los ids.`);
  return node;
}

function requireName(value: string | undefined, fallback: string): string {
  const name = (value ?? fallback).trim();
  if (!name) throw new ValidationError("El nombre del bloque no puede quedar vacío.");
  if (name.length > MAX_NAME) throw new ValidationError(`El nombre del bloque admite hasta ${MAX_NAME} caracteres.`);
  return name;
}

const describeOutputs = (outputs: ReadonlyArray<BlockOutput>) => outputs.map((output) => `«${output.id}» (${output.label})`).join(", ");

/** La salida a usar: obligatoria (y existente) en bloques con varias; ninguna en los de salida única. */
function resolveOutput(draft: BuilderFlowSnapshot, node: BuilderFlowNode, output: string | null | undefined): string | null {
  const outputs = node.id === draft.version.entryNodeId ? null : blockOutputs(node.type, node.config);
  if (outputs === null) {
    if (output) throw new ValidationError(`«${node.name}» tiene una sola salida: no indiques «output».`);
    return null;
  }
  if (!output) throw new ValidationError(`«${node.name}» tiene varias salidas: indica cuál en «output». Salidas: ${describeOutputs(outputs) || "ninguna (configúralas primero)"}.`);
  if (!isValidOutput(node.type, node.config, output)) throw new ValidationError(`«${node.name}» no tiene la salida «${output}». Salidas: ${describeOutputs(outputs)}.`);
  return output;
}

/** Quita las conexiones que salen de salidas que el bloque ya no tiene (p. ej., al borrar una opción del Menú). */
function pruneDanglingEdges(draft: BuilderFlowSnapshot): { draft: BuilderFlowSnapshot; removed: ConnectionRef[] } {
  const edges = allEdgesOf(draft);
  const kept = edges.filter((edge) => {
    const source = draft.nodes[edge.fromNodeId];
    if (!source || !draft.nodes[edge.toNodeId]) return false;
    return source.id === draft.version.entryNodeId ? !edge.fromOutput : isValidOutput(source.type, source.config, edge.fromOutput);
  });
  if (kept.length === edges.length) return { draft, removed: [] };
  return { draft: withEdges(draft, kept), removed: edges.filter((edge) => !kept.includes(edge)).map(refOf) };
}

export function connectBlocks(
  draft: BuilderFlowSnapshot,
  request: { readonly from: string; readonly to: string; readonly output?: string | null; readonly replace?: boolean },
  ids: EditIds
): EditResult<{ readonly connection: ConnectionRef; readonly replaced: ConnectionRef | null }> {
  const source = requireBlock(draft, request.from);
  requireBlock(draft, request.to);
  const output = resolveOutput(draft, source, request.output);
  const current = (draft.edgesBySource[source.id] ?? []).find((edge) => (edge.fromOutput ?? null) === output) ?? null;
  const base = current && request.replace ? withEdges(draft, allEdgesOf(draft).filter((edge) => edge !== current)) : draft;

  const check = checkConnection(graphNodesOf(base), graphEdgesOf(base), { source: source.id, target: request.to, output });
  if (!check.ok) throw new ValidationError(check.reason === "output-taken" ? `${check.message} (o usa «replace: true»).` : check.message);

  const siblings = base.edgesBySource[source.id] ?? [];
  const edge: BuilderFlowEdge = {
    id: ids.newId("edge"),
    fromNodeId: source.id,
    toNodeId: request.to,
    ...(output ? { fromOutput: output } : {}),
    // Prioridades distintas entre hermanas (lo exige la validación del grafo).
    priority: siblings.reduce((max, item) => Math.max(max, item.priority), 0) + 10,
    isFallback: false,
    condition: { operator: "always" }
  };
  return { draft: withEdges(base, [...allEdgesOf(base), edge]), connection: refOf(edge), replaced: current && request.replace ? refOf(current) : null };
}

export function disconnectBlocks(draft: BuilderFlowSnapshot, request: { readonly from: string; readonly output?: string | null }): EditResult<{ readonly removed: ConnectionRef }> {
  const source = requireBlock(draft, request.from);
  const output = request.output ?? null;
  const edge = (draft.edgesBySource[source.id] ?? []).find((item) => (item.fromOutput ?? null) === output);
  if (!edge) throw new NotFoundError(output ? `La salida «${output}» de «${source.name}» no está conectada.` : `«${source.name}» no tiene una conexión de salida.`);
  return { draft: withEdges(draft, allEdgesOf(draft).filter((item) => item !== edge)), removed: refOf(edge) };
}

export function addBlock(
  draft: BuilderFlowSnapshot,
  request: { readonly type: string; readonly name?: string; readonly config?: BlockData; readonly after?: { readonly blockId: string; readonly output?: string | null } },
  ids: EditIds
): EditResult<{ readonly blockId: string; readonly ignoredFields: ReadonlyArray<string>; readonly connection: ConnectionRef | null; readonly insertedBefore: string | null }> {
  const rules = findBlockRules(request.type);
  if (!rules || !rules.availableInPalette) throw new ValidationError(`No se puede agregar un bloque «${request.type}». Usa list_block_types para ver los tipos.`);
  const { config, ignoredFields } = prepareBlockConfig(rules, rules.defaultConfig, request.config, ids.newId);

  // La conexión se valida ANTES de crear nada: un error no deja bloques sueltos.
  const parent = request.after ? requireBlock(draft, request.after.blockId) : null;
  const output = parent ? resolveOutput(draft, parent, request.after?.output) : null;
  const slot = parent && output ? Math.max(0, (blockOutputs(parent.type, parent.config) ?? []).findIndex((item) => item.id === output)) : 0;

  const id = ids.newId(rules.type);
  const node: BuilderFlowNode = {
    id,
    type: rules.type,
    name: requireName(request.name, rules.label),
    content: JSON.parse(JSON.stringify(rules.defaultContent)) as BlockData,
    config,
    metadata: { ui: placeNewBlock(draft, parent?.id ?? null, slot) }
  };
  const added = { ...draft, nodes: { ...draft.nodes, [id]: node } };
  if (!parent) return { draft: added, blockId: id, ignoredFields, connection: null, insertedBefore: null };

  // Si esa salida ya llevaba a otro bloque, el nuevo se INSERTA en medio (como
  // al insertar un paso en el editor): padre → nuevo → el que seguía.
  const next = (draft.edgesBySource[parent.id] ?? []).find((edge) => (edge.fromOutput ?? null) === output)?.toNodeId ?? null;
  if (next && blockOutputs(node.type, node.config) !== null) {
    throw new ValidationError(`Esa salida de «${parent.name}» ya está conectada y «${node.name}» tiene varias salidas: desconéctala primero o agrégalo en otra salida.`);
  }
  const linked = connectBlocks(added, { from: parent.id, to: id, output, replace: true }, ids);
  const continued = next ? connectBlocks(linked.draft, { from: id, to: next }, ids).draft : linked.draft;
  return { draft: continued, blockId: id, ignoredFields, connection: linked.connection, insertedBefore: next };
}

export function updateBlock(
  draft: BuilderFlowSnapshot,
  blockId: string,
  request: { readonly name?: string; readonly config?: BlockData },
  ids: EditIds
): EditResult<{ readonly ignoredFields: ReadonlyArray<string>; readonly removedConnections: ReadonlyArray<ConnectionRef> }> {
  const node = requireBlock(draft, blockId);
  const rules = findBlockRules(node.type);
  if (request.config !== undefined && (!rules || !rules.availableInPalette)) throw new ValidationError(`«${node.name}» es un bloque del sistema: solo se le puede cambiar el nombre.`);
  const prepared = request.config !== undefined && rules ? prepareBlockConfig(rules, node.config, request.config, ids.newId) : { config: node.config, ignoredFields: [] };
  const next: BuilderFlowNode = { ...node, name: requireName(request.name, node.name), config: prepared.config };
  const { draft: pruned, removed } = pruneDanglingEdges({ ...draft, nodes: { ...draft.nodes, [blockId]: next } });
  return { draft: pruned, ignoredFields: prepared.ignoredFields, removedConnections: removed };
}

export function removeBlock(draft: BuilderFlowSnapshot, blockId: string): EditResult<{ readonly removedConnections: ReadonlyArray<ConnectionRef> }> {
  const node = requireBlock(draft, blockId);
  if (blockId === draft.version.entryNodeId) throw new ValidationError("El bloque de inicio no se puede borrar: es donde empieza el flujo.");
  const { [blockId]: _removed, ...nodes } = draft.nodes;
  void _removed;
  const touching = allEdgesOf(draft).filter((edge) => edge.fromNodeId === node.id || edge.toNodeId === node.id);
  const kept = allEdgesOf(draft).filter((edge) => !touching.includes(edge));
  return { draft: withEdges({ ...draft, nodes }, kept), removedConnections: touching.map(refOf) };
}
