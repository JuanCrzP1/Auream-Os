import type { ContactLabeler, CrmTeamMember, LabelOrigin, StageLabels } from "../../../domains/crm/application/CrmGateways.js";
import type { CrmEventInput, CrmEventLog, CrmEventRecord, DealChanges, DealEntry, DealRepository, PipelineRecord, PipelineRepository } from "../../../domains/crm/application/CrmRepositories.js";
import { PipelineServices } from "../../../domains/crm/application/PipelineServices.js";
import { StageLabelRules } from "../../../domains/crm/application/StageLabelRules.js";
import { StageTracker } from "../../../domains/crm/application/StageTracker.js";
import type { CrmActor } from "../../../domains/crm/application/crmViews.js";
import type { Deal } from "../../../domains/crm/domain/Deal.js";
import type { Pipeline } from "../../../domains/crm/domain/Pipeline.js";

// ---------------------------------------------------------------------------
// Un CRM en memoria para las pruebas: etiquetas, contactos (con la regla de
// una etapa por embudo, como Contactos), embudos, registros e historial. El
// etiquetador avisa al StageTracker igual que en producción.
// ---------------------------------------------------------------------------

export const T = "tenant-a";
export const OWNER: CrmActor = { tenantId: T, userId: "u-owner", canWrite: true, canManage: true };

