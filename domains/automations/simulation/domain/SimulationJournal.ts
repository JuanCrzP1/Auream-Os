import type { NodeExecutionResult } from "../../../../contracts/RuntimeContracts";

// ---------------------------------------------------------------------------
// La bitácora de un turno de prueba: qué devolvió cada bloque y lo que sus
// efectos (de prueba) hicieron mientras se ejecutaba: «Etiqueta añadida»,
// «Integración simulada», «Pixel: Lead (no se envió a Meta)». Los efectos
// anotan sobre el bloque en curso; el motor sigue sin saber que es una prueba.
// ---------------------------------------------------------------------------

export interface JournalRecord {
  readonly nodeId: string;
  readonly result: NodeExecutionResult;
  readonly notes: ReadonlyArray<string>;
}

export class SimulationJournal {
  private readonly records: JournalRecord[] = [];
  private current: { nodeId: string; notes: string[] } | null = null;

  /** Empieza un bloque. */
  public begin(nodeId: string): void {
    this.current = { nodeId, notes: [] };
  }

  /** Lo que hizo un efecto durante el bloque en curso. */
  public note(text: string): void {
    this.current?.notes.push(text);
  }

  /** Termina el bloque en curso con lo que devolvió. */
  public end(result: NodeExecutionResult): void {
    if (!this.current) return;
    this.records.push({ nodeId: this.current.nodeId, result, notes: this.current.notes });
    this.current = null;
  }

  public entries(): ReadonlyArray<JournalRecord> {
    return this.records;
  }
}
