import { describe, expect, it, vi } from "vitest";
import { routeContactsRequest } from "../../apps/api/routes/routeContactsRequest.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext } from "./helpers/access.js";
import { makeRequest, makeResponse } from "./helpers/automationsRoute.js";
import type { ContactsServices } from "../../apps/api/composition/composeContactsServices.js";

// ---------------------------------------------------------------------------
// /contacts y /labels: leer exige contacts.read; escribir, contacts.write. El
// tenant sale del contexto autenticado, nunca de la petición.
// ---------------------------------------------------------------------------

function services() {
  const label = { id: "l1", tenantId: "test-tenant", name: "VIP", color: "#64748b", createdAt: "2026-01-01" };
  const contact = { contact: { id: "c1", tenantId: "test-tenant", channel: "whatsapp", externalKey: "57300", name: null, phone: "57300", email: null, customFields: {}, createdAt: "x", updatedAt: "x" }, labels: [] };
  return {
    listLabels: { execute: vi.fn(async () => [{ ...label, contactCount: 0 }]) },
    createLabel: { execute: vi.fn(async () => label) },
    updateLabel: { execute: vi.fn(async () => label) },
    deleteLabel: { execute: vi.fn(async () => undefined) },
    listContacts: { execute: vi.fn(async () => ({ items: [contact], hasMore: false })) },
    getContact: { execute: vi.fn(async () => contact) },
    createContact: { execute: vi.fn(async () => contact) },
    updateContact: { execute: vi.fn(async () => contact) },
    setContactLabels: { execute: vi.fn(async () => contact) },
    directory: {}
  } as unknown as ContactsServices & Record<string, { execute: ReturnType<typeof vi.fn> }>;
}

const WRITES = [
  ["POST", "/labels", { name: "x" }, "createLabel"],
  ["PATCH", "/labels/l1", { name: "y" }, "updateLabel"],
  ["DELETE", "/labels/l1", undefined, "deleteLabel"],
  ["POST", "/contacts", { phone: "573001234567" }, "createContact"],
  ["PATCH", "/contacts/c1", { name: "Ana" }, "updateContact"],
  ["PUT", "/contacts/c1/labels", { labelIds: ["l1"] }, "setContactLabels"]
] as const;

describe("routeContactsRequest — permisos", () => {
  it.each([["GET", "/labels", "listLabels"], ["GET", "/contacts", "listContacts"], ["GET", "/contacts/c1", "getContact"]] as const)(
    "%s %s con contacts.read llega al caso de uso con el tenant del contexto",
    async (method, path, service) => {
      const s = services();
      const handled = await routeContactsRequest(makeRequest(method), makeResponse(), new URL(`http://localhost${path}`), s, makeContext({ scopes: ["contacts.read"] }));
      expect(handled).toBe(true);
      expect((s as unknown as Record<string, { execute: { mock: { calls: unknown[][] } } }>)[service]!.execute.mock.calls[0]?.[0]).toBe("test-tenant");
    }
  );

  it.each(WRITES)("%s %s sin contacts.write lanza AccessError y no escribe", async (method, path, body, service) => {
    const s = services();
    await expect(
      routeContactsRequest(makeRequest(method, body), makeResponse(), new URL(`http://localhost${path}`), s, makeContext({ scopes: ["contacts.read"] }))
    ).rejects.toThrow(AccessError);
    expect((s as unknown as Record<string, { execute: { mock: { calls: unknown[] } } }>)[service]!.execute.mock.calls).toHaveLength(0);
  });

  it("leer sin contacts.read también se rechaza", async () => {
    await expect(
      routeContactsRequest(makeRequest("GET"), makeResponse(), new URL("http://localhost/contacts"), services(), makeContext({ scopes: ["flows.read"] }))
    ).rejects.toThrow(AccessError);
  });
});
