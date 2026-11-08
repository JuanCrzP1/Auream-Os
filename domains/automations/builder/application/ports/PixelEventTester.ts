import type { PixelTestResult } from "../../../../../contracts/PixelTestContracts";

/** Envía una vez el evento de un bloque Pixel con código de prueba (lo conecta la composición con el motor). */
export interface PixelEventTester {
  test(
    tenantId: string,
    config: Readonly<Record<string, unknown>>,
    testEventCode: string,
    variables: Readonly<Record<string, string>>
  ): Promise<PixelTestResult>;
}
