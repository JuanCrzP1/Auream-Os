// ---------------------------------------------------------------------------
// FlowCatalog — lo que Conexiones necesita saber de los flujos: que el flujo
// elegido existe en la cuenta y cómo se llama. No conoce su contenido.
// ---------------------------------------------------------------------------

export interface FlowReference {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
}

export interface FlowCatalog {
  /** Los flujos de la cuenta con esos ids (los que no existan, no vienen). */
  findMany(tenantId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<FlowReference>>;
}
