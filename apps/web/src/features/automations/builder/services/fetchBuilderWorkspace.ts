import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";
import { requestBuilderApi } from "./requestBuilderApi";
import { createLocalBuilderWorkspace } from "./createLocalBuilderWorkspace";

/**
 * Carga el workspace del builder.
 *
 * Si la API no es alcanzable (fallo de red, no error HTTP) se devuelve un
 * workspace local en memoria para no bloquear la edición. Ese workspace NO está
 * persistido en el servidor.
 */
export async function fetchBuilderWorkspace(
  flowKey: string,
  tenantId: string
): Promise<PersistedBuilderWorkspace> {
  try {
    return await requestBuilderApi<PersistedBuilderWorkspace>(`/api/builder/flows/${flowKey}/workspace`);
  } catch (error) {
    if (error instanceof TypeError) {
      return createLocalBuilderWorkspace(flowKey, tenantId);
    }

    throw error;
  }
}
