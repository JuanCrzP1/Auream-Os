import type { FlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { InboundEnvelope, Session } from "../../../../contracts/RuntimeContracts";
import type { FlowRunResult } from "../../../../contracts/FlowTimerContracts";
import type { SimulationOptions, SimulationPersona } from "../../../../contracts/SimulationContracts";
import type { JournalRecord } from "../domain/SimulationJournal";

// ---------------------------------------------------------------------------
// El «arenero» donde corre un turno de prueba: el motor de flujos REAL con
// efectos de prueba (el cliente de prueba en lugar de contactos reales, el
// Pixel sin enviar a Meta, nada sale por WhatsApp; la IA y la Integración
// reales solo si se piden). Se arma de cero en cada turno: no guarda nada.
// Lo implementa la composición (`apps/api`), que es quien conoce los adaptadores.
// ---------------------------------------------------------------------------

export interface SandboxRun {
  readonly result: FlowRunResult;
  /** La sesión como quedó (con su contexto), para el próximo turno. */
  readonly session: Session | null;
  /** El cliente de prueba como quedó (etiquetas, campos). */
  readonly persona: SimulationPersona;
  /** Bloque por bloque: qué devolvió y qué hicieron sus efectos. */
  readonly records: ReadonlyArray<JournalRecord>;
  /** Turnos del Distribuidor después del turno. */
  readonly counters: Readonly<Record<string, number>>;
}

export interface SimulationSandbox {
  run(snapshot: FlowSnapshot, session: Session | null, envelope: InboundEnvelope): Promise<SandboxRun>;
}

export interface SimulationSandboxFactory {
  create(input: {
    readonly tenantId: string;
    readonly persona: SimulationPersona;
    readonly counters: Readonly<Record<string, number>>;
    readonly options: SimulationOptions;
  }): SimulationSandbox;
}
