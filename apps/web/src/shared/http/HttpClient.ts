import { RequestError } from "./RequestError";
import { HttpHeader, MimeType, type HttpHeadersInit } from "./HttpHeaders";

export interface HttpClientConfig {
  /** URL base aplicada a todas las rutas (sin slash final). */
  baseUrl: string;
  /**
   * Función que devuelve los headers por defecto en cada request.
   * Se llama en tiempo de request para poder refrescar tokens dinámicamente.
   */
  defaultHeaders: () => HttpHeadersInit;
}

/**
 * HttpClient — cliente HTTP centralizado.
 *
 * Reglas de uso:
 *  - Componentes NUNCA llaman fetch() directamente.
 *  - Hooks NUNCA llaman fetch() directamente.
 *  - Toda comunicación HTTP pasa por una instancia de HttpClient.
 *
 * Responsabilidades:
 *  - Construir URL completa (baseUrl + path)
 *  - Inyectar headers de autenticación y Content-Type
 *  - Mapear respuestas no-2xx a RequestError tipados
 *  - Deserializar JSON
 */
export class HttpClient {
  public constructor(private readonly config: HttpClientConfig) {}

  public async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: "GET", signal });
  }

  public async post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal
    });
  }

  public async put<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal
    });
  }

  public async patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal
    });
  }

  public async delete<T = void>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: "DELETE", signal });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers: HttpHeadersInit = { ...this.config.defaultHeaders() };

    if (init.body !== undefined) {
      headers[HttpHeader.ContentType] = MimeType.Json;
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers
    });

    if (!response.ok) {
      const body = await response.text();
      throw new RequestError(response.status, body);
    }

    // 204 No Content — retornar void/undefined sin intentar parsear JSON vacío
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
