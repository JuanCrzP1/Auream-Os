import "./node-readonly.css";
import type { ComponentType } from "react";
import type { ToolDraft, ToolEditorProps } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";

/**
 * El editor de un bloque en solo lectura (quien mira no puede editar
 * automatizaciones, p. ej. el Asesor): la herramienta se ve igual, con sus
 * campos apagados, y arriba un aviso. Nada de lo que toque se guarda.
 */
export function NodeReadOnlyBody({
  Editor,
  draft,
  resources
}: {
  readonly Editor: ComponentType<ToolEditorProps>;
  readonly draft: ToolDraft;
  readonly resources: ToolResources;
}) {
  return (
    <fieldset className="node-expanded__readonly" disabled>
      <p className="node-expanded__readonly-note">Solo lectura: tu rol puede ver esta configuración, no cambiarla.</p>
      <Editor draft={draft} resources={resources} onChange={() => undefined} />
    </fieldset>
  );
}
