import { useEffect, useState, type RefObject } from "react";

/**
 * La sección que se está leyendo (para resaltarla en «En este artículo»):
 * la última cuyo título ya pasó por el tercio de arriba de la pantalla.
 */
export function useActiveSection(ids: ReadonlyArray<string>, root: RefObject<HTMLElement>): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");

  useEffect(() => {
    setActive(ids[0] ?? null);
    const scroller = root.current;
    if (!scroller || ids.length === 0) return;
    const update = () => {
      const limit = scroller.getBoundingClientRect().top + scroller.clientHeight / 3;
      let current = ids[0];
      for (const id of ids) {
        const heading = document.getElementById(id);
        if (heading && heading.getBoundingClientRect().top <= limit) current = id;
      }
      const atBottom = scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      setActive(atBottom ? ids[ids.length - 1] : current);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, root]);

  return active;
}
