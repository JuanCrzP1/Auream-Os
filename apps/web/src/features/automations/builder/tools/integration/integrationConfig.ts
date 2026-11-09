
// La forma de la configuración es el contrato compartido con el motor
// (`contracts/IntegrationConfig.ts`). Aquí: las salidas que pinta el lienzo.
export {
  HTTP_METHODS,
  INTEGRATION_DEFAULT_CONFIG,
  INTEGRATION_LIMITS,
  INTEGRATION_OUTPUT,
  methodHasBody,
  readIntegrationConfig,
  type HttpHeader,
  type HttpMethod,
  type IntegrationConfig,
  type ResponseMapping
} from "@contracts/IntegrationConfig";

export { integrationOutputs } from "@contracts/blocks/outputs";
