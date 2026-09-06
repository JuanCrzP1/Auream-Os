import type { AutomationFolderSummary, AutomationSummary } from "@contracts/AutomationContracts";

// ---------------------------------------------------------------------------
// QUÉ SE VE EN EL HUB, SEGÚN DÓNDE ESTÉ EL USUARIO.
//
// La pertenencia a una carpeta ya la declara `AutomationSummary.folderId`. Lo
// que faltaba era decidir, a partir de ese dato, qué entra en la vista:
//
//   EN LA RAÍZ     solo las automatizaciones que no están en ninguna carpeta.
//                  Antes se mostraban todas, así que mover una a una carpeta
//                  no la quitaba de en medio y la carpeta era un contador.
//   EN UNA CARPETA solo las suyas, y como destinos de arrastre las DEMÁS
//                  carpetas: la que se está mirando no puede ser su propio
//                  destino.
//
// ES UNA FUNCIÓN PURA, y ahí está el motivo de que exista: la regla es la
// misma en las dos vistas y escribirla en el componente la habría duplicado
// —una copia para la raíz y otra para dentro— con dos sitios donde podría
// dejar de coincidir. Aquí se lee una vez y no necesita React para probarse.
//
// NO INVENTA PERTENENCIA. No agrupa, no indexa y no guarda nada: recibe la
// lista del servidor tal cual llega y devuelve una vista de ella.
// ---------------------------------------------------------------------------

/** Dónde está el usuario: en la raíz, o dentro de una carpeta. */
export type HubLocation = { readonly folderId: string | null };

export interface HubContents {
  /** Automatizaciones que se pintan aquí, ya filtradas por búsqueda. */
  readonly flows: ReadonlyArray<AutomationSummary>;
  /** Carpetas que se pintan aquí. Nunca la que se está mirando. */
  readonly folders: ReadonlyArray<AutomationFolderSummary>;
  /** La carpeta abierta, o `null` en la raíz. */
  readonly currentFolder: AutomationFolderSummary | null;
  /** Cuántas automatizaciones tiene cada carpeta, por id. */
  readonly countByFolder: ReadonlyMap<string, number>;
  /** `true` si no hay nada que enseñar en esta ubicación. */
  readonly isEmpty: boolean;
}

/** `true` si la automatización vive en esta ubicación. */
function perteneceA(flow: AutomationSummary, folderId: string | null): boolean {
  return (flow.folderId ?? null) === folderId;
}

export function selectHubContents(
  flows: ReadonlyArray<AutomationSummary>,
  folders: ReadonlyArray<AutomationFolderSummary>,
  location: HubLocation,
  search: string
): HubContents {
  const { folderId } = location;

  // El recuento se hace sobre TODAS las automatizaciones, no sobre las
  // filtradas: una búsqueda no cambia cuántas contiene una carpeta.
  const countByFolder = new Map<string, number>();
  for (const flow of flows) {
    if (flow.folderId === undefined) continue;
    countByFolder.set(flow.folderId, (countByFolder.get(flow.folderId) ?? 0) + 1);
  }

  const termino = search.trim().toLowerCase();
  const visibles = flows.filter(
    (flow) =>
      perteneceA(flow, folderId) &&
      (termino.length === 0 || flow.name.toLowerCase().includes(termino))
  );

  const currentFolder = folderId === null ? null : folders.find((f) => f.id === folderId) ?? null;

  return {
    flows: visibles,
    // Dentro de una carpeta se listan las demás: son los destinos a los que
    // se puede arrastrar desde aquí.
    folders: folderId === null ? folders : folders.filter((f) => f.id !== folderId),
    currentFolder,
    countByFolder,
    isEmpty: visibles.length === 0
  };
}
