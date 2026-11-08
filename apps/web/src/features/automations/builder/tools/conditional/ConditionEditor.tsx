import { Fragment } from "react";
import type { ToolEditorProps } from "../ToolUi";
import { AddButton, InlineInput, InlineSelect, ListCard, Notice } from "../_kit/fields";
import { CardSection, ChoiceCards, Counter, EmptyState, Joiner, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { AllIcon, AnyIcon } from "../_kit/icons";
import { createLocalId } from "../_kit/createLocalId";
import { removeById, replaceById } from "../_kit/read";
import {
  ATTENDANCE_OPTIONS,
  CONTACT_FIELD_OPTIONS,
  RULE_CATEGORY_OPTIONS,
  WEEKDAY_OPTIONS,
  categoryHasField,
  conditionOutputs,
  createRule,
  operatorNeedsValue,
  operatorsFor,
  readConditionConfig,
  type ConditionConfig,
  type ConditionRule,
  type RuleCategory
} from "./conditionConfig";
import { conditionalTool } from "./definition";
import { ConditionalIcon } from "./ConditionalIcon";

function RuleValue({ rule, index, onChange }: { rule: ConditionRule; index: number; onChange: (value: string) => void }) {
  const label = `Valor de la regla ${index + 1}`;

  switch (rule.category) {
    case "weekday":
      return <InlineSelect value={rule.value} options={WEEKDAY_OPTIONS} ariaLabel={label} onChange={onChange} />;
    case "attendance":
      return <InlineSelect value={rule.value} options={ATTENDANCE_OPTIONS} ariaLabel={label} onChange={onChange} />;
    case "time":
    case "date":
      return (
        <input
          type={rule.category}
          className="kit-input nodrag"
          value={rule.value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    default:
      return (
        <InlineInput
          value={rule.value}
          ariaLabel={label}
          placeholder={rule.category === "tag" ? "Nombre de la etiqueta" : rule.category === "attendant" ? "Nombre o correo del asesor" : "Valor o {variable}"}
          onChange={onChange}
        />
      );
  }
}

export function ConditionEditor({ draft, onChange }: ToolEditorProps) {
  const config = readConditionConfig(draft.config);
  const update = (patch: Partial<ConditionConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });
  const patchRule = (id: string, patch: Partial<ConditionRule>) => update({ rules: replaceById(config.rules, id, patch) });
  const addRule = () => update({ rules: [...config.rules, createRule(createLocalId("rule"))] });
  const joiner = config.match === "all" ? "Y" : "O";

  return (
    <ToolEditorLayout
      accent={conditionalTool.colors.header}
      outputs={conditionOutputs()}
      Icon={ConditionalIcon}
      title="Condicional"
      description="Divide el flujo en dos caminos según el contacto, la conversación o el momento."
    >
      <CardSection step={1} title="¿Cuándo se cumple?">
        <ChoiceCards
          label="Cómo combinar las reglas"
          value={config.match}
          choices={[
            { value: "all", title: "Todas las reglas", description: "Deben cumplirse todas a la vez (Y).", Icon: AllIcon },
            { value: "any", title: "Cualquier regla", description: "Basta con que se cumpla una (O).", Icon: AnyIcon }
          ]}
          onChange={(match) => update({ match })}
        />
      </CardSection>

      <CardSection step={2} title="Reglas" description="Cada regla evalúa una cosa." aside={<Counter value={config.rules.length} />}>
        {config.rules.length === 0 ? (
          <EmptyState
            title="Aún no hay reglas"
            description="Ej.: «Etiqueta del contacto tiene vip» o «Hora del día después de 18:00»."
            action={<AddButton label="Añadir regla" onClick={addRule} />}
          />
        ) : (
          <>
            <ul className="kit-list">
              {config.rules.map((rule, index) => (
                <Fragment key={rule.id}>
                  {index > 0 ? <Joiner label={joiner} /> : null}
                  <ListCard
                    title={`Regla ${index + 1}`}
                    removeLabel={`Quitar regla ${index + 1}`}
                    onRemove={() => update({ rules: removeById(config.rules, rule.id) })}
                  >
                    <InlineSelect
                      value={rule.category}
                      options={RULE_CATEGORY_OPTIONS}
                      ariaLabel={`Qué evalúa la regla ${index + 1}`}
                      onChange={(category: RuleCategory) => patchRule(rule.id, createRule(rule.id, category))}
                    />
                    <div className="kit-row">
                      {categoryHasField(rule.category) ? (
                        rule.category === "contactField" ? (
                          <InlineSelect
                            value={rule.field}
                            options={CONTACT_FIELD_OPTIONS}
                            ariaLabel={`Dato de la regla ${index + 1}`}
                            onChange={(field) => patchRule(rule.id, { field })}
                          />
                        ) : (
                          <InlineInput
                            value={rule.field}
                            monospace
                            placeholder={rule.category === "customField" ? "Campo: ciudad" : "Variable: g_promo"}
                            ariaLabel={`Campo de la regla ${index + 1}`}
                            onChange={(field) => patchRule(rule.id, { field })}
                          />
                        )
                      ) : null}
                      <InlineSelect
                        value={rule.operator}
                        options={operatorsFor(rule.category)}
                        ariaLabel={`Operador de la regla ${index + 1}`}
                        onChange={(operator) => patchRule(rule.id, { operator })}
                      />
                      {operatorNeedsValue(rule) ? (
                        <RuleValue rule={rule} index={index} onChange={(value) => patchRule(rule.id, { value })} />
                      ) : null}
                    </div>
                  </ListCard>
                </Fragment>
              ))}
            </ul>
            <AddButton label="Añadir regla" onClick={addRule} />
          </>
        )}
      </CardSection>

      <Notice>
        Los números aceptan coma o punto decimal (19,90 = 19.90). La ventana de 24 h solo aplica a la API oficial de
        WhatsApp; en las demás conexiones siempre está abierta.
      </Notice>
      <OutputsPreview outputs={conditionOutputs()} />
    </ToolEditorLayout>
  );
}
