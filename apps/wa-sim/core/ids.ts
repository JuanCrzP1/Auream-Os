import { randomBytes, randomUUID } from "node:crypto";

// Ids con la forma de los de WhatsApp y uazapi (así los parsers de Auream los
// tratan igual que los reales).

/** Id de un mensaje de WhatsApp: «3EB0» + 18 caracteres hexadecimales en mayúscula. */
export const messageId = (): string => `3EB0${randomBytes(9).toString("hex").toUpperCase()}`;

export const instanceId = (): string => `sim${randomBytes(6).toString("hex")}`;

export const instanceToken = (): string => randomUUID();

/** Un grupo: `<números>@g.us`. */
export const groupJid = (): string => `1203630${randomBytes(6).readUIntBE(0, 6).toString().slice(0, 11)}@g.us`;

export const inviteCode = (): string => randomBytes(11).toString("base64url");
