import "./interval-editor.css";
import { readIntervalConfig, type IntervalConfig, type IntervalTrigger } from "@contracts/IntervalConfig";
import type { ToolEditorProps } from "../ToolUi";
import { CardSection, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { intervalTool } from "./definition";
import { IntervalIcon } from "./IntervalIcon";
import { explainInterval } from "./summarizeInterval";
import { validateInterval } from "./validateInterval";
import { IntervalTriggerPicker } from "./editor/IntervalTriggerPicker";
import { IntervalScheduleToggle } from "./editor/IntervalScheduleToggle";
import { IntervalWaitFields } from "./editor/IntervalWaitFields";
import { IntervalDateFields } from "./editor/IntervalDateFields";
import { IntervalScheduleFields } from "./editor/IntervalScheduleFields";

/**
 * Editor del Programador. Solo compone: arriba el momento principal (dos
 * pestañas excluyentes), abajo la restricción horaria (un interruptor que se
 * suma, no una tercera pestaña). Esa forma es la regla de negocio.
 *
 * Sin estado propio: se lee de `draft.config` en cada render. Cambiar de
 * momento o apagar el horario no borra lo configurado en el otro.
 */
export function IntervalEditor({ draft, onChange }: ToolEditorProps) {
  const config = readIntervalConfig(draft.config);
  const validation = validateInterval(draft.content, draft.config);
  const explanation = explainInterval(config);

  /**
   * Publica la configuración. Se apartan los campos propios (y `mode`, del
   * modelo anterior, para que un nodo heredado se guarde con la forma actual);
   * lo desconocido se conserva.
   */
  const publish = (patch: Partial<IntervalConfig>) => {
    const next: IntervalConfig = { ...config, ...patch };
    const {
      mode: _m,
      trigger: _t,
      wait: _w,
      moment: _mo,
      scheduleEnabled: _se,
      schedule: _s,
      ...rest
    } = draft.config;

    onChange({
      config: {
        ...rest,
        trigger: next.trigger,
        wait: next.wait,
        moment: next.moment,
        scheduleEnabled: next.scheduleEnabled,
        schedule: next.schedule
      }
    });
  };

  return (
    <ToolEditorLayout
      accent={intervalTool.colors.header}
      Icon={IntervalIcon}
      title="Programador"
      description="Decide cuándo continúa la conversación: tras un tiempo o en una fecha, y si debe respetar un horario."
      outputs={null}
      className="interval"
    >
      <CardSection step={1} title="¿Cuándo debe continuar?" description="Elige una espera o una cita. Solo una de las dos gobierna.">
        <div className="iv-panel">
          <IntervalTriggerPicker value={config.trigger} onChange={(trigger: IntervalTrigger) => publish({ trigger })} />

          {/* `key` remonta al cambiar de sección para disparar la transición. */}
          <div className="iv-panel__body" key={config.trigger}>
            {config.trigger === "interval" ? (
              <IntervalWaitFields wait={config.wait} onChange={(wait) => publish({ wait })} />
            ) : (
              <IntervalDateFields moment={config.moment} onChange={(moment) => publish({ moment })} />
            )}
          </div>
        </div>
      </CardSection>

      <CardSection step={2} title="Horario permitido" description="Opcional. Se suma a lo anterior: si cae fuera del horario, espera al siguiente tramo.">
        <div className="iv-extra">
          <IntervalScheduleToggle value={config.scheduleEnabled} onChange={(scheduleEnabled) => publish({ scheduleEnabled })} />
          {config.scheduleEnabled ? (
            <IntervalScheduleFields schedule={config.schedule} onChange={(schedule) => publish({ schedule })} />
          ) : null}
        </div>
      </CardSection>

      {/* Solo la confirmación. El motivo del rechazo lo muestra el marco al
          intentar guardar, no mientras se construye. */}
      {validation.valid && explanation !== null ? (
        <p className="interval__summary" role="status">
          {explanation}
        </p>
      ) : null}

      <OutputsPreview outputs={null} />
    </ToolEditorLayout>
  );
}
