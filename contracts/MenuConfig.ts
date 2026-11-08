import { asRecord, readBoolean, readEnum, readInteger, readItems, readString } from "./ConfigReaders";

// ---------------------------------------------------------------------------
// Menú — contrato de configuración compartido por el builder (editor) y el
// motor (MenuNodeHandler).
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

/** Salidas fijas del Menú (además de una por opción, con el id de la opción). */
export const MENU_OUTPUT = { other: "menu-other", timeout: "menu-timeout" } as const;

export function readMenuConfig(config: Readonly<Record<string, unknown>>): MenuConfig {
  const d = MENU_DEFAULT_CONFIG;
  // Formato antiguo: opciones como cadenas.
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
