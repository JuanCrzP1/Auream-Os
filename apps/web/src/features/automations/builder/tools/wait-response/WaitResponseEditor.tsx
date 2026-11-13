import "./wait-response-editor.css";
import { useState } from "react";
import {
  WAIT_RESPONSE_DEFAULT_TIMEOUT,
  readWaitResponseConfig,
  type WaitResponseConfig,
  type WaitResponseTimeout as WaitResponseTimeoutValue,
  type WaitResponseTimeUnit
} from "@contracts/WaitResponseConfig";
import type { ToolEditorProps } from "../ToolUi";
import { SwitchField } from "../_kit/Switch";
import { TextAreaField, VariableHint } from "../_kit/fields";
import { CardSection, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { CONTACT_VARIABLES } from "../_kit/catalogs";
import { waitResponseTool } from "./definition";
import { WaitResponseIcon } from "./WaitResponseIcon";
import { WaitResponseTimeout } from "./editor/WaitResponseTimeout";
import { WaitResponseReaction } from "./editor/WaitResponseReaction";
import { WaitResponseSaveSection } from "./editor/WaitResponseSaveSection";

/**
 * Editor de «Esperar respuesta». La configuración se lee de `draft.config` en
 * cada render; no hay copia local.
 *
 * Única excepción: `lastTimeout`, memoria del gesto. Encender «sin límite»
 * retira `timeout` del config (dejarlo sería la contradicción que la
 * validación rechaza); al apagarlo se restaura lo último que el usuario
 * escribió en vez del default.
 */
export function WaitResponseEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readWaitResponseConfig(draft.config);
  const message = typeof draft.content.text === "string" ? draft.content.text : "";

  const [lastTimeout, setLastTimeout] = useState<WaitResponseTimeoutValue>(
    config.timeout ?? WAIT_RESPONSE_DEFAULT_TIMEOUT
  );

  /**
   * Publica la configuración. Los campos opcionales se apartan de `rest` antes
   * de reconstruir: `applyNodePatch` reemplaza el objeto entero, y volcar el
   * config viejo encima impediría quitarlos. Lo desconocido se conserva.
   */
  const update = (patch: Partial<WaitResponseConfig>) => {
    const next: WaitResponseConfig = { ...config, ...patch };
    const {
      waitIndefinitely: _wi,
      groupMessages: _gm,
      replyToInbound: _ri,
      timeout: _t,
      reaction: _r,
      targetKey: _tk,
      onMismatch: _om,
      retryMessage: _rm,
      ...rest
    } = draft.config;

    onChange({
      config: {
        ...rest,
        waitIndefinitely: next.waitIndefinitely,
        groupMessages: next.groupMessages,
        replyToInbound: next.replyToInbound,
        ...(next.timeout ? { timeout: next.timeout } : {}),
        ...(next.reaction ? { reaction: next.reaction } : {}),
        ...(next.targetKey ? { targetKey: next.targetKey } : {}),
        // «Preguntar de nuevo» solo tiene sentido guardando en algún lado.
        ...(next.targetKey && next.onMismatch ? { onMismatch: next.onMismatch } : {}),
        ...(next.targetKey && next.onMismatch && next.retryMessage ? { retryMessage: next.retryMessage } : {})
      }
    });
  };

  return (
    <ToolEditorLayout
      accent={waitResponseTool.colors.header}
      Icon={WaitResponseIcon}
      title="Esperar respuesta"
      description="Pausa el flujo hasta que el cliente conteste y guarda lo que responda."
      outputs={waitResponseTool.outputs?.(draft.config) ?? null}
      className="wait-response"
    >
      <CardSection step={1} title="Mensaje antes de esperar" description="Opcional. Déjalo vacío si la pregunta ya la hizo un bloque anterior.">
        <TextAreaField
          label="Mensaje antes de esperar"
          value={message}
          placeholder="Ej.: ¿En qué ciudad te encuentras?"
          onChange={(text) => onChange({ content: { ...draft.content, text } })}
        />
        <VariableHint variables={CONTACT_VARIABLES} />
      </CardSection>

      <CardSection step={2} title="Tiempo de espera" description="Cuánto esperar antes de seguir por «Tiempo agotado».">
        <SwitchField
          label="Esperar sin límite"
          hint="La conversación queda a la espera hasta que el cliente responda."
          checked={config.waitIndefinitely}
          onChange={(on) =>
            update(on ? { waitIndefinitely: true, timeout: undefined } : { waitIndefinitely: false, timeout: lastTimeout })
          }
        />

        {!config.waitIndefinitely && (
          <WaitResponseTimeout
            amount={config.timeout?.amount ?? WAIT_RESPONSE_DEFAULT_TIMEOUT.amount}
            unit={config.timeout?.unit ?? WAIT_RESPONSE_DEFAULT_TIMEOUT.unit}
            onChange={(amount: number, unit: WaitResponseTimeUnit) => {
              const timeout = { amount, unit };
              setLastTimeout(timeout);
              update({ timeout });
            }}
          />
        )}
      </CardSection>

      <CardSection step={3} title="Cómo tratar la respuesta" description="Primero cómo se recibe, luego cómo se contesta.">
        <SwitchField
          label="Agrupar mensajes"
          hint="Si el cliente escribe varios mensajes seguidos, se toman como una sola respuesta."
          checked={config.groupMessages}
          onChange={(groupMessages) => update({ groupMessages })}
        />
        <SwitchField
          label="Responder al mensaje recibido"
          hint="El mensaje de este bloque se envía citando el último mensaje del cliente."
          checked={config.replyToInbound}
          onChange={(replyToInbound) => update({ replyToInbound })}
        />
        <WaitResponseReaction reaction={config.reaction} onChange={(reaction) => update({ reaction })} />
      </CardSection>

      <WaitResponseSaveSection config={config} resources={resources} update={update} />

      <OutputsPreview outputs={waitResponseTool.outputs?.(draft.config) ?? null} />
    </ToolEditorLayout>
  );
}
