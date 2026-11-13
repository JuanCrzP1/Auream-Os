import { useCallback, useEffect, useState } from "react";
import type { AdoptFieldsRequest, ContactFieldsResponse, SaveContactFieldRequest } from "@contracts/ContactFieldContracts";
import { adoptContactFields, createContactField, deleteContactField, fetchContactFields, updateContactField } from "./contactFieldsApi";

export type ContactFieldsState = { readonly status: "loading" } | { readonly status: "error" } | { readonly status: "ready"; readonly data: ContactFieldsResponse };

/**
 * Los campos de la cuenta con su uso. Después de crear, convertir, editar o
 * borrar se vuelve a leer: «lleno en» y «lo usan» los calcula el servidor.
 */
export function useContactFields() {
  const [state, setState] = useState<ContactFieldsState>({ status: "loading" });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await fetchContactFields() });
    } catch {
      if (!quiet) setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const create = useCallback(async (request: SaveContactFieldRequest) => {
    const created = await createContactField(request);
    await refresh();
    return created;
  }, [refresh]);

  const adopt = useCallback(async (request: AdoptFieldsRequest) => {
    const created = await adoptContactFields(request);
    await refresh();
    return created;
  }, [refresh]);

  const update = useCallback(async (id: string, request: Partial<SaveContactFieldRequest>) => {
    const updated = await updateContactField(id, request);
    await refresh();
    return updated;
  }, [refresh]);

  const remove = useCallback(async (id: string, confirm: string) => {
    await deleteContactField(id, confirm);
    await refresh();
  }, [refresh]);

  return { state, reload: load, create, adopt, update, remove };
}
