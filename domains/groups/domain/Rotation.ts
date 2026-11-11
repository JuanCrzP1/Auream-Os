import { GROUP_LIMITS, type GroupState } from "../../../contracts/GroupContracts";

// ---------------------------------------------------------------------------
// A qué grupo lleva el enlace de una campaña, y cuándo preparar el siguiente.
//
//   open     recibe gente (el de menor número con cupo)
//   standby  ya creado, espera a que se llene el anterior
//   full     llegó al cupo
//
// El siguiente se crea al llegar al 90 % del cupo: cuando el actual se llena,
// el enlace ya tiene a dónde llevar sin hacer esperar a nadie.
// ---------------------------------------------------------------------------

export interface RotatingGroup {
  readonly id: string;
  readonly position: number;
  readonly members: number;
  readonly state: GroupState;
  readonly inviteLink: string | null;
}

/** El grupo al que lleva el enlace ahora; `null` si no hay ninguno con cupo y enlace. */
export function currentGroup<T extends RotatingGroup>(groups: ReadonlyArray<T>, capacity: number): T | null {
  return (
    [...groups]
      .filter((group) => group.state !== "other" && group.inviteLink && group.members < capacity)
      .sort((a, b) => a.position - b.position)[0] ?? null
  );
}

/** ¿Hay que crear el grupo siguiente? (no hay uno en espera y el actual va por el 90 %). */
export function needsNextGroup(groups: ReadonlyArray<RotatingGroup>, capacity: number): boolean {
  const waiting = groups.filter((group) => group.state !== "other" && group.inviteLink && group.members < capacity);
  if (waiting.length === 0) return true;
  if (waiting.length > 1) return false;
  return waiting[0]!.members >= Math.floor(capacity * GROUP_LIMITS.prepareAt);
}

export function nextPosition(groups: ReadonlyArray<Pick<RotatingGroup, "position">>): number {
  return groups.reduce((max, group) => Math.max(max, group.position), 0) + 1;
}

/** El estado de cada grupo de la campaña según sus miembros. */
export function stateOf(group: Pick<RotatingGroup, "members" | "position">, current: Pick<RotatingGroup, "position"> | null, capacity: number): GroupState {
  if (group.members >= capacity) return "full";
  if (!current || group.position <= current.position) return "open";
  return "standby";
}

/** El número que crea el grupo `position`: por turnos entre los de la campaña. */
export function connectionFor(connectionIds: ReadonlyArray<string>, position: number): string {
  return connectionIds[(position - 1) % connectionIds.length]!;
}
