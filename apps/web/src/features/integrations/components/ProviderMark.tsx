import type { AiProviderId } from "@contracts/AiContracts";
import type { IntegrationMarkKind } from "../catalog/integrationCatalog";
import { IntegrationGlyph } from "./IntegrationGlyph";

type MarkSize = "sm" | "md" | "lg";

/**
 * Distintivo de una integración: el logo del servicio sobre una ficha neutra
 * (fondo, borde fino y sombra suave del tema), como en los paneles de
 * integraciones profesionales. El nombre lo da el texto de al lado.
 */
export function IntegrationMark({ kind, size = "md" }: { readonly kind: IntegrationMarkKind; readonly size?: MarkSize }) {
  return (
    <span className={`provider-mark provider-mark--${kind} provider-mark--${size}`} aria-hidden="true">
      <IntegrationGlyph kind={kind} />
    </span>
  );
}

/** Distintivo de un proveedor de IA (OpenAI, Gemini, OpenRouter). */
export function ProviderMark({ provider, size = "md" }: { readonly provider: AiProviderId; readonly size?: MarkSize }) {
  return <IntegrationMark kind={provider} size={size} />;
}

/** Distintivo de Meta (los píxeles de conversión). */
export function MetaMark({ size = "md" }: { readonly size?: MarkSize }) {
  return <IntegrationMark kind="meta" size={size} />;
}
