import { builderApiClient } from "@shared/http/builderApiClient";
import {
  CONTACT_FIELD_CONFIRM_PARAM,
  type AdoptFieldsRequest,
  type ContactFieldDefinition,
  type ContactFieldsResponse,
  type DiscoveryResponse,
  type SaveContactFieldRequest
} from "@contracts/ContactFieldContracts";
import type { ContactFieldValuesResponse, SaveContactFieldValuesRequest } from "@contracts/ContactFieldValueContracts";

// Campos del cliente de la cuenta activa (`/contact-fields`): el catálogo y la
// ficha de cada cliente. Lo comparten Configuración, el editor y el CRM.

const one = (id: string) => `/contact-fields/${encodeURIComponent(id)}`;

export function fetchContactFields(): Promise<ContactFieldsResponse> {
  return builderApiClient.get<ContactFieldsResponse>("/contact-fields");
}

/** Lo que tus flujos e integraciones ya guardan y aún no es un campo (dueños y administradores). */
export function discoverContactFields(): Promise<DiscoveryResponse> {
  return builderApiClient.get<DiscoveryResponse>("/contact-fields/discover");
}

export function createContactField(request: SaveContactFieldRequest): Promise<ContactFieldDefinition> {
  return builderApiClient.post<ContactFieldDefinition>("/contact-fields", request);
}

export async function adoptContactFields(request: AdoptFieldsRequest): Promise<ReadonlyArray<ContactFieldDefinition>> {
  return (await builderApiClient.post<{ fields: ContactFieldDefinition[] }>("/contact-fields/adopt", request)).fields;
}

export function updateContactField(id: string, request: Partial<SaveContactFieldRequest>): Promise<ContactFieldDefinition> {
  return builderApiClient.patch<ContactFieldDefinition>(one(id), request);
}

/** Borra el campo y su dato en todos los clientes: `confirm` es la clave escrita por quien borra. */
export async function deleteContactField(id: string, confirm: string): Promise<void> {
  await builderApiClient.delete<unknown>(`${one(id)}?${CONTACT_FIELD_CONFIRM_PARAM}=${encodeURIComponent(confirm)}`);
}

const values = (contactId: string) => `/contact-fields/values/${encodeURIComponent(contactId)}`;

/** La ficha de un cliente: sus datos y de dónde salió cada uno. */
export function fetchContactFieldValues(contactId: string): Promise<ContactFieldValuesResponse> {
  return builderApiClient.get<ContactFieldValuesResponse>(values(contactId));
}

/** Guarda solo lo que cambió (`null` lo deja sin dato). */
export function saveContactFieldValues(contactId: string, request: SaveContactFieldValuesRequest): Promise<ContactFieldValuesResponse> {
  return builderApiClient.patch<ContactFieldValuesResponse>(values(contactId), request);
}
