/** Headers HTTP estándar como constantes tipadas. */
export const HttpHeader = {
  ContentType: "Content-Type",
  Authorization: "Authorization",
  XApiKey: "X-Api-Key",
  XTenantId: "X-Tenant-Id"
} as const;

export const MimeType = {
  Json: "application/json"
} as const;

export type HttpHeadersInit = Record<string, string>;
