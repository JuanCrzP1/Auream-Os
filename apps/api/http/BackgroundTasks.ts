import { waitUntil } from "@vercel/functions";

// ---------------------------------------------------------------------------
// Trabajo que sigue después de responder (p. ej. procesar un mensaje de
// WhatsApp: el proveedor pide responder enseguida y no repite avisos).
//
// En Vercel, `waitUntil` mantiene viva la función hasta que termina (dentro
// de `maxDuration`); en el servidor local la promesa simplemente continúa.
// Un fallo nunca tumba la respuesta: queda en el registro de errores.
// ---------------------------------------------------------------------------

export interface BackgroundTasks {
  run(task: () => Promise<unknown>): void;
}

export function createBackgroundTasks(onError: (error: unknown) => void): BackgroundTasks {
  const onVercel = Boolean(process.env["VERCEL"]);
  return {
    run(task) {
      const promise = Promise.resolve().then(task).catch(onError);
      if (onVercel) waitUntil(promise);
    }
  };
}
