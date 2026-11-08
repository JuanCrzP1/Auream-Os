import { readEnum, readStringList } from "./ConfigReaders";

// ---------------------------------------------------------------------------
// Etiquetas — contrato de configuración compartido por el builder (editor) y
// el motor (TagsNodeHandler). Una acción por bloque; varias etiquetas a la vez,
// por NOMBRE (como en el catálogo de la cuenta).
// ---------------------------------------------------------------------------

export type TagsAction = "add" | "remove";

export interface TagsConfig {
  readonly action: TagsAction;
  readonly tags: ReadonlyArray<string>;
}

export const TAGS_DEFAULT_CONFIG: TagsConfig = { action: "add", tags: [] };

export function readTagsConfig(config: Readonly<Record<string, unknown>>): TagsConfig {
  return {
    action: readEnum(config.action, ["add", "remove"] as const, "add"),
    tags: readStringList(config.tags)
  };
}
