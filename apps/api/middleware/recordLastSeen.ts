import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import type { TeamServices } from "../../../domains/team/application/TeamServices";
import type { BackgroundTasks } from "../http/BackgroundTasks";

// ---------------------------------------------------------------------------
// «Última vez» de cada miembro: cada petición de una persona en una cuenta la
// anota, como mucho una vez por minuto por instancia (y la base vuelve a
// filtrar). Va después de responder (`background`) y un fallo no importa: la
// próxima petición lo intenta otra vez.
// ---------------------------------------------------------------------------

const EVERY_MS = 60_000;
const MAX_TRACKED = 5_000;
const lastTouched = new Map<string, number>();

export function recordLastSeen(
  team: TeamServices | undefined,
  background: BackgroundTasks | undefined,
  context: RequestContext,
  now: number = Date.now()
): void {
  if (!team || context.authMethod !== "jwt") return;
  const key = `${context.tenantId}:${context.actorId}`;
  if (now - (lastTouched.get(key) ?? 0) < EVERY_MS) return;
  if (lastTouched.size >= MAX_TRACKED) lastTouched.clear();
  lastTouched.set(key, now);

  const touch = () => team.touch({ tenantId: context.tenantId, userId: context.actorId }).catch(() => undefined);
  if (background) background.run(touch);
  else void touch();
}
