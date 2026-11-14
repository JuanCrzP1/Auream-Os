import "./ai-editor.css";
import type { ToolEditorProps } from "../ToolUi";
import { SwitchField } from "../_kit/Switch";
import { AddButton, InlineInput, ListCard, Notice, TextAreaField, TextField, VariableHint } from "../_kit/fields";
import { FieldPicker } from "../_kit/FieldPicker";
import { CardSection, Counter, EmptyState, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { createLocalId } from "../_kit/createLocalId";
import { removeById, replaceById } from "../_kit/read";
import {
  AI_MAX_CONTEXT_TURNS,
  AI_MAX_INTENTS,
  aiOutputs,
  readAiConfig,
  type AiConfig,
  type AiIntent
} from "./aiConfig";
import { aiExtensionTool } from "./definition";
import { AiExtensionIcon } from "./AiExtensionIcon";
import { AiConnectionSection } from "./AiConnectionSection";
import { AiTestPanel } from "./AiTestPanel";

export function AiEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readAiConfig(draft.config);
  // Lo que se guarda es la configuración vigente: sin la clave ni el proveedor
  // que guardaban las versiones anteriores del bloque.
  const { apiKey: _legacyKey, provider: _legacyProvider, ...current } = draft.config;
  const update = (patch: Partial<AiConfig>) => onChange({ config: { ...current, ...config, ...patch } });
  const patchIntent = (id: string, patch: Partial<AiIntent>) => update({ intents: replaceById(config.intents, id, patch) });
  const addIntent = () => update({ intents: [...config.intents, { id: createLocalId("intent"), description: "", key: "" }] });

  return (
    <ToolEditorLayout
      resources={resources}
      accent={aiExtensionTool.colors.header}
      outputs={aiOutputs({ ...draft.config, ...config })}
      Icon={AiExtensionIcon}
      title="Extensión IA"
      description="Pide a un modelo de IA que responda, analice o clasifique el mensaje del cliente."
    >
      <CardSection step={1} title="Conexión y modelo" description="Qué cuenta de IA usa este bloque. La clave vive cifrada en tu cuenta, no en el flujo.">
        <AiConnectionSection config={config} resources={resources} onChange={update} />
      </CardSection>

      <CardSection step={2} title="Instrucciones" description="Cómo debe comportarse y qué recibe.">
        <TextAreaField
          label="Instrucciones del asistente"
          value={config.systemPrompt}
          placeholder="Ej.: Eres un asesor de ventas amable. Responde en máximo dos frases."
          onChange={(systemPrompt) => update({ systemPrompt })}
        />
        <TextField
          variables
          label="Mensaje que recibe la IA"
          value={config.userMessage}
          monospace
          hint="Normalmente una variable. Las instrucciones van arriba, no aquí."
          onChange={(userMessage) => update({ userMessage })}
        />
        <VariableHint />
      </CardSection>

      <CardSection step={3} title="Respuesta" description="Dónde queda lo que responde la IA.">
        <FieldPicker
          label="Guardar respuesta en"
          value={config.responseVariable}
          contactFields={resources?.contactFields}
          {...(resources?.createContactField ? { createField: resources.createContactField } : {})}
          onChange={(responseVariable) => update({ responseVariable })}
        />
        <TextField
          label="Guardar error en"
          hint="Dato técnico: queda solo en la conversación."
          value={config.errorVariable}
          monospace
          onChange={(errorVariable) => update({ errorVariable: errorVariable.trim() })}
        />
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
        <Notice>
          Usa el archivo que acaba de mandar el cliente, o el que guardó «Esperar respuesta» si el mensaje para la IA es esa variable (por ejemplo {"{respuesta}"}).
        </Notice>
        <SwitchField label="Audios" hint="Oye las notas de voz y entiende lo que dicen." checked={config.understandAudio} onChange={(understandAudio) => update({ understandAudio })} />
        <SwitchField label="Imágenes" hint="Ve las fotos y capturas que manda el cliente." checked={config.understandImage} onChange={(understandImage) => update({ understandImage })} />
        <SwitchField label="PDF" hint="Lee el texto de los documentos PDF." checked={config.understandPdf} onChange={(understandPdf) => update({ understandPdf })} />
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

      <CardSection step={6} title="Probar" description="Escribe lo que diría un cliente y mira qué responde la IA y por dónde sigue el flujo.">
        <AiTestPanel rawConfig={draft.config} outputs={aiOutputs({ ...draft.config, ...config })} test={resources?.testAi} />
      </CardSection>

      <OutputsPreview outputs={aiOutputs({ ...draft.config, ...config })} />
    </ToolEditorLayout>
  );
}
