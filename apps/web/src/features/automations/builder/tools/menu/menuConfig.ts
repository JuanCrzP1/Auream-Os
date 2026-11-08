import type { ToolData, ToolOutput } from "../ToolDefinition";
import { asRecord, readBoolean, readEnum, readInteger, readItems, readString } from "../_kit/read";

// ---------------------------------------------------------------------------
// Menú interactivo de WhatsApp: lista desplegable o botones de respuesta. Cada
// opción es una salida; además «Otra respuesta» y, si hay límite, «Tiempo
// agotado».
// ---------------------------------------------------------------------------

export type MenuFormat = "list" | "buttons";
export type MenuTimeUnit = "minutes" | "hours" | "days";

/** Límites de WhatsApp. */
export const MENU_LIMITS = {
  buttons: { maxOptions: 3, maxTitle: 20 },
  list: { maxOptions: 10, maxTitle: 24, maxDescription: 72 }
} as const;

export interface MenuOption {
  readonly id: string;
  readonly title: string;
  /** Solo en formato lista. */
  readonly description: string;
}

export interface MenuConfig {
  readonly format: MenuFormat;
  readonly title: string;
  readonly message: string;
  /** Texto del botón que abre la lista. */
  readonly buttonLabel: string;
  readonly footer: string;
  readonly options: ReadonlyArray<MenuOption>;
  /** Campo del contacto donde guardar la opción elegida (opcional). */
  readonly saveToField: string;
  readonly timeoutEnabled: boolean;
  readonly timeoutAmount: number;
  readonly timeoutUnit: MenuTimeUnit;
}

export const MENU_DEFAULT_CONFIG: MenuConfig = {
  format: "list",
  title: "",
  message: "Elige una opción:",
  buttonLabel: "Ver opciones",
  footer: "",
  options: [],
  saveToField: "",
  timeoutEnabled: false,
  timeoutAmount: 30,
  timeoutUnit: "minutes"
};

export function readMenuConfig(config: ToolData): MenuConfig {
  const d = MENU_DEFAULT_CONFIG;
  // Compatibilidad: el stub anterior guardaba `options` como lista de textos.
  const rawOptions = Array.isArray(config.options)
    ? config.options.map((entry) => (typeof entry === "string" ? { title: entry } : entry))
    : config.options;

  return {
    format: readEnum(config.format, ["list", "buttons"] as const, d.format),
    title: readString(config.title),
    message: readString(config.message, d.message),
    buttonLabel: readString(config.buttonLabel, d.buttonLabel),
    footer: readString(config.footer),
    options: readItems(rawOptions, "opt", (record, id) => ({
      id,
      title: readString(record.title),
      description: readString(record.description)
    })),
    saveToField: readString(config.saveToField).trim(),
    timeoutEnabled: readBoolean(config.timeoutEnabled, asRecord(config.timeout) !== null),
    timeoutAmount: readInteger(config.timeoutAmount, d.timeoutAmount, 1, 9999),
    timeoutUnit: readEnum(config.timeoutUnit, ["minutes", "hours", "days"] as const, d.timeoutUnit)
  };
}

export const MENU_OUTPUT = { other: "menu-other", timeout: "menu-timeout" } as const;

export function menuOutputs(config: ToolData): ReadonlyArray<ToolOutput> {
  const read = readMenuConfig(config);

  return [
    ...read.options.map((option, index) => ({ id: option.id, label: option.title.trim() || `Opción ${index + 1}` })),
    { id: MENU_OUTPUT.other, label: "Otra respuesta" },
    ...(read.timeoutEnabled ? [{ id: MENU_OUTPUT.timeout, label: "Tiempo agotado" }] : [])
  ];
}
