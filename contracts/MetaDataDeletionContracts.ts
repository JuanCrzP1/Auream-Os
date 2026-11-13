// ---------------------------------------------------------------------------
// Borrado de datos pedido desde Facebook (Configuración → Apps y sitios web →
// quitar Auream y borrar la actividad). Meta llama a la API con un aviso
// firmado; Auream borra lo que tenía ligado a esa persona y responde con un
// código. Cualquiera con el código puede ver cómo quedó su solicitud
// (`GET /meta/data-deletion/:code`), sin datos personales.
// ---------------------------------------------------------------------------

/** Lo que Meta espera como respuesta: dónde ver el estado y el código. */
export interface MetaDataDeletionReceipt {
  readonly url: string;
  readonly confirmation_code: string;
}

export interface MetaDataDeletionStatus {
  readonly code: string;
  /** Se procesa al recibirla: siempre «completada». */
  readonly status: "completed";
  readonly requestedAt: string;
  /** Conexiones de Meta Ads (con su token y sus cuentas) que se borraron. 0: no había nada ligado a esa persona. */
  readonly deletedConnections: number;
}
