import type { ContactFieldValue } from "../../../contracts/ContactContracts";
import { coerceFieldValue } from "../domain/ContactField";
import type { ContactFieldRepository, ContactFieldValues } from "./ContactFieldPorts";

// ---------------------------------------------------------------------------
// Lo que un flujo guarda pasa al cliente si es un campo definido: Esperar
// respuesta guarda «Medellín» en `ciudad` → el cliente queda con
// Ciudad = Medellín (convertido a su tipo). Lo que no es un campo sigue solo
// en la conversación, como siempre. Lo que no encaja en el tipo (una opción
// que la lista no tiene) no se guarda en el cliente.
// ---------------------------------------------------------------------------

export class ContactFieldSync {
  public constructor(
    private readonly repository: Pick<ContactFieldRepository, "list">,
    private readonly values: Pick<ContactFieldValues, "merge">
  ) {}

  /**
   * Devuelve lo que guardó en el cliente (vacío si nada era un campo). El
   * cliente se busca solo si hay algo que guardar: la mayoría de los turnos no
   * cuestan una consulta de más.
   */
  public async persist(tenantId: string, contactId: () => Promise<string>, patch: Readonly<Record<string, unknown>>): Promise<Record<string, ContactFieldValue>> {
    const keys = Object.keys(patch).filter((key) => !key.startsWith("__"));
    if (keys.length === 0) return {};
    const fields = await this.repository.list(tenantId);
    const saved: Record<string, ContactFieldValue> = {};
    for (const field of fields) {
      if (!(field.key in patch)) continue;
      const value = coerceFieldValue(field, patch[field.key]);
      if (value !== undefined) saved[field.key] = value;
    }
    if (Object.keys(saved).length > 0) await this.values.merge(tenantId, await contactId(), saved);
    return saved;
  }
}
