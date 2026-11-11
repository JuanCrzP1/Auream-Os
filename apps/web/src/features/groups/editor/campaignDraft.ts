import { DEFAULT_WELCOME, GROUP_LIMITS, type CampaignSummary, type SaveCampaignRequest } from "@contracts/GroupContracts";

/** «Lanzamiento Navidad» → «lanzamiento-navidad» (igual que el servidor). */
export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
}

export function emptyCampaign(): SaveCampaignRequest {
  return {
    name: "",
    slug: "",
    connectionIds: [],
    capacity: GROUP_LIMITS.defaultCapacity,
    template: { namePattern: "", description: "", imageUrl: null, announce: true, locked: true },
    rules: { welcome: { enabled: true, text: DEFAULT_WELCOME, everyMinutes: 15 }, labelOnJoin: true }
  };
}

export function fromSummary(campaign: CampaignSummary): SaveCampaignRequest {
  return { name: campaign.name, slug: campaign.slug, connectionIds: campaign.connections.map((c) => c.id), capacity: campaign.capacity, template: campaign.template, rules: campaign.rules };
}

export function draftProblem(draft: SaveCampaignRequest): string | null {
  if (!draft.name.trim()) return "Ponle un nombre a la campaña.";
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(draft.slug)) return "El enlace va con letras sin tildes, números y guiones (3 a 40).";
  if (draft.connectionIds.length === 0) return "Elige el número que crea los grupos.";
  return null;
}
