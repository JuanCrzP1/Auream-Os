import type { ToolEditorProps } from "../ToolUi";
import { CardSection, ChoiceCards, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { MinusTagIcon, PlusTagIcon } from "../_kit/icons";
import { readTagsConfig, type TagsConfig } from "./tagsConfig";
import { tagsTool } from "./definition";
import { TagsIcon } from "./TagsIcon";
import { TagPicker } from "./TagPicker";

export function TagsEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readTagsConfig(draft.config);
  const update = (patch: Partial<TagsConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });
  const adding = config.action === "add";
  const catalog = resources?.labels ?? [];

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
        description={adding ? "Marca las que quieras; todas se aplican en este mismo bloque." : "Marca las que quieras retirar del contacto."}
      >
        <TagPicker
          label={adding ? "Etiquetas a agregar" : "Etiquetas a quitar"}
          catalog={catalog}
          selected={config.tags}
          allowCreate={adding}
          createLabel={resources?.createLabel}
          onChange={(tags) => update({ tags })}
        />
      </CardSection>

      <OutputsPreview outputs={null} />
    </ToolEditorLayout>
  );
}
