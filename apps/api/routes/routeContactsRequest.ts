import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ContactPermissions } from "../../../platform/authorization/permissions/ContactPermissions";
import type { ContactsServices } from "../composition/composeContactsServices";
import type {
  ContactListResponse,
  CreateContactRequest,
  CreateLabelRequest,
  SetContactLabelsRequest,
  UpdateContactRequest,
  UpdateLabelRequest
} from "../../../contracts/ContactContracts";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import { toContactSummary, toLabelSummary } from "../http/toContactResponses";

// ---------------------------------------------------------------------------
// routeContactsRequest — `/contacts` y `/labels`.
//
// Solo traduce HTTP ↔ caso de uso. Leer exige `contacts.read`; escribir,
// `contacts.write`. El tenant llega SIEMPRE del contexto autenticado. Las
// reglas (nombres únicos, colores, etiquetas de la misma cuenta…) y sus
// errores (422, 404, 409) son del dominio.
// ---------------------------------------------------------------------------

const CONTACT_ID = /^\/contacts\/([^/]+)$/;
const CONTACT_LABELS = /^\/contacts\/([^/]+)\/labels$/;
const LABEL_ID = /^\/labels\/([^/]+)$/;

export async function routeContactsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: ContactsServices,
  context: RequestContext
): Promise<boolean> {
  const { tenantId } = context;
  const method = request.method ?? "GET";
  const path = url.pathname;

  // --- Catálogo de etiquetas ------------------------------------------------
  if (path === "/labels" && method === "GET") {
    requireScope(context, ContactPermissions.read, tenantId);
    sendJson(response, 200, { labels: (await services.listLabels.execute(tenantId)).map(toLabelSummary) });
    return true;
  }

  if (path === "/labels" && method === "POST") {
    requireScope(context, ContactPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<CreateLabelRequest>>(request);
    sendJson(response, 201, toLabelSummary(await services.createLabel.execute(tenantId, body)));
    return true;
  }

  const label = LABEL_ID.exec(path);
  if (label && method === "PATCH") {
    requireScope(context, ContactPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<UpdateLabelRequest>>(request);
    sendJson(response, 200, toLabelSummary(await services.updateLabel.execute(tenantId, label[1]!, body)));
    return true;
  }

  if (label && method === "DELETE") {
    requireScope(context, ContactPermissions.write, tenantId);
    await services.deleteLabel.execute(tenantId, label[1]!);
    sendJson(response, 200, { deleted: true });
    return true;
  }

  // --- Contactos ------------------------------------------------------------
  if (path === "/contacts" && method === "GET") {
    requireScope(context, ContactPermissions.read, tenantId);
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "25");
    const result = await services.listContacts.execute(tenantId, {
      search: url.searchParams.get("search") ?? undefined,
      labelId: url.searchParams.get("labelId") ?? undefined,
      page,
      limit
    });
    const body: ContactListResponse = {
      contacts: result.items.map(toContactSummary),
      page: Number.isInteger(page) && page > 0 ? page : 1,
      hasMore: result.hasMore
    };
    sendJson(response, 200, body);
    return true;
  }

  if (path === "/contacts" && method === "POST") {
    requireScope(context, ContactPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<CreateContactRequest>>(request);
    sendJson(response, 201, toContactSummary(await services.createContact.execute(tenantId, body)));
    return true;
  }

  const contactLabels = CONTACT_LABELS.exec(path);
  if (contactLabels && method === "PUT") {
    requireScope(context, ContactPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<SetContactLabelsRequest>>(request);
    if (!Array.isArray(body.labelIds) || !body.labelIds.every((id) => typeof id === "string")) {
      sendJson(response, 400, { message: "labelIds debe ser una lista de identificadores" });
      return true;
    }
    sendJson(response, 200, toContactSummary(await services.setContactLabels.execute(tenantId, contactLabels[1]!, body.labelIds)));
    return true;
  }

  const contact = CONTACT_ID.exec(path);
  if (contact && method === "GET") {
    requireScope(context, ContactPermissions.read, tenantId);
    sendJson(response, 200, toContactSummary(await services.getContact.execute(tenantId, contact[1]!)));
    return true;
  }

  if (contact && method === "PATCH") {
    requireScope(context, ContactPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<UpdateContactRequest>>(request);
    sendJson(response, 200, toContactSummary(await services.updateContact.execute(tenantId, contact[1]!, body)));
    return true;
  }

  return false;
}
