import type { PixelConnectionSummary } from "@contracts/PixelContracts";
import type { PixelConnectionsStatus } from "@shared/pixel-connections/usePixelConnections";
import type { AdsNavStatus } from "../components/AdsNav";

const plural = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count} ${many}`);

/**
 * Lo que dice la tarjeta «Píxel» de Meta Ads, pensando en cuentas con varios
 * píxeles: cuántos funcionan y cuántos rechazó Meta («2 activos · 1 rechazado»),
 * o que falta conectar el primero.
 */
export function pixelNavStatus(status: PixelConnectionsStatus, connections: ReadonlyArray<PixelConnectionSummary>): AdsNavStatus {
  if (status === "loading") return { tone: "idle", text: "Cargando…" };
  if (status === "error") return { tone: "warn", text: "No se pudo cargar" };
  if (status === "forbidden") return { tone: "idle", text: "Sin acceso" };
  if (status === "unavailable") return { tone: "warn", text: "No disponible" };

  const rejected = connections.filter((connection) => connection.status !== "active").length;
  const active = connections.length - rejected;
  if (rejected > 0 && active > 0) {
    return { tone: "warn", text: `${plural(active, "activo", "activos")} · ${plural(rejected, "rechazado", "rechazados")}` };
  }
  if (rejected > 0) return { tone: "warn", text: plural(rejected, "token rechazado", "tokens rechazados") };
  if (active === 0) return { tone: "idle", text: "Sin conectar" };
  return { tone: "ok", text: plural(active, "activo", "activos") };
}
