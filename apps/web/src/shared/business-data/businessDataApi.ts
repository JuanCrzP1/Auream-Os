import { builderApiClient } from "@shared/http/builderApiClient";
import {
  BUSINESS_DATA_CONFIRM_PARAM,
  type BusinessDataResponse,
  type BusinessDatum,
  type BusinessValuesResponse,
  type SaveBusinessDatumRequest
} from "@contracts/BusinessDataContracts";
import type { BusinessDataHistoryResponse, SaveBusinessScheduleRequest } from "@contracts/BusinessDataTimeline";

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

/** Programa otro valor entre dos fechas; devuelve el dato con sus programados al día. */
export function scheduleBusinessDatum(id: string, request: SaveBusinessScheduleRequest): Promise<BusinessDatum> {
  return builderApiClient.post<BusinessDatum>(`${one(id)}/schedules`, request);
}

export function rescheduleBusinessDatum(id: string, scheduleId: string, request: Partial<SaveBusinessScheduleRequest>): Promise<BusinessDatum> {
  return builderApiClient.patch<BusinessDatum>(`${one(id)}/schedules/${encodeURIComponent(scheduleId)}`, request);
}

/** Quita uno que no ha empezado, o termina ya uno activo. */
export function unscheduleBusinessDatum(id: string, scheduleId: string): Promise<BusinessDatum> {
  return builderApiClient.delete<BusinessDatum>(`${one(id)}/schedules/${encodeURIComponent(scheduleId)}`);
}

export function fetchBusinessDataHistory(id: string): Promise<BusinessDataHistoryResponse> {
  return builderApiClient.get<BusinessDataHistoryResponse>(`${one(id)}/history`);
}
