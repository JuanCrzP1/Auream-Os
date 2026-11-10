// La última pantalla de trabajo donde estuvo la persona (Conversaciones, un
// flujo…), para que «Volver a Auream» desde Configuración la lleve ahí y no a
// un inicio genérico. Vive en la pestaña (sessionStorage): si el navegador no
// deja guardarla, se vuelve al inicio y nada se rompe.

const KEY = "auream:last-app-location";
const HOME = "/";

export function rememberAppLocation(path: string): void {
  try {
    window.sessionStorage.setItem(KEY, path);
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): se volverá al inicio.
  }
}

export function lastAppLocation(): string {
  try {
    const path = window.sessionStorage.getItem(KEY);
    return path && path.startsWith("/") && !path.startsWith("/settings") ? path : HOME;
  } catch {
    return HOME;
  }
}
