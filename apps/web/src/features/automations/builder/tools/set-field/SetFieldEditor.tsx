import "./set-field-editor.css";
import type { ToolEditorProps } from "../ToolUi";
import { FieldPicker, findField } from "../_kit/FieldPicker";
import { Notice, SelectField, TextField, VariableHint } from "../_kit/fields";
import { CardSection, ChoiceCards, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { setFieldTool } from "./definition";
import { SetFieldIcon } from "./SetFieldIcon";
import { SET_FIELD_LIMITS, SET_FIELD_OPERATION_LABEL, SET_FIELD_OPERATION_SIGN, isProtectedField, readSetFieldConfig, type SetFieldConfig, type SetFieldOperation } from "./setFieldConfig";
import { PROTECTED_FIELD_MESSAGE } from "./validateSetField";

type Mode = "value" | "math";
const MATH: ReadonlyArray<Exclude<SetFieldOperation, "set">> = ["add", "subtract", "multiply", "divide"];

const ValueIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4.5" width="14" height="11" rx="2.5" />
    <path d="M6.5 10h7M10.5 7.5 13 10l-2.5 2.5" />
  </svg>
);
const MathIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M5 6h4M7 4v4M11.5 6h4M5 13.5l3 3M8 13.5l-3 3M11.5 13.5h4M11.5 16h4" />
  </svg>
);

/** «Guardará {cancion_video} = {cancion_2}» · «{reintentos} pasa a {reintentos} + 1». */
function previewOf(config: SetFieldConfig): string | null {
  if (!config.field || !config.value.trim()) return null;
  const value = config.value.trim();
  return config.operation === "set" ? `{${config.field}} = ${value}` : `{${config.field}} = {${config.field}} ${SET_FIELD_OPERATION_SIGN[config.operation]} ${value}`;
}

/**
 * Editor de «Guardar dato»: qué dato (un Campo del cliente o uno solo de la
 * conversación), si se pone un valor o se hace una cuenta, y el valor. Abajo,
 * cómo quedará.
 */
export function SetFieldEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readSetFieldConfig(draft.config);
  const update = (patch: Partial<SetFieldConfig>) => onChange({ config: { ...config, ...patch } });
  const mode: Mode = config.operation === "set" ? "value" : "math";
  const field = findField(resources?.contactFields, config.field);
  const preview = previewOf(config);

  return (
    <ToolEditorLayout
      resources={resources}
      accent={setFieldTool.colors.header}
      outputs={null}
      Icon={SetFieldIcon}
      title="Guardar dato"
      description="Pone o cambia un dato del cliente: copiar uno en otro, marcar algo («usada») o llevar una cuenta (reintentos, puntos)."
      className="set-field"
    >
      <CardSection step={1} title="Dato" description="Si es un Campo del cliente, queda en su ficha y lo ven todos tus flujos.">
        <FieldPicker
          label="Guardar en"
          value={config.field}
          contactFields={resources?.contactFields}
          {...(resources?.createContactField ? { createField: resources.createContactField } : {})}
          onChange={(key) => update({ field: key })}
        />
        {config.field && isProtectedField(config.field) ? <p className="set-field__error" role="alert">{PROTECTED_FIELD_MESSAGE}</p> : null}
      </CardSection>

      <CardSection step={2} title="Qué hacer" description="Poner un valor o hacer una cuenta con el número que ya tiene.">
        <ChoiceCards
          label="Qué hacer con el dato"
          value={mode}
          choices={[
            { value: "value", title: "Poner un valor", description: "Un texto fijo («usada») o el de otra variable ({cancion_2}).", Icon: ValueIcon },
            { value: "math", title: "Hacer una cuenta", description: "Sumar, restar, multiplicar o dividir el número que tiene.", Icon: MathIcon }
          ]}
          onChange={(next) => update({ operation: next === "value" ? "set" : config.operation === "set" ? "add" : config.operation })}
        />
        {mode === "math" ? (
          <SelectField
            label="Cuenta"
            value={config.operation as Exclude<SetFieldOperation, "set">}
            options={MATH.map((operation) => ({ value: operation, label: SET_FIELD_OPERATION_LABEL[operation] }))}
            onChange={(operation) => update({ operation })}
          />
        ) : null}
      </CardSection>

      <CardSection step={3} title={mode === "value" ? "Valor" : "Número"}>
        <TextField
          variables
          label={mode === "value" ? "Valor" : "Con este número"}
          value={config.value}
          maxLength={SET_FIELD_LIMITS.maxValue}
          placeholder={mode === "value" ? "usada · {cancion_2} · {kie.ai.result}" : "1 · {comprobante.valor}"}
          hint={
            mode === "value"
              ? field && field.type !== "text"
                ? `«${field.label}» es de tipo ${field.type === "number" ? "número" : field.type === "date" ? "fecha" : field.type === "boolean" ? "sí o no" : "lista"}: en la ficha queda solo si el valor encaja.`
                : "Lo que escribas, con las variables ya puestas."
              : "Un número o una variable con un número. Si el dato está vacío, cuenta como 0."
          }
          onChange={(value) => update({ value })}
        />
        <VariableHint variables={["{last_message}", "{first_name}", "{ia.respuesta}"]} />
        {preview ? (
          <p className="set-field__preview">
            <span>Quedará así</span>
            <code>{preview}</code>
          </p>
        ) : null}
      </CardSection>

      {mode === "math" ? <Notice>Si el dato o el número no son números (o se divide entre 0), el dato no cambia y el flujo sigue: nunca se guarda un valor a medias.</Notice> : null}
      <OutputsPreview outputs={null} />
    </ToolEditorLayout>
  );
}
