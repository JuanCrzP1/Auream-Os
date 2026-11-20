// ---------------------------------------------------------------------------
// ¿Es la dirección de un servicio de avisos real? El servidor le manda los
// avisos a la dirección que entrega el navegador: si se aceptara cualquiera,
// alguien podría usar a Auream para llamar direcciones internas (SSRF). Solo
// los servicios de Google (Chrome, Edge, Android), Mozilla (Firefox), Apple
// (Safari) y Microsoft (Windows). Puro.
// ---------------------------------------------------------------------------

const EXACT = new Set(["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
const SUFFIXES = [".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];

export function isPushServiceEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return EXACT.has(host) || SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** «Chrome en Mac»: lo que manda la web, limpio y corto. */
export function deviceLabel(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) : "";
}
