import { createHash } from "node:crypto";
import type { ConversionUser } from "../../flow-engine/ports/ConversionTracker";

// ---------------------------------------------------------------------------
// Datos del cliente como los pide la API de Conversiones de Meta: normalizados
// y cifrados con SHA-256 (hex en minúsculas). Lo que identifica el anuncio
// (`ctwa_clid`, `page_id`) va sin cifrar, como indica Meta.
// ---------------------------------------------------------------------------

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** Solo dígitos, con el indicativo del país, sin ceros iniciales. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Minúsculas, sin tildes ni signos (como recomienda Meta para nombres). */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

export function toMetaUserData(user: ConversionUser): Record<string, unknown> {
  const data: Record<string, unknown> = { external_id: [sha256(user.externalId)] };
  const phone = user.phone ? normalizePhone(user.phone) : "";
  const email = user.email ? normalizeEmail(user.email) : "";
  const firstName = user.firstName ? normalizeName(user.firstName) : "";
  const lastName = user.lastName ? normalizeName(user.lastName) : "";
  if (phone) data["ph"] = [sha256(phone)];
  if (email) data["em"] = [sha256(email)];
  if (firstName) data["fn"] = [sha256(firstName)];
  if (lastName) data["ln"] = [sha256(lastName)];
  if (user.ctwaClid) data["ctwa_clid"] = user.ctwaClid;
  if (user.pageId) data["page_id"] = user.pageId;
  return data;
}
