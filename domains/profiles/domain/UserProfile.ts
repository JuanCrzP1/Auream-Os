import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// El perfil de una persona dentro de Auream: cómo se llama en la app, su
// WhatsApp personal y su foto. Es del USUARIO, no de una cuenta: el mismo
// perfil se ve en todas las empresas a las que pertenece.
//
// El correo y la contraseña no viven aquí: son credenciales de Neon Auth.
// ---------------------------------------------------------------------------

export interface UserProfile {
  readonly userId: string;
  /** Nulo: todavía usa el nombre con el que se registró. */
  readonly displayName: string | null;
  /** Formato internacional (E.164), p. ej. `+573001234567`. */
  readonly phone: string | null;
  readonly photoPathname: string | null;
  readonly photoUrl: string | null;
}

export const DISPLAY_NAME_MAX = 80;

export function emptyProfile(userId: string): UserProfile {
  return { userId, displayName: null, phone: null, photoPathname: null, photoUrl: null };
}

/** «  Juan   Camilo » → «Juan Camilo». Entre 1 y 80 caracteres. */
export function normalizeDisplayName(value: unknown): string {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!name) throw new ValidationError("Escribe tu nombre.");
  if (name.length > DISPLAY_NAME_MAX) throw new ValidationError(`El nombre puede tener hasta ${DISPLAY_NAME_MAX} caracteres.`);
  return name;
}

/**
 * «+57 300 123 4567» → «+573001234567». Vacío o nulo lo borra. Debe llevar el
 * prefijo del país: es el número al que se le escribiría por WhatsApp.
 */
export function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ValidationError("El teléfono no es válido.");
  const compact = value.replace(/[\s().-]/g, "");
  if (!compact) return null;
  if (!/^\+[1-9]\d{6,14}$/.test(compact)) {
    throw new ValidationError("Escribe el teléfono con el prefijo del país, p. ej. +57 300 123 4567.");
  }
  return compact;
}

/** La carpeta de las fotos de una persona en el almacén. */
export function userPhotoFolder(userId: string): string {
  return `users/${userId}/photo/`;
}