export function crmWorld(options: { members?: CrmTeamMember[] } = {}) {
  const labels = new Map<string, { id: string; name: string; color: string }>();
  const contacts = new Map<string, { phone: string | null; labels: Set<string> }>();
  const pipelines = new Map<string, PipelineRecord & { position: number }>();
  const deals = new Map<string, Deal>();
  const events: Array<CrmEventInput & { at: number }> = [];
  let clock = 0;

  const pipelineOf = (record: PipelineRecord & { position: number }): Pipeline => ({
    id: record.id,
    tenantId: T,
    name: record.name,
    entryStageId: record.entryStageId,
    saleStageId: record.saleStageId,
    defaultProductId: record.defaultProductId,
    autoAssign: record.autoAssign,
    stages: record.stages.map((stage, position) => ({ id: stage.id, pipelineId: record.id, labelId: stage.labelId, outcome: stage.outcome, position, name: labels.get(stage.labelId)!.name, color: labels.get(stage.labelId)!.color }))
  });

  const pipelineRepository: PipelineRepository = {
    list: async () => [...pipelines.values()].sort((a, b) => a.position - b.position).map(pipelineOf),
    find: async (_t, id) => (pipelines.has(id) ? pipelineOf(pipelines.get(id)!) : null),
    save: async (_t, record) => void pipelines.set(record.id, { ...record, position: pipelines.get(record.id)?.position ?? pipelines.size }),
    remove: async (_t, id) => pipelines.delete(id),
    stagesForLabels: async (_t, ids) => [...pipelines.values()].map(pipelineOf).flatMap((p) => p.stages).filter((s) => ids.includes(s.labelId)),
    stageLabelGroups: async (_t, ids) => [...pipelines.values()].filter((p) => p.stages.some((s) => ids.includes(s.labelId))).map((p) => p.stages.map((s) => s.labelId)),
    pipelineUsingLabel: async (_t, labelId, except) => [...pipelines.values()].find((p) => p.id !== except && p.stages.some((s) => s.labelId === labelId))?.name ?? null
  };

  const key = (pipelineId: string, contactId: string) => `${pipelineId}:${contactId}`;
  const dealRepository: DealRepository = {
    find: async (_t, p, c) => deals.get(key(p, c)) ?? null,
    forContact: async (_t, c) => [...deals.values()].filter((d) => d.contactId === c).map((d) => ({ ...d, ownerName: d.ownerId })),
    enter: async (_t, p, c, entry: DealEntry) => {
      const before = deals.get(key(p, c));
      const now = new Date(Date.UTC(2026, 10, 10, 12, 0, clock++)).toISOString();
      const deal: Deal = {
        tenantId: T,
        pipelineId: p,
        contactId: c,
        stageId: entry.stageId,
        stageEnteredAt: before?.stageId === entry.stageId ? before.stageEnteredAt : now,
        wonAt: before?.wonAt ?? (entry.won ? now : null),
        value: before?.value ?? entry.value,
        productId: before?.productId ?? entry.productId,
        productName: before?.productId ? before.productName : entry.productName,
        ownerId: before?.ownerId ?? entry.ownerId
      };
      deals.set(key(p, c), deal);
      return deal;
    },
    leave: async (_t, p, c) => void (deals.has(key(p, c)) && deals.set(key(p, c), { ...deals.get(key(p, c))!, stageId: null })),
    update: async (_t, p, c, changes: DealChanges) => {
      const next = { ...deals.get(key(p, c))!, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) } as Deal;
      deals.set(key(p, c), next);
      return next;
    }
  };

  const eventLog: CrmEventLog = {
    append: async (_t, event) => void events.push({ ...event, at: clock++ }),
    forContact: async (_t, c, limit) =>
      events.filter((e) => e.contactId === c).reverse().slice(0, limit).map((e, i): CrmEventRecord => ({ ...e, id: `e${i}`, actorName: e.actorId, flowName: e.flowKey, createdAt: "" }))
  };

  const rules = new StageLabelRules(pipelineRepository);
  let tracker: StageTracker | null = null;
  const labeler: ContactLabeler = {
    snapshot: async (_t, c) => (contacts.has(c) ? { phone: contacts.get(c)!.phone, labelIds: [...contacts.get(c)!.labels] } : null),
    change: async (_t, c, change, origin: LabelOrigin) => {
      const held = contacts.get(c)!.labels;
      const before = new Set(held);
      for (const group of await rules.groupsOf(T, change.add)) for (const id of group) if (!change.add.includes(id)) held.delete(id);
      for (const id of change.remove) held.delete(id);
      for (const id of change.add) held.add(id);
      const added = [...held].filter((id) => !before.has(id));
      const removed = [...before].filter((id) => !held.has(id));
      if (added.length || removed.length) await tracker?.labelsChanged(T, c, { added, removed }, origin);
    }
  };

  const stageLabels: StageLabels = {
    ensure: async (_t, name, color) => {
      const found = [...labels.values()].find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (found) return found;
      const label = { id: `label-${name.toLowerCase().replace(/\s+/g, "-")}`, name, color: color ?? "#6c5ce7" };
      labels.set(label.id, label);
      return label;
    },
    find: async (_t, id) => labels.get(id) ?? null,
    update: async (_t, id, name, color) => void labels.set(id, { id, name, color })
  };

  const members = options.members ?? [
    { userId: "u-owner", name: "Camilo", photoUrl: null, canSell: true },
    { userId: "u-sofia", name: "Sofía", photoUrl: null, canSell: true },
    { userId: "u-viewer", name: "Vera", photoUrl: null, canSell: false }
  ];
  const team = { members: async () => members };
  const catalog = {
    findActive: async (_t: string, id: string | null | undefined) =>
      id === "video" ? { id: "video", name: "Video personalizado", prices: [{ country: "CO", currency: "COP", amount: 49900 }, { country: "VE", currency: "USD", amount: 12.5 }] } : null
  };
  let turn = 0;
  const turns = { next: async () => turn++ };
  const errors: unknown[] = [];
  tracker = new StageTracker(pipelineRepository, dealRepository, eventLog, labeler, catalog, team, turns, (error) => errors.push(error));
  const pipelineServices = new PipelineServices(pipelineRepository, stageLabels, team, catalog);

  return {
    labels, contacts, deals, events, errors, labeler, catalog, team, tracker, rules,
    pipelineRepository, dealRepository, eventLog, pipelineServices,
    addContact: (id: string, phone: string | null = "573001112233", held: string[] = []) => void contacts.set(id, { phone, labels: new Set(held) }),
    labelsOf: (id: string) => [...contacts.get(id)!.labels]
  };
}
