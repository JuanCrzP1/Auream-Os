import { useId } from "react";
import { mismatchMessage } from "@contracts/FieldValues";
import type { WaitResponseConfig } from "@contracts/WaitResponseConfig";
import { WAIT_RESPONSE_MAX_RETRIES } from "@contracts/WaitResponseConfig";
import { FieldPicker, findField } from "../../_kit/FieldPicker";
import { TextField } from "../../_kit/fields";
import { CardSection } from "../../_kit/layout";
import type { ToolResources } from "../../ToolResources";

const MISMATCH_TITLE: Readonly<Record<string, string>> = {
  list: "Si responde algo que no está en la lista",
  number: "Si no responde un número",
  date: "Si no responde una fecha",
  boolean: "Si no responde sí o no"
};

/**
 * «Guardar la respuesta»: se elige el Campo del cliente (o un dato solo de la
 * conversación). Con un campo con tipo, qué hacer si la respuesta no encaja:
 * volver a preguntar (hasta 2 veces) o seguir igual.
 */
export function WaitResponseSaveSection({
  config,
  resources,
  update
}: {
  readonly config: WaitResponseConfig;
  readonly resources: ToolResources | undefined;
  readonly update: (patch: Partial<WaitResponseConfig>) => void;
}) {
  const group = useId();
  const field = findField(resources?.contactFields, config.targetKey ?? "");
  const typed = field && field.type !== "text" ? field : undefined;

  return (
    <CardSection step={4} title="Guardar la respuesta" description="En la ficha del cliente, para usarla en este y otros flujos.">
      <FieldPicker
        label="Guardar en"
        value={config.targetKey ?? ""}
        emptyLabel="No guardar"
        clearLabel="No guardar"
        contactFields={resources?.contactFields}
        {...(resources?.createContactField ? { createField: resources.createContactField } : {})}
        onChange={(targetKey) => update({ targetKey: targetKey || undefined })}
      />
      {typed ? (
        <fieldset className="wait-response__mismatch">
          <legend>{MISMATCH_TITLE[typed.type]}</legend>
          <label>
            <input type="radio" name={group} className="nodrag" checked={config.onMismatch === "retry"} onChange={() => update({ onMismatch: "retry" })} />
            <span>
              <strong>Preguntar de nuevo</strong>
              <span>Hasta {WAIT_RESPONSE_MAX_RETRIES} veces; si sigue sin encajar, el flujo sigue y lo que escribió queda solo en la conversación.</span>
            </span>
          </label>
          <label>
            <input type="radio" name={group} className="nodrag" checked={config.onMismatch !== "retry"} onChange={() => update({ onMismatch: undefined, retryMessage: undefined })} />
            <span>
              <strong>Seguir igual</strong>
              <span>Lo que escribió queda en la conversación, no en la ficha.</span>
            </span>
          </label>
          {config.onMismatch === "retry" ? (
            <TextField
              variables
              label="Mensaje al preguntar de nuevo"
              value={config.retryMessage ?? ""}
              placeholder={mismatchMessage(typed)}
              hint="Déjalo vacío para usar el de ejemplo, con las opciones de hoy."
              onChange={(retryMessage) => update({ retryMessage: retryMessage.trim() ? retryMessage : undefined })}
            />
          ) : null}
        </fieldset>
      ) : null}
    </CardSection>
  );
}
