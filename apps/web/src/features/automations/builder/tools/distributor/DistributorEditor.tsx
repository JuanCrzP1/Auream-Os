import "./distributor-editor.css";
import type { ToolEditorProps } from "../ToolUi";
import { AddButton, Notice } from "../_kit/fields";
import { CardSection, Counter, EmptyState, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { replaceById } from "../_kit/read";
import { addOutput, removeOutput, type DistributorOutput } from "./distributorOutputs";
import { readDistributorOutputs, readRawOutputLabels } from "./readDistributorConfig";
import { DistributorOutputRow } from "./editor/DistributorOutputRow";
import { distributorTool } from "./definition";
import { DistributorIcon } from "./DistributorIcon";

/**
 * Editor del Distribuidor. Sin estado propio: las salidas se leen de
 * `draft.config` en cada render.
 */
export function DistributorEditor({ draft, onChange }: ToolEditorProps) {
  const outputs = readDistributorOutputs(draft.config);
  const rawLabels = readRawOutputLabels(draft.config);

  // `applyNodePatch` reemplaza `config` entero: se conserva lo desconocido.
  const publish = (next: ReadonlyArray<DistributorOutput>) => {
    const { outputs: _previous, ...rest } = draft.config;
    onChange({ config: { ...rest, outputs: next } });
  };

  const add = () => publish(addOutput(outputs));

  return (
    <ToolEditorLayout
      accent={distributorTool.colors.header}
      Icon={DistributorIcon}
      title="Distribuidor"
      description="Reparte los contactos por turnos entre varios caminos, sin mirar lo que escriben."
      outputs={outputs}
      className="distributor"
    >
      <CardSection
        step={1}
        title="Salidas"
        description="Cada salida es un camino. Los contactos se reparten en orden: 1, 2, 3… y vuelta a empezar."
        aside={<Counter value={outputs.length} />}
      >
        {outputs.length === 0 ? (
          <EmptyState
            title="No hay salidas configuradas todavía."
            description="Ej.: «Asesor Ana» y «Asesor Luis» para repartir los chats entre dos personas."
            action={<AddButton label="Añadir salida" onClick={add} />}
          />
        ) : (
          <>
            <ul className="kit-list">
              {outputs.map((output, index) => (
                <DistributorOutputRow
                  key={output.id}
                  output={output}
                  label={rawLabels.get(output.id) ?? output.label}
                  index={index}
                  onRename={(label) => publish(replaceById(outputs, output.id, { label }))}
                  onRemove={(id) => publish(removeOutput(outputs, id))}
                />
              ))}
            </ul>
            <AddButton label="Añadir salida" onClick={add} />
          </>
        )}
      </CardSection>

      <Notice>
        Conecta cada salida desde su punto en el lienzo. Al eliminar una salida también desaparecen su punto y sus
        conexiones.
      </Notice>
      <OutputsPreview outputs={outputs} />
    </ToolEditorLayout>
  );
}
