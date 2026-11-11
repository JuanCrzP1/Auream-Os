import type { CampaignRepository, GroupGateway, GroupLabeler, GroupRepository, GroupResults, GroupTicker, NumberDirectory, PostRepository } from "./GroupPorts";

// Todo lo que usan los servicios de Grupos (una sola bolsa para no repetir
// diez parámetros en cada uno).
export interface GroupEngine {
  readonly campaigns: CampaignRepository;
  readonly groups: GroupRepository;
  readonly posts: PostRepository;
  readonly results: GroupResults;
  readonly gateway: GroupGateway;
  readonly numbers: NumberDirectory;
  readonly labeler: GroupLabeler;
  readonly ticker: GroupTicker;
  readonly timezoneOf: (tenantId: string) => Promise<string>;
  readonly now: () => Date;
  readonly random: () => number;
  readonly newId: () => string;
  /** `https://<dominio>/g`: delante del `slug` de cada campaña. */
  readonly linkBase: string;
}
