import { createHash, randomBytes } from "node:crypto";

// El secreto del enlace de invitación: 32 bytes aleatorios en base64url (43
// caracteres). Se entrega una vez y se guarda solo su huella SHA-256.

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function newInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Descarta a la primera lo que no puede ser un secreto nuestro (sin tocar la base). */
export function isWellFormedInvitationToken(token: string): boolean {
  return TOKEN.test(token);
}
