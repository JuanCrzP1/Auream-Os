import type { ToolEditorProps } from "../ToolUi";
import { AddButton, InlineInput, InlineSelect, ListCard, RemoveButton, TextAreaField, VariableHint } from "../_kit/fields";
import { FieldPicker } from "../_kit/FieldPicker";
import { CardSection, Counter, EmptyState, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { createLocalId } from "../_kit/createLocalId";
import { removeById, replaceById } from "../_kit/read";
import { CONTACT_VARIABLES } from "../_kit/catalogs";
import {
  HTTP_METHODS,
  integrationOutputs,
  methodHasBody,
  readIntegrationConfig,
  type IntegrationConfig
} from "./integrationConfig";
import { integrationTool } from "./definition";
import { IntegrationIcon } from "./IntegrationIcon";
import { IntegrationTestPanel } from "./IntegrationTestPanel";
import { suggestFieldName } from "./suggestFieldName";

export function IntegrationEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readIntegrationConfig(draft.config);
  const update = (patch: Partial<IntegrationConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });

  const addHeader = () => update({ headers: [...config.headers, { id: createLocalId("h"), key: "", value: "" }] });
  const addMapping = () =>
    update({ responseMappings: [...config.responseMappings, { id: createLocalId("m"), path: "", field: "" }] });
  // Desde «Probar»: guardar un dato de la respuesta con un nombre de campo propuesto.
  const savePath = (path: string) =>
    update({
      responseMappings: [
        ...config.responseMappings,
        { id: createLocalId("m"), path, field: suggestFieldName(path, config.responseMappings.map((mapping) => mapping.field)) }
      ]
    });
  const hasBody = methodHasBody(config.method);

  return (
    <ToolEditorLayout
      accent={integrationTool.colors.header}
      outputs={integrationOutputs()}
      Icon={IntegrationIcon}
      title="Integración HTTP"
      description="Llama a un servicio externo (webhook, API o CRM) en mitad de la conversación."
    >
      <CardSection step={1} title="Petición" description="Método y dirección del servicio. La URL admite variables.">
        <div className="kit-request">
          <div className={`kit-request__method kit-request__method--${config.method.toLowerCase()}`}>
            <InlineSelect
              value={config.method}
              options={HTTP_METHODS.map((method) => ({ value: method, label: method }))}
              ariaLabel="Método"
              onChange={(method) => update({ method })}
            />
          </div>
          <input
            type="url"
            className="kit-input kit-input--mono nodrag"
            value={config.url}
            placeholder="https://api.tuservicio.com/leads"
            aria-label="URL"
            spellCheck={false}
            onChange={(event) => update({ url: event.target.value.trim() })}
          />
        </div>
      </CardSection>

      <CardSection step={2} title="Cabeceras" description="Autenticación y formato." aside={<Counter value={config.headers.length} />}>
        {config.headers.length === 0 ? (
          <EmptyState
            title="Sin cabeceras"
            description="Añade, por ejemplo, Authorization o Content-Type."
            action={<AddButton label="Añadir cabecera" onClick={addHeader} />}
          />
        ) : (
          <>
            <ul className="kit-list">
              {config.headers.map((header, index) => (
                <li key={header.id} className="kit-row">
                  <InlineInput
                    value={header.key}
                    placeholder="Nombre"
                    monospace
                    ariaLabel={`Nombre de la cabecera ${index + 1}`}
                    onChange={(key) => update({ headers: replaceById(config.headers, header.id, { key }) })}
                  />
                  <InlineInput
                    value={header.value}
                    placeholder="Valor"
                    monospace
                    ariaLabel={`Valor de la cabecera ${index + 1}`}
                    onChange={(value) => update({ headers: replaceById(config.headers, header.id, { value }) })}
                  />
                  <RemoveButton
                    label={`Quitar cabecera ${header.key || index + 1}`}
                    onClick={() => update({ headers: removeById(config.headers, header.id) })}
                  />
                </li>
              ))}
            </ul>
            <AddButton label="Añadir cabecera" onClick={addHeader} />
          </>
        )}
      </CardSection>

      {hasBody ? (
        <CardSection step={3} title="Cuerpo" description="Lo que se envía al servicio.">
          <TextAreaField label="Contenido (JSON o texto)" value={config.body} monospace onChange={(body) => update({ body })} />
          <VariableHint variables={CONTACT_VARIABLES} />
          <p className="kit-hint">También cualquier campo del contacto o dato guardado en la conversación, p. ej. {"{ciudad}"}.</p>
        </CardSection>
      ) : null}

      <CardSection
        step={hasBody ? 4 : 3}
        title="Probar"
        description="Envía la petición ahora y elige qué datos de la respuesta guardar."
      >
        <IntegrationTestPanel config={config} rawConfig={draft.config} test={resources?.testIntegration} onSavePath={savePath} />
      </CardSection>

      <CardSection
        step={hasBody ? 5 : 4}
        title="Guardar datos de la respuesta"
        description="Copia valores de la respuesta a la ficha del cliente. Quedan disponibles como {campo} en los bloques siguientes."
        aside={<Counter value={config.responseMappings.length} />}
      >
        {config.responseMappings.length === 0 ? (
          <EmptyState
            title="No se guarda nada"
            description="Opcional. Ej.: guardar lead.id en el campo id_crm, o usa «Probar» y elige."
            action={<AddButton label="Añadir dato" onClick={addMapping} />}
          />
        ) : (
          <>
            <ul className="kit-list">
              {config.responseMappings.map((mapping, index) => (
                <ListCard
                  key={mapping.id}
                  title={`Dato ${index + 1}`}
                  removeLabel={`Quitar dato ${index + 1}`}
                  onRemove={() => update({ responseMappings: removeById(config.responseMappings, mapping.id) })}
                >
                  <InlineInput
                    value={mapping.path}
                    placeholder="Ruta en la respuesta: lead.id"
                    monospace
                    ariaLabel={`Ruta en la respuesta ${index + 1}`}
                    onChange={(path) => update({ responseMappings: replaceById(config.responseMappings, mapping.id, { path }) })}
                  />
                  <FieldPicker
                    label="Guardar en"
                    value={mapping.field}
                    contactFields={resources?.contactFields}
                    {...(resources?.createContactField ? { createField: resources.createContactField } : {})}
                    onChange={(field) => update({ responseMappings: replaceById(config.responseMappings, mapping.id, { field }) })}
                  />
                </ListCard>
              ))}
            </ul>
            <AddButton label="Añadir dato" onClick={addMapping} />
          </>
        )}
      </CardSection>

      <OutputsPreview outputs={integrationOutputs()} />
    </ToolEditorLayout>
  );
}
