import { builderApiClient } from "@shared/http/builderApiClient";
import {
  BUSINESS_DATA_CONFIRM_PARAM,
  type BusinessDataResponse,
  type BusinessDatum,
  type BusinessValuesResponse,
  type SaveBusinessDatumRequest
} from "@contracts/BusinessDataContracts";

// Datos del negocio de la cuenta activa (`/business-data`). Lo usan
// Configuración, el editor de flujos, el chat y las difusiones.

const one = (id: string) => `/business-data/${encodeURIComponent(id)}`;

export function fetchBusinessData(): Promise<BusinessDataResponse> {
  return builderApiClient.get<BusinessDataResponse>("/business-data");
}

/** Solo los valores, con su tipo: para poner `{g_…}` en un texto. */
export function fetchBusinessValues(): Promise<BusinessValuesResponse> {
  return builderApiClient.get<BusinessValuesResponse>("/business-data/values");
}

export function createBusinessDatum(request: SaveBusinessDatumRequest): Promise<BusinessDatum> {
  return builderApiClient.post<BusinessDatum>("/business-data", request);
}

export function updateBusinessDatum(id: string, request: Partial<SaveBusinessDatumRequest>): Promise<BusinessDatum> {
  return builderApiClient.patch<BusinessDatum>(one(id), request);
}

/** `confirm`: la clave escrita por quien borra (solo hace falta si algún mensaje lo usa). */
export async function deleteBusinessDatum(id: string, confirm = ""): Promise<void> {
  await builderApiClient.delete<unknown>(confirm ? `${one(id)}?${BUSINESS_DATA_CONFIRM_PARAM}=${encodeURIComponent(confirm)}` : one(id));
}
