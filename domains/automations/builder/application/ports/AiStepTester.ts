import type { AiTestResult } from "../../../../../contracts/AiTestContracts";

/** Ejecuta una vez el bloque de IA con un mensaje de ejemplo (lo conecta la composición con el motor). */
export interface AiStepTester {
  test(
    tenantId: string,
    config: Readonly<Record<string, unknown>>,
    message: string,
    variables: Readonly<Record<string, string>>
  ): Promise<AiTestResult>;
}
