import { getAuthBaseUrl } from "./getAuthBaseUrl";

/**
 * Llamadas al servicio de identidad.
 *
 * Responsabilidad única: hablar con Neon Auth. `credentials: "include"` es
 * imprescindible porque la sesión vive en una cookie de ese dominio — es el
 * mecanismo del propio proveedor, no un sistema de tokens paralelo.
 */
export class AuthRequestError extends Error {
  public constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AuthRequestError";
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? "No se pudo completar la operación";
  } catch {
    return "No se pudo completar la operación";
  }
}

export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getAuthBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new AuthRequestError(response.status, await readErrorMessage(response));
  }

  return (await response.json()) as T;
}
