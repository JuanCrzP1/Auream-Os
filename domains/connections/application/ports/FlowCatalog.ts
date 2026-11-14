// ---------------------------------------------------------------------------
// FlowCatalog — lo que Conexiones necesita saber de los flujos: que el flujo
// elegido existe en la cuenta y cómo se llama. No conoce su contenido.
// ---------------------------------------------------------------------------

export interface FlowReference {
  readonly id: string;
  /** Con la que el motor carga el flujo. */
  readonly key: string;
  readonly name: string;
  readonly archived: boolean;
  /** Pausado: no arranca solo (disparadores, «Ir a otro flujo»). Ausente: no. */
  readonly paused?: boolean;
}

export interface FlowCatalog {
  /** Los flujos de la cuenta con esos ids (los que no existan, no vienen). */
  findMany(tenantId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<FlowReference>>;
}
