import { createContext, useContext, useMemo, type ReactNode } from "react";
import { VARIABLE_GROUPS, type CatalogVariable } from "@contracts/VariableCatalog";
import type { ToolResources } from "../../ToolResources";

// ---------------------------------------------------------------------------
// De dónde salen las variables del botón «{ } Variables»: las fijas
// (`VariableCatalog`: del cliente, del sistema, del anuncio, de otros bloques)
// y las de la cuenta (sus Campos del cliente y sus Datos del negocio). El
// editor de cada bloque las pone una vez (`ToolEditorLayout` con `resources`)
// y cualquier campo del kit las usa sin pasarlas a mano.
// ---------------------------------------------------------------------------

export interface PickerGroup {
  readonly id: string;
  readonly title: string;
  readonly variables: ReadonlyArray<CatalogVariable>;
}

const VariableSourcesContext = createContext<ReadonlyArray<PickerGroup>>(VARIABLE_GROUPS);

/** Los grupos con los de la cuenta, en el orden en que se buscan más. */
export function variableGroups(resources: ToolResources | undefined): ReadonlyArray<PickerGroup> {
  const [contact, ...rest] = VARIABLE_GROUPS;
  const fields = (resources?.contactFields?.fields ?? []).map((field) => ({ name: field.key, label: field.label }));
  const business = (resources?.businessData ?? []).map((datum) => ({ name: datum.key, label: datum.label }));
  return [
    contact!,
    ...(fields.length ? [{ id: "fields", title: "Campos del cliente", variables: fields }] : []),
    ...(business.length ? [{ id: "business", title: "Datos del negocio", variables: business }] : []),
    ...rest
  ];
}

export function VariableSourcesProvider({ resources, children }: { readonly resources: ToolResources | undefined; readonly children: ReactNode }) {
  const groups = useMemo(() => variableGroups(resources), [resources]);
  return <VariableSourcesContext.Provider value={groups}>{children}</VariableSourcesContext.Provider>;
}

export function useVariableSources(): ReadonlyArray<PickerGroup> {
  return useContext(VariableSourcesContext);
}
