import type { AiProviderId } from "@contracts/AiContracts";
import type { IntegrationMarkKind } from "../catalog/integrationCatalog";

const INITIALS: Readonly<Record<AiProviderId, string>> = { openai: "AI", gemini: "G", openrouter: "OR" };

/** Distintivo de Meta para los píxeles (iniciales, sin el logo de la marca). */
export function MetaMark({ size = "md" }: { readonly size?: "sm" | "md" }) {
  return (
    <span className={`provider-mark provider-mark--meta provider-mark--${size}`} aria-hidden="true">
      PX
    </span>
  );
}

/** Distintivo del proveedor (iniciales con el color del proveedor en el tema; sin logos de marca). */
export function ProviderMark({ provider, size = "md" }: { readonly provider: AiProviderId; readonly size?: "sm" | "md" }) {
  return (
    <span className={`provider-mark provider-mark--${provider} provider-mark--${size}`} aria-hidden="true">
      {INITIALS[provider]}
    </span>
  );
}

const MARK_INITIALS: Readonly<Record<IntegrationMarkKind, string>> = { ...INITIALS, meta: "PX", webhook: "WH", mcp: "MCP" };

/** Distintivo de cualquier integración del catálogo (iniciales con su color; sin logos de marca). */
export function IntegrationMark({ kind, size = "md" }: { readonly kind: IntegrationMarkKind; readonly size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`provider-mark provider-mark--${kind} provider-mark--${size}`} aria-hidden="true">
      {MARK_INITIALS[kind]}
    </span>
  );
}
