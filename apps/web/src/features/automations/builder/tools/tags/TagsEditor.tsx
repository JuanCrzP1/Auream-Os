import type { ToolEditorProps } from "../ToolUi";
import { ChipsField } from "../_kit/fields";
import { CardSection, ChoiceCards, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { MinusTagIcon, PlusTagIcon } from "../_kit/icons";
import { readTagsConfig, type TagsConfig } from "./tagsConfig";
import { tagsTool } from "./definition";
import { TagsIcon } from "./TagsIcon";

export function TagsEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readTagsConfig(draft.config);
  const update = (patch: Partial<TagsConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });
  const adding = config.action === "add";
  const catalog = resources?.labels ?? [];
  const suggestions = catalog.map((label) => ({ value: label.name, color: label.color }));
  const unknown = config.tags.filter((tag) => !catalog.some((label) => label.name.toLocaleLowerCase() === tag.toLocaleLowerCase()));

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
        description="Elige de tus etiquetas o escribe una nueva y pulsa Enter."
      >
        <ChipsField
          label={adding ? "Etiquetas a agregar" : "Etiquetas a quitar"}
          values={config.tags}
          placeholder="cliente, vip, interesado…"
          suggestions={suggestions}
          {...(adding && unknown.length > 0 ? { hint: `Se crearán en tu catálogo al usarse: ${unknown.join(", ")}.` } : {})}
          onChange={(tags) => update({ tags })}
        />
      </CardSection>

      <OutputsPreview outputs={null} />
    </ToolEditorLayout>
  );
}
