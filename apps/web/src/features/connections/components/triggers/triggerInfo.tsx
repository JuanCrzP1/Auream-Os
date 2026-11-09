import type { ReactNode } from "react";
import type { ConnectionTrigger, ConnectionTriggerType, KeywordMatch } from "@contracts/ConnectionTriggerContracts";

// Textos e iconos de cada tipo de disparador: una sola fuente para la lista y
// el formulario. Ordenados como se evalúan (de más específico a más general).

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const ICONS: Readonly<Record<ConnectionTriggerType, ReactNode>> = {
  keyword: (
    <svg {...svg}>
      <path d="M4 7V5.5h9V7M8.5 5.5v13M6.5 18.5h4" />
      <path d="M14 12h6M17 12v6.5" />
    </svg>
  ),
  ad_click: (
    <svg {...svg}>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z" />
      <path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
    </svg>
  ),
  first_message: (
    <svg {...svg}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 19.5a6.5 6.5 0 0 1 13 0M18.5 8v6M15.5 11h6" />
    </svg>
  ),
  any_message: (
    <svg {...svg}>
      <path d="M20 12a8 8 0 0 1-11.8 7L4 20l1-4.2A8 8 0 1 1 20 12Z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </svg>
  )
};

export interface TriggerTypeInfo {
  readonly type: ConnectionTriggerType;
  readonly title: string;
  readonly description: string;
  readonly icon: ReactNode;
}

export const TRIGGER_TYPES: ReadonlyArray<TriggerTypeInfo> = [
  { type: "keyword", title: "Palabra clave", description: "El cliente escribe ciertas palabras: «precio», «info», «menú»…", icon: ICONS.keyword },
  { type: "ad_click", title: "Viene de un anuncio", description: "Llega desde un anuncio de clic a WhatsApp de Facebook o Instagram.", icon: ICONS.ad_click },
  { type: "first_message", title: "Primer mensaje", description: "Un contacto nuevo escribe por primera vez.", icon: ICONS.first_message },
  { type: "any_message", title: "Cualquier mensaje", description: "Respaldo: cualquier mensaje que no active otro disparador.", icon: ICONS.any_message }
];

export const typeInfo = (type: ConnectionTriggerType): TriggerTypeInfo => TRIGGER_TYPES.find((info) => info.type === type)!;

export const MATCH_LABEL: Readonly<Record<KeywordMatch, string>> = {
  contains: "contiene",
  exact: "es exactamente",
  starts_with: "empieza por"
};

/** «Si el mensaje contiene «precio» o «info»». */
export function describeTrigger(trigger: Pick<ConnectionTrigger, "type" | "keywords" | "match">): string {
  if (trigger.type !== "keyword") return typeInfo(trigger.type).description;
  const words = trigger.keywords.map((keyword) => `«${keyword}»`);
  const list = words.length > 1 ? `${words.slice(0, -1).join(", ")} o ${words.at(-1)}` : words[0];
  return `Si el mensaje ${MATCH_LABEL[trigger.match]} ${list}`;
}
