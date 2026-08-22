import { useEffect } from "react";

/**
 * Referencia que este hook necesita: sólo lee `current`.
 *
 * Declararlo `readonly` lo hace covariante, de modo que cualquier
 * `RefObject<HTMLUListElement | null>`, `RefObject<HTMLButtonElement | null>`,
 * etc. encaja sin casts. `RefObject<HTMLElement | null>` no serviría: al ser
 * `current` mutable, el tipo es invariante y obligaba a un `as any`.
 */
export interface ClickOutsideRef {
  readonly current: Node | null;
}

export function useClickOutside(
  refs: ReadonlyArray<ClickOutsideRef>,
  handler: (e: Event) => void
) {
  useEffect(() => {
    function onPointerDown(e: Event) {
      const target = e.target as Node | null;
      const inside = refs.some((r) => r.current && target && (r.current === target || r.current.contains(target)));
      if (!inside) handler(e);
    }

    // Use pointerdown capture to detect outside clicks reliably
    document.addEventListener("pointerdown", onPointerDown, true);

    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [refs, handler]);
}
