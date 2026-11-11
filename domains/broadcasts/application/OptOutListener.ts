import { isOptOut } from "../domain/Personalize";
import type { OptOutStore } from "./BroadcastPorts";

// ---------------------------------------------------------------------------
// Escucha lo que escriben los clientes: quien pide no recibir más («SALIR»,
// «no quiero más») sale de todas las difusiones de la cuenta, para siempre.
// Nunca lanza: un fallo aquí no puede frenar la conversación.
// ---------------------------------------------------------------------------

export class OptOutListener {
  public constructor(
    private readonly optOuts: OptOutStore,
    private readonly now: () => Date = () => new Date(),
    private readonly onError: (error: unknown) => void = () => undefined
  ) {}

  public async heard(tenantId: string, message: { readonly phone: string; readonly text: string | null }): Promise<void> {
    if (!message.text || !isOptOut(message.text)) return;
    await this.optOuts.add(tenantId, message.phone, this.now()).catch(this.onError);
  }
}
