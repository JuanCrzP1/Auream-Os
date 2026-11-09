import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlConnectionRepository } from "../../../infrastructure/persistence/sql/SqlConnectionRepository";
import { UnconfiguredWhatsAppLinker } from "../../../infrastructure/whatsapp/UnconfiguredWhatsAppLinker";
import type { WhatsAppLinker } from "../../../domains/connections/application/ports/WhatsAppLinker";
import {
  CreateConnectionService,
  DeleteConnectionService,
  LinkConnectionService,
  ListConnectionsService,
  RenameConnectionService
} from "../../../domains/connections/application/ConnectionServices";

// ---------------------------------------------------------------------------
// composeConnectionsServices — los números de WhatsApp de la cuenta sobre
// PostgreSQL. El proveedor que vincula (QR o API oficial) entra por el puerto
// `WhatsAppLinker`; hasta configurarlo, `UnconfiguredWhatsAppLinker`.
// ---------------------------------------------------------------------------

export interface ConnectionsServices {
  readonly list: ListConnectionsService;
  readonly create: CreateConnectionService;
  readonly rename: RenameConnectionService;
  readonly remove: DeleteConnectionService;
  readonly link: LinkConnectionService;
}

export function composeConnectionsServices(sqlClient: SqlClient, linker: WhatsAppLinker = new UnconfiguredWhatsAppLinker()): ConnectionsServices {
  const repository = new SqlConnectionRepository(sqlClient);
  return {
    list: new ListConnectionsService(repository),
    create: new CreateConnectionService(repository),
    rename: new RenameConnectionService(repository),
    remove: new DeleteConnectionService(repository, linker),
    link: new LinkConnectionService(repository, linker)
  };
}
