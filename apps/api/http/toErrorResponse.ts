// ---------------------------------------------------------------------------
// toErrorResponse
//
// Responsabilidad única: traducir un error desconocido en un par
// (statusCode, message) apto para responder al cliente.
// ---------------------------------------------------------------------------

export interface ErrorResponse {
  readonly statusCode: number;
  readonly message: string;
}

function readStatusCode(error: unknown): number {
  if (
    error != null &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }

  return 500;
}

export function toErrorResponse(error: unknown): ErrorResponse {
  const statusCode = readStatusCode(error);

  // Un 500 no expone el mensaje interno: podría filtrar rutas o detalles del stack.
  if (statusCode >= 500) {
    return { statusCode, message: "Internal server error" };
  }

  return {
    statusCode,
    message: error instanceof Error ? error.message : "Unexpected error"
  };
}
