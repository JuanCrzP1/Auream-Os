import { Handle, Position } from "@xyflow/react";

/**
 * Punto de salida con nombre de un nodo con varios caminos.
 *
 * Las herramientas que declaran `outputs()` montan uno por salida dentro de su
 * `CompactBody`, junto a su rótulo. El `id` es el de la salida, y es lo que la
 * arista guarda como `fromOutput`.
 */
export function OutputHandle({ id, className }: { readonly id: string; readonly className?: string }) {
  return (
    <Handle
      type="source"
      id={id}
      position={Position.Right}
      className={`flow-node__handle flow-node__handle--source${className ? ` ${className}` : ""}`}
    />
  );
}
