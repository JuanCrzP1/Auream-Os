import type { ConnectionMethod } from "../../contracts/ConnectionContracts";
import type { WhatsAppLinker, WhatsAppLinkers } from "../../domains/connections/application/ports/WhatsAppLinker";

/** Un proveedor por forma de conectar: lo decide la composición. */
export class LinkersByMethod implements WhatsAppLinkers {
  public constructor(private readonly byMethod: Readonly<Record<ConnectionMethod, WhatsAppLinker>>) {}

  public for(method: ConnectionMethod): WhatsAppLinker {
    return this.byMethod[method];
  }
}
