import type { ContactFieldValue } from "../../contracts/ContactContracts";

/**
 * Los Datos del negocio de una cuenta (`{g_horario}`), con su tipo. El motor
 * los lee una vez por turno y nunca los cambia. Debe responder siempre: sin
 * datos, un objeto vacío (los mensajes quedan con su valor por defecto).
 */
export interface BusinessDataReader {
  values(tenantId: string): Promise<Readonly<Record<string, ContactFieldValue>>>;
}
