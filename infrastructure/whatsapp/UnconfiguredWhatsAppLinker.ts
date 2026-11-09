import type { LinkOutcome, WhatsAppLinker } from "../../domains/connections/application/ports/WhatsAppLinker";
import type { WhatsAppConnection } from "../../domains/connections/domain/WhatsAppConnection";

/**
 * Sin proveedor de WhatsApp configurado: la conexión se crea y queda lista,
 * pero vincular el número dice con claridad que aún no está disponible.
 */
export class UnconfiguredWhatsAppLinker implements WhatsAppLinker {
  public async link(connection: WhatsAppConnection): Promise<LinkOutcome> {
    return {
      kind: "unavailable",
      message:
        connection.method === "qr"
          ? "La vinculación por código QR se activa al conectar el proveedor de WhatsApp. Tu conexión ya quedó creada: podrás escanear el código desde aquí."
          : "La conexión con la API oficial de Meta se activa en la próxima fase. Tu conexión ya quedó creada y lista para completarla."
    };
  }

  public async unlink(): Promise<void> {}
}
