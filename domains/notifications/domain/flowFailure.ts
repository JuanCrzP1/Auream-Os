// ---------------------------------------------------------------------------
// Lo que falló en un turno de flujo, dicho para el dueño del negocio.
//
// Los bloques no detienen el flujo cuando algo externo falla (un Píxel, una
// Integración, la IA, Registrar venta): siguen por su salida y dejan un evento
// `<bloque>_failed:<id del bloque>:<motivo>` en el historial interno de turnos
// (`flow_turn_log`). Sin este aviso, esa falla pasaría en silencio.
// ---------------------------------------------------------------------------

export interface FlowFailure {
  /** El primer evento `…_failed:…` del turno (o null). */
  readonly event: string | null;
  /** El turno se detuvo por un error interno. */
  readonly error: string | null;
  /** Mensajes del flujo que WhatsApp no aceptó. */
  readonly sendFailures: number;
}

const BLOCK: Readonly<Record<string, string>> = {
  pixel: "El Píxel no envió el evento a Meta",
  integration: "La Integración falló",
  ai: "La Extensión IA no respondió",
  sale: "Registrar venta no guardó la venta",
  edge_selection: "El flujo no supo por dónde seguir"
};

const REASON: Readonly<Record<string, string>> = {
  not_configured: "el bloque no tiene píxel elegido",
  connection_not_found: "el píxel elegido ya no existe",
  invalid_token: "el token ya no sirve; vuelve a guardarlo",
  pixel_not_found: "Meta no encuentra ese píxel",
  credential_not_found: "falta la clave de IA en Integraciones",
  invalid_key: "la clave no sirve; revísala en Integraciones",
  quota_exceeded: "se acabó el saldo o el cupo del servicio",
  rate_limited: "el servicio pidió esperar (demasiadas peticiones)",
  timeout: "el servicio tardó demasiado en responder",
  network_error: "no se pudo llegar al servicio",
  http_error: "el servicio respondió con un error",
  blocked_destination: "la dirección no está permitida",
  invalid_url: "la dirección no es válida",
  provider_error: "el servicio respondió con un error",
  unavailable: "el servicio no está disponible"
};

/** «El Píxel no envió el evento a Meta: el bloque no tiene píxel elegido.» */
export function describeFlowFailure(failure: FlowFailure): string {
  if (failure.event) {
    const [kind = "", , reason = ""] = failure.event.split(":");
    const block = BLOCK[kind.replace(/_failed$/, "")] ?? "Un bloque falló";
    const why = REASON[reason];
    return why ? `${block}: ${why}.` : `${block}.`;
  }
  if (failure.sendFailures > 0) return failure.sendFailures === 1 ? "WhatsApp no aceptó un mensaje del flujo." : `WhatsApp no aceptó ${failure.sendFailures} mensajes del flujo.`;
  return "El flujo se detuvo por un error interno.";
}
