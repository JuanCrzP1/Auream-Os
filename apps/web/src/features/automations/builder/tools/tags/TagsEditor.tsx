import type { ToolEditorProps } from "../ToolUi";
import { ChipsField } from "../_kit/fields";
import { CardSection, ChoiceCards, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { MinusTagIcon, PlusTagIcon } from "../_kit/icons";
import { readTagsConfig, type TagsConfig } from "./tagsConfig";
import { tagsTool } from "./definition";
import { TagsIcon } from "./TagsIcon";

export function TagsEditor({ draft, onChange }: ToolEditorProps) {
  const config = readTagsConfig(draft.config);
  const update = (patch: Partial<TagsConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });
  const adding = config.action === "add";

  return (
    <ToolEditorLayout
      accent={tagsTool.colors.header}
      outputs={null}
      Icon={TagsIcon}
      title="Etiquetas"
      description="Clasifica al contacto cuando la conversación pase por este bloque."
    >
      <CardSection step={1} title="¿Qué quieres hacer?">
        <ChoiceCards
          label="Acción"
          value={config.action}
          choices={[
            { value: "add", title: "Agregar etiquetas", description: "Marca al contacto con nuevas etiquetas.", Icon: PlusTagIcon },
            { value: "remove", title: "Quitar etiquetas", description: "Retira etiquetas que ya tenga.", Icon: MinusTagIcon }
          ]}
          onChange={(action) => update({ action })}
        />
      </CardSection>

      <CardSection
        step={2}
        title={adding ? "Etiquetas a agregar" : "Etiquetas a quitar"}
        description="Todas van en este mismo bloque. Pulsa Enter o coma después de cada una."
      >
        <ChipsField
          label={adding ? "Etiquetas a agregar" : "Etiquetas a quitar"}
          values={config.tags}
          placeholder="cliente, vip, interesado…"
          onChange={(tags) => update({ tags })}
        />
      </CardSection>

      <OutputsPreview outputs={null} />
    </ToolEditorLayout>
  );
}
