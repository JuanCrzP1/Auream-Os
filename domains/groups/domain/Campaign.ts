import {
  DEFAULT_WELCOME,
  GROUP_LIMITS,
  SLUG_PATTERN,
  type CampaignRules,
  type CampaignStatus,
  type GroupTemplate,
  type SaveCampaignRequest
} from "../../../contracts/GroupContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Una campaña de grupos: un enlace único (`slug`) que lleva al grupo con cupo
// y crea el siguiente (mismo nombre con « #n», foto, descripción y reglas)
// cuando uno se llena.
// ---------------------------------------------------------------------------

export interface Campaign extends SaveCampaignRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly status: CampaignStatus;
  readonly createdAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** «Lanzamiento Navidad» → «lanzamiento-navidad». */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** El nombre del grupo número `n`: «Navidad · Dilo cantando #3». */
export function groupName(pattern: string, position: number): string {
  const suffix = ` #${position}`;
  return `${pattern.trim().slice(0, 25 - suffix.length).trim()}${suffix}`;
}

function requireTemplate(value: unknown, fallbackName: string): GroupTemplate {
  const input = isRecord(value) ? value : {};
  const namePattern = (str(input["namePattern"]) || fallbackName).slice(0, GROUP_LIMITS.maxNamePattern).trim();
  const description = str(input["description"]);
  if (description.length > GROUP_LIMITS.maxDescription) throw new ValidationError(`La descripción admite hasta ${GROUP_LIMITS.maxDescription} caracteres.`);
  const imageUrl = str(input["imageUrl"]) || null;
  if (imageUrl && !/^https?:\/\//.test(imageUrl)) throw new ValidationError("La foto del grupo no tiene una dirección válida.");
  return { namePattern, description, imageUrl, announce: input["announce"] !== false, locked: input["locked"] !== false };
}

function requireRules(value: unknown): CampaignRules {
  const input = isRecord(value) ? value : {};
  const welcome = isRecord(input["welcome"]) ? input["welcome"] : {};
  const text = str(welcome["text"]) || DEFAULT_WELCOME;
  if (text.length > GROUP_LIMITS.maxWelcome) throw new ValidationError(`La bienvenida admite hasta ${GROUP_LIMITS.maxWelcome} caracteres.`);
  const every = Number(welcome["everyMinutes"]);
  return {
    welcome: { enabled: welcome["enabled"] !== false, text, everyMinutes: (GROUP_LIMITS.welcomeEveryMinutes as ReadonlyArray<number>).includes(every) ? every : 15 },
    labelOnJoin: input["labelOnJoin"] !== false
  };
}

export function requireCampaignDraft(value: unknown): SaveCampaignRequest {
  if (!isRecord(value)) throw new ValidationError("La campaña no es válida.");
  const name = str(value["name"]).slice(0, 60);
  if (!name) throw new ValidationError("Ponle un nombre a la campaña.");
  const slug = (str(value["slug"]) || slugify(name)).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) throw new ValidationError("El enlace solo admite letras sin tildes, números y guiones (3 a 40).");
  const ids = Array.isArray(value["connectionIds"]) ? [...new Set(value["connectionIds"].filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
  if (ids.length === 0) throw new ValidationError("Elige el número que crea los grupos.");
  const capacity = value["capacity"] === undefined ? GROUP_LIMITS.defaultCapacity : Number(value["capacity"]);
  if (!Number.isInteger(capacity) || capacity < GROUP_LIMITS.minCapacity || capacity > GROUP_LIMITS.maxCapacity) {
    throw new ValidationError(`El cupo por grupo va de ${GROUP_LIMITS.minCapacity} a ${GROUP_LIMITS.maxCapacity}.`);
  }
  return { name, slug, connectionIds: ids, capacity, template: requireTemplate(value["template"], name), rules: requireRules(value["rules"]) };
}
