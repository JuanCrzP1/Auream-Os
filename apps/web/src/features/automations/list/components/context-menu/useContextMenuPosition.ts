import { useLayoutEffect, useState } from "react";

export function useContextMenuPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
  offset = 8
) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const t = trigger.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    // Default: place below trigger, left-aligned
    let top = Math.round(t.bottom + offset);
    let left = Math.round(t.left);

    // If overflowing right, clamp to viewport
    if (left + m.width + offset > vw) {
      left = Math.max(offset, vw - m.width - offset);
    }

    // If overflowing bottom, try place above trigger
    if (top + m.height + offset > vh) {
      top = Math.round(t.top - m.height - offset);
      if (top < offset) top = offset;
    }

    setPos({ top, left });
  }, [triggerRef, menuRef, offset]);

  return pos;
}
