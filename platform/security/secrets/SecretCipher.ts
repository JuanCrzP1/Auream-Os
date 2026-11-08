// ---------------------------------------------------------------------------
// SecretCipher — cifra secretos de clientes (claves de API) para guardarlos.
//
// `context` (AAD) ata el secreto a su dueño: el mismo texto cifrado no se
// descifra con otro contexto. Se usa `tenantId:credentialId`, así una fila
// copiada a otra cuenta, o a otra credencial, deja de servir.
//
// El resultado es un sobre de texto autocontenido con la versión de la clave
// maestra: rotarla no obliga a reescribir los secretos de una vez.
// ---------------------------------------------------------------------------

export interface SecretCipher {
  encrypt(plaintext: string, context: string): string;
  /** Lanza `SecretDecryptionError` si el sobre no es válido, se alteró o no es de ese contexto. */
  decrypt(envelope: string, context: string): string;
}

export class SecretDecryptionError extends Error {
  public constructor(message = "No se pudo descifrar el secreto.") {
    super(message);
  }
}
