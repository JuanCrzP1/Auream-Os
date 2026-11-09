import type { ContactsServices } from "../../composition/composeContactsServices";
import { toContactSummary, toLabelSummary } from "../../http/toContactResponses";
import { NotFoundError } from "../../../../platform/observability/errors/NotFoundError";
import type { McpTool } from "../McpTool";

// Contactos y etiquetas: ver (`contacts.read`) y crear, editar y etiquetar
// (`contacts.write`). Mismos servicios y validaciones que la pantalla Contactos.

type ContactServices = Pick<ContactsServices, "listContacts" | "getContact" | "createContact" | "updateContact" | "listLabels" | "directory">;

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []);

export function contactTools(services: ContactServices): McpTool[] {
  return [
    {
      name: "list_contacts",
      title: "Buscar contactos",
      description: "Busca contactos por nombre, teléfono o correo, o por etiqueta. Devuelve 25 por página (`page` desde 1) y si hay más.",
      scope: "contacts.read",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texto a buscar en nombre, teléfono o correo." },
          label: { type: "string", description: "Nombre de una etiqueta (de list_labels)." },
          page: { type: "integer", description: "Página, desde 1." }
        }
      },
      run: async (args, { tenantId }) => {
        const label = typeof args["label"] === "string" ? args["label"].trim().toLowerCase() : "";
        const labelId = label ? (await services.listLabels.execute(tenantId)).find((item) => item.name.toLowerCase() === label)?.id : undefined;
        if (label && !labelId) return { contacts: [], hasMore: false, note: "No existe esa etiqueta en la cuenta." };
        const page = await services.listContacts.execute(tenantId, {
          ...(typeof args["search"] === "string" ? { search: args["search"] } : {}),
          ...(labelId ? { labelId } : {}),
          ...(typeof args["page"] === "number" ? { page: args["page"] } : {})
        });
        return { contacts: page.items.map(toContactSummary), hasMore: page.hasMore };
      }
    },
    {
      name: "get_contact",
      title: "Ver un contacto",
      description: "Un contacto con sus datos, campos personalizados y etiquetas.",
      scope: "contacts.read",
      readOnly: true,
      inputSchema: { type: "object", properties: { contact_id: { type: "string", description: "Id del contacto (de list_contacts)." } }, required: ["contact_id"] },
      run: async (args, { tenantId }) => toContactSummary(await services.getContact.execute(tenantId, String(args["contact_id"])))
    },
    {
      name: "list_labels",
      title: "Listar etiquetas",
      description: "Las etiquetas de la cuenta, con cuántos contactos tiene cada una.",
      scope: "contacts.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, { tenantId }) => ({ labels: (await services.listLabels.execute(tenantId)).map(toLabelSummary) })
    },
    {
      name: "create_contact",
      title: "Crear un contacto",
      description: "Crea un contacto de WhatsApp. El teléfono va con su prefijo de país (p. ej. 573001234567). Si ya existe, devuelve el existente.",
      scope: "contacts.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Teléfono con prefijo de país, solo dígitos." },
          name: { type: "string", description: "Nombre." },
          email: { type: "string", description: "Correo." }
        },
        required: ["phone"]
      },
      run: async (args, { tenantId }) => toContactSummary(await services.createContact.execute(tenantId, { phone: args["phone"], name: args["name"], email: args["email"] }))
    },
    {
      name: "update_contact",
      title: "Editar un contacto",
      description: "Cambia el nombre o el correo y guarda campos personalizados (se suman a los que ya tiene).",
      scope: "contacts.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "Id del contacto." },
          name: { type: "string", description: "Nombre nuevo." },
          email: { type: "string", description: "Correo nuevo." },
          fields: { type: "object", description: "Campos personalizados: { \"ciudad\": \"Bogotá\", \"presupuesto\": 1500 }." }
        },
        required: ["contact_id"]
      },
      run: async (args, { tenantId }) => {
        const id = String(args["contact_id"]);
        if (args["name"] !== undefined || args["email"] !== undefined) {
          await services.updateContact.execute(tenantId, id, { ...(args["name"] !== undefined ? { name: args["name"] } : {}), ...(args["email"] !== undefined ? { email: args["email"] } : {}) });
        }
        if (args["fields"] && typeof args["fields"] === "object") await services.directory.setFields(tenantId, id, args["fields"] as Record<string, unknown>);
        return toContactSummary(await services.getContact.execute(tenantId, id));
      }
    },
    {
      name: "tag_contact",
      title: "Etiquetar un contacto",
      description: "Pone y quita etiquetas por nombre. Una etiqueta que no existe se crea.",
      scope: "contacts.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "Id del contacto." },
          add: { type: "array", items: { type: "string" }, description: "Etiquetas que se ponen." },
          remove: { type: "array", items: { type: "string" }, description: "Etiquetas que se quitan." }
        },
        required: ["contact_id"]
      },
      run: async (args, { tenantId }) => {
        const id = String(args["contact_id"]);
        await services.getContact.execute(tenantId, id).catch(() => {
          throw new NotFoundError("Ese contacto no existe en la cuenta.");
        });
        if (strings(args["add"]).length) await services.directory.addTags(tenantId, id, strings(args["add"]));
        if (strings(args["remove"]).length) await services.directory.removeTags(tenantId, id, strings(args["remove"]));
        return toContactSummary(await services.getContact.execute(tenantId, id));
      }
    }
  ];
}
