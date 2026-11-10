import { builderApiClient } from "@shared/http/builderApiClient";
import type {
  ContactListResponse,
  ContactSummary,
  CreateContactRequest,
  UpdateContactRequest
} from "@contracts/ContactContracts";

// Contactos de la cuenta activa. El tenant lo resuelve el servidor.

export interface ContactListQuery {
  readonly search?: string;
  readonly labelId?: string;
  readonly page?: number;
  readonly limit?: number;
}

export function fetchContacts(query: ContactListQuery): Promise<ContactListResponse> {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.labelId) params.set("labelId", query.labelId);
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 25));
  return builderApiClient.get<ContactListResponse>(`/contacts?${params.toString()}`);
}

export function createContact(request: CreateContactRequest): Promise<ContactSummary> {
  return builderApiClient.post<ContactSummary>("/contacts", request);
}

export function updateContact(id: string, request: UpdateContactRequest): Promise<ContactSummary> {
  return builderApiClient.patch<ContactSummary>(`/contacts/${encodeURIComponent(id)}`, request);
}

export function setContactLabels(id: string, labelIds: ReadonlyArray<string>): Promise<ContactSummary> {
  return builderApiClient.put<ContactSummary>(`/contacts/${encodeURIComponent(id)}/labels`, { labelIds });
}

export function fetchContact(id: string): Promise<ContactSummary> {
  return builderApiClient.get<ContactSummary>(`/contacts/${encodeURIComponent(id)}`);
}
