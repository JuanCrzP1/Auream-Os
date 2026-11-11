import { HELP_MODULES, type HelpModuleId } from "@contracts/HelpContracts";

/** El módulo de ayuda de la pantalla en que está la persona (`/broadcasts` → difusiones). */
export function moduleForPath(pathname: string): HelpModuleId {
  if (pathname.startsWith("/meta-ads")) return "dashboard";
  if (pathname.startsWith("/settings") || pathname.startsWith("/team") || pathname.startsWith("/profile")) return "equipo";
  if (pathname.startsWith("/contacts")) return "crm";
  return HELP_MODULES.find((m) => m.path && pathname.startsWith(m.path))?.id ?? "primeros-pasos";
}

/** «Escribir por WhatsApp» a soporte, con un primer mensaje que dice desde dónde. */
export function whatsappLink(number: string, page: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hola, necesito ayuda con Auream (desde ${page}).`)}`;
}
