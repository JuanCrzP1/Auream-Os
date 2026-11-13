import type { ToolEditorProps } from "../ToolUi";
import { SwitchField } from "../_kit/Switch";
import { AddButton, InlineInput, InlineSelect, ListCard, Notice, TextAreaField, TextField, VariableHint } from "../_kit/fields";
import { FieldPicker, findField, valuesThatDontFit } from "../_kit/FieldPicker";
import { joinOptions } from "@contracts/FieldValues";
import { CardSection, ChatPreview, ChoiceCards, Counter, EmptyState, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { ButtonsIcon, ListIcon } from "../_kit/icons";
import { createLocalId } from "../_kit/createLocalId";
import { removeById, replaceById } from "../_kit/read";
import { CONTACT_VARIABLES } from "../_kit/catalogs";
import { MENU_LIMITS, menuOutputs, readMenuConfig, type MenuConfig, type MenuOption, type MenuTimeUnit } from "./menuConfig";
import { menuTool } from "./definition";
import { MenuIcon } from "./MenuIcon";

const UNIT_OPTIONS: ReadonlyArray<{ value: MenuTimeUnit; label: string }> = [
  { value: "minutes", label: "minutos" },
  { value: "hours", label: "horas" },
  { value: "days", label: "días" }
];

export function MenuEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readMenuConfig(draft.config);
  const saved = findField(resources?.contactFields, config.saveToField);
  const outside = valuesThatDontFit(saved, config.options.map((option) => option.title));
  const limits = MENU_LIMITS[config.format];
  const update = (patch: Partial<MenuConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });
  const patchOption = (id: string, patch: Partial<MenuOption>) => update({ options: replaceById(config.options, id, patch) });
  const full = config.options.length >= limits.maxOptions;
  const addOption = () => update({ options: [...config.options, { id: createLocalId("opt"), title: "", description: "" }] });

  return (
    <ToolEditorLayout
      accent={menuTool.colors.header}
      outputs={menuOutputs({ ...draft.config, ...config })}
      Icon={MenuIcon}
      title="Menú interactivo"
      description="Ofrece opciones en WhatsApp. Cada opción lleva la conversación por un camino distinto."
    >
      <CardSection step={1} title="Formato">
        <ChoiceCards
          label="Cómo se muestran las opciones"
          value={config.format}
          choices={[
            { value: "list", title: "Lista", description: "Hasta 10 opciones con descripción, en un desplegable.", Icon: ListIcon },
            { value: "buttons", title: "Botones", description: "Hasta 3 respuestas rápidas bajo el mensaje.", Icon: ButtonsIcon }
          ]}
          onChange={(format) => update({ format })}
        />
      </CardSection>

      <CardSection step={2} title="Mensaje" description="Lo que lee el cliente antes de elegir.">
        <TextField label="Título (opcional)" value={config.title} placeholder="Ej.: ¿En qué te ayudamos?" onChange={(title) => update({ title })} />
        <TextAreaField label="Mensaje" value={config.message} onChange={(message) => update({ message })} />
        <div className="kit-grid">
          {config.format === "list" ? (
            <TextField label="Texto del botón" value={config.buttonLabel} onChange={(buttonLabel) => update({ buttonLabel })} />
          ) : null}
          <TextField label="Pie (opcional)" value={config.footer} placeholder="Texto pequeño al final" onChange={(footer) => update({ footer })} />
        </div>
        <VariableHint variables={CONTACT_VARIABLES} />
      </CardSection>

      <CardSection
        step={3}
        title="Opciones"
        description="Cada opción crea un camino en el lienzo."
        aside={<Counter value={config.options.length} max={limits.maxOptions} />}
      >
        {config.options.length === 0 ? (
          <EmptyState
            title="Aún no hay opciones"
            description="Cada opción crea un camino en el lienzo. Ej.: Ventas, Soporte, Horarios."
            action={<AddButton label="Añadir opción" onClick={addOption} />}
          />
        ) : (
          <>
            <ul className="kit-list">
              {config.options.map((option, index) => (
                <ListCard
                  key={option.id}
                  title={`Opción ${index + 1}`}
                  removeLabel={`Quitar opción ${index + 1}`}
                  onRemove={() => update({ options: removeById(config.options, option.id) })}
                >
                  <InlineInput
                    value={option.title}
                    placeholder="Título: Ventas"
                    ariaLabel={`Título de la opción ${index + 1}`}
                    maxLength={limits.maxTitle}
                    onChange={(title) => patchOption(option.id, { title })}
                  />
                  {config.format === "list" ? (
                    <InlineInput
                      value={option.description}
                      placeholder="Descripción (opcional)"
                      ariaLabel={`Descripción de la opción ${index + 1}`}
                      maxLength={MENU_LIMITS.list.maxDescription}
                      onChange={(description) => patchOption(option.id, { description })}
                    />
                  ) : null}
                </ListCard>
              ))}
            </ul>
            <AddButton label="Añadir opción" disabled={full} onClick={addOption} />
          </>
        )}

        <ChatPreview
          title={config.title}
          message={config.message}
          footer={config.footer}
          {...(config.format === "list"
            ? { listButton: config.buttonLabel || "Ver opciones" }
            : { buttons: config.options.map((option) => option.title) })}
        />
      </CardSection>

      <CardSection step={4} title="Respuesta" description="Qué pasa con lo que elige el cliente.">
        <FieldPicker
          label="Guardar la opción elegida en"
          value={config.saveToField}
          emptyLabel="No guardar"
        clearLabel="No guardar"
          contactFields={resources?.contactFields}
          {...(resources?.createContactField ? { createField: resources.createContactField } : {})}
          onChange={(saveToField) => update({ saveToField })}
        />
        {outside.length > 0 ? (
          <Notice>
            {outside.length === 1 ? `«${outside[0]}» no está` : `${joinOptions(outside.map((title) => `«${title}»`))} no están`} entre las opciones de «{saved?.label}»: si la eligen, queda solo en la conversación.
          </Notice>
        ) : null}
        <SwitchField
          label="Tiempo límite para responder"
          hint="Si no elige a tiempo, el flujo sigue por «Tiempo agotado»."
          checked={config.timeoutEnabled}
          onChange={(timeoutEnabled) => update({ timeoutEnabled })}
        />
        {config.timeoutEnabled ? (
          <div className="kit-row">
            <input
              type="number"
              min={1}
              className="kit-input nodrag"
              value={config.timeoutAmount}
              aria-label="Cantidad del tiempo límite"
              onChange={(event) => {
                const amount = Math.floor(Number(event.target.value));
                update({ timeoutAmount: Number.isFinite(amount) && amount > 0 ? amount : 1 });
              }}
            />
            <InlineSelect
              value={config.timeoutUnit}
              options={UNIT_OPTIONS}
              ariaLabel="Unidad del tiempo límite"
              onChange={(timeoutUnit) => update({ timeoutUnit })}
            />
          </div>
        ) : null}
      </CardSection>

      <OutputsPreview outputs={menuOutputs({ ...draft.config, ...config })} />
    </ToolEditorLayout>
  );
}
