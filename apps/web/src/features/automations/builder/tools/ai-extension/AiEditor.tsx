import type { ToolEditorProps } from "../ToolUi";
import { SwitchField } from "../_kit/Switch";
import { AddButton, InlineInput, ListCard, SelectField, TextAreaField, TextField, VariableHint } from "../_kit/fields";
import { CardSection, Counter, EmptyState, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { createLocalId } from "../_kit/createLocalId";
import { removeById, replaceById } from "../_kit/read";
import {
  AI_MAX_CONTEXT_TURNS,
  AI_MAX_INTENTS,
  AI_MODELS,
  AI_PROVIDER_OPTIONS,
  aiOutputs,
  readAiConfig,
  type AiConfig,
  type AiIntent
} from "./aiConfig";
import { aiExtensionTool } from "./definition";
import { AiExtensionIcon } from "./AiExtensionIcon";

export function AiEditor({ draft, onChange }: ToolEditorProps) {
  const config = readAiConfig(draft.config);
  const update = (patch: Partial<AiConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });
  const patchIntent = (id: string, patch: Partial<AiIntent>) => update({ intents: replaceById(config.intents, id, patch) });
  const addIntent = () => update({ intents: [...config.intents, { id: createLocalId("intent"), description: "", key: "" }] });

  return (
    <ToolEditorLayout
      accent={aiExtensionTool.colors.header}
      outputs={aiOutputs({ ...draft.config, ...config })}
      Icon={AiExtensionIcon}
      title="Extensión IA"
      description="Pide a un modelo de IA que responda, analice o clasifique el mensaje del cliente."
    >
      <CardSection step={1} title="Modelo" description="Qué IA procesa el mensaje.">
        <div className="kit-grid">
          <SelectField
            label="Proveedor"
            value={config.provider}
            options={AI_PROVIDER_OPTIONS}
            onChange={(provider) => update({ provider, model: AI_MODELS[provider][0].value })}
          />
          <SelectField label="Modelo" value={config.model} options={AI_MODELS[config.provider]} onChange={(model) => update({ model })} />
        </div>
        <TextField
          label="Clave de API"
          type="password"
          value={config.apiKey}
          placeholder="sk-…"
          hint="Se guardará cifrada cuando exista el almacén de credenciales."
          onChange={(apiKey) => update({ apiKey })}
        />
      </CardSection>

      <CardSection step={2} title="Instrucciones" description="Cómo debe comportarse y qué recibe.">
        <TextAreaField
          label="Instrucciones del asistente"
          value={config.systemPrompt}
          placeholder="Ej.: Eres un asesor de ventas amable. Responde en máximo dos frases."
          onChange={(systemPrompt) => update({ systemPrompt })}
        />
        <TextField
          label="Mensaje que recibe la IA"
          value={config.userMessage}
          monospace
          hint="Normalmente una variable. Las instrucciones van arriba, no aquí."
          onChange={(userMessage) => update({ userMessage })}
        />
        <VariableHint variables={["{last_message}", "{full_name}", "{comprobante}"]} />
      </CardSection>

      <CardSection step={3} title="Respuesta" description="Dónde queda lo que responde la IA.">
        <div className="kit-grid">
          <TextField
            label="Guardar respuesta en"
            value={config.responseVariable}
            monospace
            onChange={(responseVariable) => update({ responseVariable: responseVariable.trim() })}
          />
          <TextField
            label="Guardar error en"
            value={config.errorVariable}
            monospace
            onChange={(errorVariable) => update({ errorVariable: errorVariable.trim() })}
          />
        </div>
        <SwitchField
          label="Enviar la respuesta al cliente"
          hint="Apágalo si solo quieres clasificar o guardar."
          checked={config.autoSend}
          onChange={(autoSend) => update({ autoSend })}
        />
        <SwitchField
          label="Recordar la conversación"
          hint="La IA recibe los mensajes anteriores como contexto."
          checked={config.keepContext}
          onChange={(keepContext) => update({ keepContext })}
        />
        {config.keepContext ? (
          <TextField
            label={`Mensajes de contexto (1–${AI_MAX_CONTEXT_TURNS})`}
            type="number"
            value={String(config.contextTurns)}
            onChange={(value) => {
              const turns = Math.floor(Number(value));
              update({ contextTurns: Number.isFinite(turns) ? Math.min(Math.max(turns, 1), AI_MAX_CONTEXT_TURNS) : 5 });
            }}
          />
        ) : null}
      </CardSection>

      <CardSection step={4} title="Entender archivos" description="Qué puede leer además del texto.">
        <SwitchField label="Audios" hint="Transcribe notas de voz." checked={config.understandAudio} onChange={(understandAudio) => update({ understandAudio })} />
        <SwitchField label="Imágenes" hint="Describe fotos y capturas." checked={config.understandImage} onChange={(understandImage) => update({ understandImage })} />
        <SwitchField label="PDF" hint="Lee documentos." checked={config.understandPdf} onChange={(understandPdf) => update({ understandPdf })} />
      </CardSection>

      <CardSection
        step={5}
        title="Clasificar intención"
        description="Opcional. Cada intención crea un camino; si ninguna encaja, sigue por la de respaldo."
        aside={<Counter value={config.intents.length} max={AI_MAX_INTENTS} />}
      >
        {config.intents.length === 0 ? (
          <EmptyState
            title="Sin clasificación"
            description="La IA solo responde. Añade intenciones para enrutar: precios, soporte, hablar con un humano…"
            action={<AddButton label="Añadir intención" onClick={addIntent} />}
          />
        ) : (
          <>
            <ul className="kit-list">
              {config.intents.map((intent, index) => (
                <ListCard
                  key={intent.id}
                  title={`Intención ${index + 1}`}
                  removeLabel={`Quitar intención ${index + 1}`}
                  onRemove={() => update({ intents: removeById(config.intents, intent.id) })}
                >
                  <InlineInput
                    value={intent.description}
                    placeholder="Cuándo aplica: pregunta por precios"
                    ariaLabel={`Descripción de la intención ${index + 1}`}
                    maxLength={200}
                    onChange={(description) => patchIntent(intent.id, { description })}
                  />
                  <InlineInput
                    value={intent.key}
                    monospace
                    placeholder="Nombre de la salida: precios"
                    ariaLabel={`Nombre de salida de la intención ${index + 1}`}
                    onChange={(key) => patchIntent(intent.id, { key: key.trim() })}
                  />
                </ListCard>
              ))}
            </ul>
            <AddButton label="Añadir intención" disabled={config.intents.length >= AI_MAX_INTENTS} onClick={addIntent} />
            <TextField
              label="Salida de respaldo"
              value={config.fallbackKey}
              monospace
              onChange={(fallbackKey) => update({ fallbackKey: fallbackKey.trim() })}
            />
          </>
        )}
      </CardSection>

      <OutputsPreview outputs={aiOutputs({ ...draft.config, ...config })} />
    </ToolEditorLayout>
  );
}
