import type { ContactSummary, LabelSummary } from "../../../contracts/ContactContracts";
import type { ContactWithLabels } from "../../../domains/contacts/application/ContactRepository";
import type { Label } from "../../../domains/contacts/domain/Label";

// Único punto que traduce Contactos del dominio a su forma pública: sin
// `tenantId` (lo decide el servidor) ni clave externa interna.

export function toLabelSummary(label: Label & { contactCount?: number }): LabelSummary {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    ...(label.contactCount !== undefined ? { contactCount: label.contactCount } : {})
  };
}

export function toContactSummary({ contact, labels }: ContactWithLabels): ContactSummary {
  return {
    id: contact.id,
    channel: contact.channel,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    labels: labels.map((label) => toLabelSummary(label)),
    customFields: contact.customFields,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt
  };
}
