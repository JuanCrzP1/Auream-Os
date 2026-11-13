import { useCallback, useEffect, useState } from "react";
import type { BusinessDataResponse, SaveBusinessDatumRequest } from "@contracts/BusinessDataContracts";
import type { ContactFieldValue } from "@contracts/ContactContracts";
import { RequestError } from "@shared/http/RequestError";
import { createBusinessDatum, deleteBusinessDatum, fetchBusinessData, fetchBusinessValues, updateBusinessDatum } from "./businessDataApi";

/** `forbidden`: su rol no los ve · `unavailable`: el servidor no tiene el módulo. */
export type BusinessDataStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

const statusOf = (error: unknown): BusinessDataStatus => {
  const code = error instanceof RequestError ? error.status : 0;
  return code === 403 ? "forbidden" : code === 503 ? "unavailable" : "error";
};

/**
 * Los Datos del negocio con dónde se usa cada uno: Configuración y el editor
 * de flujos. Tras cada cambio se vuelve a pedir la lista (los usos los
 * calcula el servidor), sin volver a «cargando».
 */
export function useBusinessData() {
  const [data, setData] = useState<BusinessDataResponse | null>(null);
  const [status, setStatus] = useState<BusinessDataStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setData(await fetchBusinessData());
      setStatus("ready");
    } catch (error) {
      // Con la lista ya cargada, un fallo pasajero no la borra de la vista.
      setStatus((current) => (current === "ready" && statusOf(error) === "error" ? current : statusOf(error)));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reload = useCallback(async () => {
    setStatus("loading");
    await refresh();
  }, [refresh]);

  const create = useCallback(async (request: SaveBusinessDatumRequest) => {
    const created = await createBusinessDatum(request);
    await refresh();
    return created;
  }, [refresh]);

  const update = useCallback(async (id: string, request: Partial<SaveBusinessDatumRequest>) => {
    const updated = await updateBusinessDatum(id, request);
    await refresh();
    return updated;
  }, [refresh]);

  const remove = useCallback(async (id: string, confirm?: string) => {
    await deleteBusinessDatum(id, confirm);
    await refresh();
  }, [refresh]);

  return { data, list: data?.data ?? [], status, refresh, reload, create, update, remove };
}

/**
 * Solo los valores (`{ g_horario: "…" }`): el chat y las difusiones los ponen
 * en el texto. Si no se pueden leer, ninguno: los textos quedan con su valor
 * por defecto, igual que en los flujos.
 */
export function useBusinessValues(): Readonly<Record<string, ContactFieldValue>> {
  const [values, setValues] = useState<Readonly<Record<string, ContactFieldValue>>>({});
  useEffect(() => {
    let alive = true;
    fetchBusinessValues()
      .then((response) => alive && setValues(response.values))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return values;
}
