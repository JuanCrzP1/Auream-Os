import type { IntegrationTestResult } from "../../../../../contracts/IntegrationTestContracts";

/**
 * Ejecuta una vez la petición de un bloque Integración (la composición lo
 * conecta con el motor y el cliente HTTP protegido).
 */
export interface IntegrationRequestTester {
  test(config: Readonly<Record<string, unknown>>, variables: Readonly<Record<string, string>>): Promise<IntegrationTestResult>;
}
