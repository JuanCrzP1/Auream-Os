import { describe, expect, it } from "vitest";
import { STARTER_PIPELINE } from "../../domains/crm/domain/Pipeline.js";
import { ClientImport, type ImportCandidates } from "../../domains/crm/application/ClientImport.js";
import { crmWorld, OWNER, T } from "./helpers/crmFakes.js";

// ---------------------------------------------------------------------------
// Traer al embudo a los clientes que ya tienes: cuenta primero, trae solo a
// los que aún no están (a la etapa de entrada) y exige esa etapa.
// ---------------------------------------------------------------------------

/** Candidatos falsos: los contactos con chat que no tienen ninguna etapa del embudo. */
function candidates(world: ReturnType<typeof crmWorld>, withChat: ReadonlyArray<string>): ImportCandidates {
  const pending = (exclude: ReadonlyArray<string>) => withChat.filter((id) => !world.labelsOf(id).some((label) => exclude.includes(label)));
  return {
    count: async (_t, exclude) => pending(exclude).length,
    list: async (_t, exclude, _since, limit) => pending(exclude).slice(0, limit)
  };
}

describe("Traer clientes existentes al embudo", () => {
  it("cuenta, trae a los que faltan a la etapa de entrada y no toca a los que ya están", async () => {
    const world = crmWorld();
    const pipeline = await world.pipelineServices.create(OWNER, STARTER_PIPELINE);
    const stage = (name: string) => pipeline.stages.find((candidate) => candidate.name === name)!;
    world.addContact("a");
    world.addContact("b");
    world.addContact("pago", "573001112233", [stage("Pagó").labelId]);
    const imports = new ClientImport(world.pipelineServices, candidates(world, ["a", "b", "pago"]), world.labeler);

    expect(await imports.preview(OWNER, pipeline.id, 30)).toEqual({ count: 2 });
    expect(await imports.run(OWNER, pipeline.id, 30)).toEqual({ count: 2, remaining: 0 });
    expect(world.labelsOf("a")).toEqual([stage("Nuevo").labelId]);
    expect(world.labelsOf("pago")).toEqual([stage("Pagó").labelId]);
    expect(await imports.preview(OWNER, pipeline.id, null)).toEqual({ count: 0 });
    await expect(imports.preview(OWNER, pipeline.id, 0)).rejects.toThrow(/desde cuándo/);
  });

  it("sin etapa de entrada no trae a nadie", async () => {
    const world = crmWorld();
    const pipeline = await world.pipelineServices.create(OWNER, { ...STARTER_PIPELINE, entryStage: null });
    const imports = new ClientImport(world.pipelineServices, candidates(world, []), world.labeler);
    await expect(imports.preview(OWNER, pipeline.id, 30)).rejects.toThrow(/Elige primero en qué etapa/);
  });
});
