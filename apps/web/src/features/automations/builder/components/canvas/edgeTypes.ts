import type { EdgeTypes } from "@xyflow/react";
import { DeletableEdge } from "./DeletableEdge";

/**
 * Registro de tipos de conexión, hermano de `nodeTypes`.
 *
 * Se declara fuera del componente porque React Flow remonta todas las aristas
 * cuando este objeto cambia de identidad; definirlo en el render lo cambiaría
 * en cada pintado.
 */
export const edgeTypes: EdgeTypes = {
  deletable: DeletableEdge
};
