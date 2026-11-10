import type { ContactEvents, LabelChangeOrigin } from "../../../domains/contacts/application/LabelHooks";
import type { StageTracker } from "../../../domains/crm/application/StageTracker";
import type { ApprovedSaleEvent, SaleEvents } from "../../../domains/sales/application/SaleEvents";

// ---------------------------------------------------------------------------
// CrmEventsRelay — lleva los avisos de Contactos y de Ventas al CRM.
//
// El CRM usa los servicios de Contactos (para mover etiquetas), así que se
// compone DESPUÉS; pero Contactos y Ventas necesitan a quién avisar desde que
// nacen. Este relevo se les entrega primero y se conecta al CRM al final
// (`attach`). Antes de conectarse no hay tráfico: la API aún no escucha.
// ---------------------------------------------------------------------------

export class CrmEventsRelay implements ContactEvents, SaleEvents {
  private tracker: StageTracker | null = null;

  public attach(tracker: StageTracker): void {
    this.tracker = tracker;
  }

  public async contactCreated(tenantId: string, contactId: string): Promise<void> {
    await this.tracker?.contactCreated(tenantId, contactId);
  }

  public async labelsChanged(tenantId: string, contactId: string, change: { added: ReadonlyArray<string>; removed: ReadonlyArray<string> }, origin: LabelChangeOrigin): Promise<void> {
    await this.tracker?.labelsChanged(tenantId, contactId, change, origin);
  }

  public async saleApproved(tenantId: string, sale: ApprovedSaleEvent): Promise<void> {
    await this.tracker?.saleApproved(tenantId, sale);
  }
}
