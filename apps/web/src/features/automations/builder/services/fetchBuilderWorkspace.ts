import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";
import { requestBuilderApi } from "./requestBuilderApi";
import { createLocalBuilderWorkspace } from "./createLocalBuilderWorkspace";

/**
 * Carga el workspace del builder.
 *
 * EL RESPALDO LOCAL EXISTE, PERO NO PUEDE PASAR POR PERSISTENCIA.
 *
 * `fetch` rechaza con `TypeError` por dos motivos que no se parecen en nada: no
 * haber red, o que el navegador haya bloqueado la petición por configuración
 * —una cabecera fuera de la lista blanca de CORS, por ejemplo—. Tratar los dos
 * casos como «trabajemos en local» costó semanas de builder sin guardar nada:
 * la interfaz seguía respondiendo, el indicador decía «Guardado» sobre un
 * workspace que solo vivía en memoria, y el error de configuración no se veía
 * por ningún sitio.
 *
 * Ahora el respaldo:
 *
 *   SOLO EN DESARROLLO. En producción, un transporte roto se propaga: quien
 *   despliega tiene que enterarse, no seguir editando sobre nada.
 *   SIEMPRE SE ANUNCIA. Se deja constancia de que ese workspace NO está
 *   persistido y de cuál es la causa probable, con el detalle del error.
 *
 * Lo que NO cambia: sigue sin haber una segunda fuente de verdad. El respaldo
 * es un workspace vacío en memoria para poder abrir el editor sin API, no un
 * almacén paralelo del que restaurar nada.
 */
export async function fetchBuilderWorkspace(
  flowKey: string,
  tenantId: string
): Promise<PersistedBuilderWorkspace> {
  try {
    return await requestBuilderApi<PersistedBuilderWorkspace>(`/api/builder/flows/${flowKey}/workspace`);
  } catch (error) {
    if (!(error instanceof TypeError) || !import.meta.env.DEV) throw error;

    console.error(
      `[builder] La API no respondió para el flujo "${flowKey}". Se abre un workspace EN MEMORIA: ` +
        "nada de lo que edites aquí se guardará. Causas habituales: la API no está levantada, o el " +
        "navegador bloqueó la petición por CORS (una cabecera que el servidor no autoriza).",
      error
    );

    return createLocalBuilderWorkspace(flowKey, tenantId);
  }
}
