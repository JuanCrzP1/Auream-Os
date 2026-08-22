import type { Subscription } from "../contracts/Subscription";

// Interfaz del repositorio de suscripciones.
// Implementaciones: InMemory (dev/test) y persistencia SQL (producción), detrás de este puerto.
export interface SubscriptionRepository {
  findByTenant(tenantId: string): Subscription | undefined;
  save(subscription: Subscription): void;
}
