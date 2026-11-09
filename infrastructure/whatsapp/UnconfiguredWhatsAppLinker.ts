import type { LinkTarget, SessionState, StartOutcome, WhatsAppLinker } from "../../domains/connections/application/ports/WhatsAppLinker";

/**
 * Sin proveedor configurado para un método: la conexión se crea y queda lista,
 * pero vincular el número dice con claridad que aún no está disponible.
 */
export class UnconfiguredWhatsAppLinker implements WhatsAppLinker {
  public async start(target: LinkTarget): Promise<StartOutcome> {
    return {
      kind: "unavailable",
      message:
        target.method === "qr"
          ? "La vinculación por código QR se activa al conectar el proveedor de WhatsApp. Tu conexión ya quedó creada: podrás escanear el código desde aquí."
          : "La conexión con la API oficial de Meta se activa en la próxima fase. Tu conexión ya quedó creada y lista para completarla."
    };
  }

  public async restart(): Promise<SessionState> {
    return { kind: "disconnected" };
  }

  public async refresh(): Promise<void> {}

  public async check(): Promise<SessionState> {
    return { kind: "disconnected" };
  }

  public async disconnect(): Promise<void> {}

  public async reset(): Promise<void> {}

  public async unlink(): Promise<void> {}
}
