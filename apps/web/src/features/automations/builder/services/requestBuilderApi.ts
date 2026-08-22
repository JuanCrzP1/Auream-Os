import { builderApiClient } from "@shared/http/builderApiClient";

/**
 * requestBuilderApi — adaptador de compatibilidad hacia HttpClient.
 *
 * Mantiene la firma original (path + RequestInit opcional) para que
 * los servicios existentes no necesiten cambios masivos.
 * Internamente delega en builderApiClient (HttpClient).
 */
export async function requestBuilderApi<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";

  if (method === "POST") {
    const body = init?.body ? (JSON.parse(init.body as string) as unknown) : undefined;
    return builderApiClient.post<T>(path, body);
  }

  if (method === "PUT") {
    const body = init?.body ? (JSON.parse(init.body as string) as unknown) : undefined;
    return builderApiClient.put<T>(path, body);
  }

  return builderApiClient.get<T>(path);
}
