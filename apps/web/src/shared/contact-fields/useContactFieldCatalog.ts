import { useCallback, useEffect, useState } from "react";
import type { AdoptFieldsRequest, ContactFieldsResponse, SaveContactFieldRequest } from "@contracts/ContactFieldContracts";
import { RequestError } from "@shared/http/RequestError";
import { adoptContactFields, createContactField, deleteContactField, fetchContactFields, updateContactField } from "./contactFieldsApi";

/** `forbidden`: su rol no ve contactos · `unavailable`: el servidor no tiene el módulo. */
export type ContactFieldCatalogStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/**
 * Los Campos del cliente de la cuenta: UNA sola fuente para Configuración, el
 * editor de flujos y la ficha del CRM. La lista del servidor manda («lleno
 * en» y «lo usan» los calcula él): tras cada cambio se vuelve a pedir, sin
 * volver a «cargando».
 */
export function useContactFieldCatalog() {
  const [data, setData] = useState<ContactFieldsResponse | null>(null);
  const [status, setStatus] = useState<ContactFieldCatalogStatus>("loading");

  /** `true` si cargó (o el servidor dijo que no se puede); `false` si fue un fallo pasajero. */
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      setData(await fetchContactFields());
      setStatus("ready");
      return true;
    } catch (error) {
      const code = error instanceof RequestError ? error.status : 0;
      setStatus((current) => (current === "ready" && code !== 403 && code !== 503 ? current : code === 403 ? "forbidden" : code === 503 ? "unavailable" : "error"));
      return code === 403 || code === 503;
    }
  }, []);

  // Un fallo pasajero al abrir (la sesión renovándose, la base despertando) se reintenta solo: 2 s, 4 s y 8 s.
  useEffect(() => {
    let timer = 0;
    let alive = true;
    const load = async (attempt: number) => {
      if ((await refresh()) || !alive || attempt >= 3) return;
      timer = window.setTimeout(() => void load(attempt + 1), 2000 * 2 ** attempt);
    };
    void load(0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [refresh]);

  /** «Reintentar» tras un error: vuelve a «cargando» a la vista. */
  const reload = useCallback(async () => {
    setStatus("loading");
    await refresh();
  }, [refresh]);

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

  return { data, fields: data?.fields ?? [], status, refresh, reload, create, adopt, update, remove };
}

export type ContactFieldCatalog = ReturnType<typeof useContactFieldCatalog>;
