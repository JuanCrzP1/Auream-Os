import type { NotificationFeed } from "@contracts/NotificationContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

// La campana del menú (`/notifications`).
export const notificationsApi = {
  feed: () => builderApiClient.get<NotificationFeed>("/notifications"),
  markSeen: () => builderApiClient.post<void>("/notifications/seen")
};
