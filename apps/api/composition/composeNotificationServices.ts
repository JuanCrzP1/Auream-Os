import { NotificationServices } from "../../../domains/notifications/application/NotificationServices";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlNotificationReads } from "../../../infrastructure/persistence/sql/SqlNotificationReads";
import { SqlNotificationSignals } from "../../../infrastructure/persistence/sql/SqlNotificationSignals";
import { SqlTenantResolver } from "../../../infrastructure/persistence/sql/SqlTenantResolver";

// composeNotificationServices — la campana: lee el estado de cada módulo en
// PostgreSQL y el día con la zona horaria de la empresa.
export function composeNotificationServices(sql: SqlClient, defaultTimezone: string): NotificationServices {
  const tenants = new SqlTenantResolver(sql, defaultTimezone);
  return new NotificationServices(new SqlNotificationSignals(sql), new SqlNotificationReads(sql), async (tenantId) => (await tenants.resolve(tenantId)).timezone);
}
