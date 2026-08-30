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
    message: string,
    /** Código del proveedor (`INVALID_EMAIL_OR_PASSWORD`, ...) si vino en el
     *  cuerpo. Es lo que permite distinguir dos fallos con el mismo status. */
    public readonly code: string | null = null
  ) {
    super(message);
    this.name = "AuthRequestError";
  }
}

interface ErrorBody {
  readonly message?: string;
  readonly code?: string;
}

async function readError(response: Response): Promise<AuthRequestError> {
  try {
    const body = (await response.json()) as ErrorBody;
    return new AuthRequestError(
      response.status,
      body.message ?? "No se pudo completar la operación",
      body.code ?? null
    );
  } catch {
    // Sin cuerpo legible sólo queda el status: se conserva y el código queda
    // en null, que el traductor de mensajes trata como error desconocido.
    return new AuthRequestError(response.status, "No se pudo completar la operación");
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
    throw await readError(response);
  }

  return (await response.json()) as T;
}
