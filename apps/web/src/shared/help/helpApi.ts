import type {
  ArticleDetail,
  ArticleSummary,
  CreateSupportCaseRequest,
  HelpHomeResponse,
  SaveTutorialRequest,
  SupportCase,
  SupportSettings,
  Tutorial
} from "@contracts/HelpContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

// Ayuda y soporte (`/help`): lo usan el Centro de ayuda y el panel «?» de cada pantalla.

const id = (value: string) => encodeURIComponent(value);

export const helpApi = {
  home: () => builderApiClient.get<HelpHomeResponse>("/help"),
  module: async (moduleId: string) => (await builderApiClient.get<{ articles: ArticleSummary[] }>(`/help/modules/${id(moduleId)}`)).articles,
  article: (slug: string) => builderApiClient.get<ArticleDetail>(`/help/articles/${id(slug)}`),
  search: async (query: string) => (await builderApiClient.get<{ results: ArticleSummary[] }>(`/help/search?q=${id(query)}`)).results,
  rate: (slug: string, helpful: boolean, comment: string | null) => builderApiClient.post<void>(`/help/articles/${id(slug)}/feedback`, { helpful, comment }),
  tutorials: async (all = false) => (await builderApiClient.get<{ tutorials: Tutorial[] }>(`/help/tutorials${all ? "?all=1" : ""}`)).tutorials,
  seen: (tutorialId: string) => builderApiClient.post<void>(`/help/tutorials/${id(tutorialId)}/seen`),
  saveTutorial: async (tutorialId: string | null, request: SaveTutorialRequest) =>
    (tutorialId ? await builderApiClient.put<{ tutorials: Tutorial[] }>(`/help/tutorials/${id(tutorialId)}`, request) : await builderApiClient.post<{ tutorials: Tutorial[] }>("/help/tutorials", request)).tutorials,
  removeTutorial: async (tutorialId: string) => (await builderApiClient.delete<{ tutorials: Tutorial[] }>(`/help/tutorials/${id(tutorialId)}`)).tutorials,
  reorder: async (ids: ReadonlyArray<string>) => (await builderApiClient.post<{ tutorials: Tutorial[] }>("/help/tutorials/order", { ids })).tutorials,
  support: () => builderApiClient.get<{ settings: SupportSettings; cases: SupportCase[] }>("/help/support"),
  openCase: async (request: CreateSupportCaseRequest) => (await builderApiClient.post<{ cases: SupportCase[] }>("/help/support/cases", request)).cases,
  allCases: async (status: string | null) => (await builderApiClient.get<{ cases: SupportCase[] }>(`/help/support/admin${status ? `?status=${status}` : ""}`)).cases,
  replyCase: (caseId: string, reply: string, status: SupportCase["status"]) => builderApiClient.post<void>(`/help/support/cases/${id(caseId)}/reply`, { reply, status }),
  saveSettings: (settings: SupportSettings) => builderApiClient.put<SupportSettings>("/help/support/settings", settings)
};
