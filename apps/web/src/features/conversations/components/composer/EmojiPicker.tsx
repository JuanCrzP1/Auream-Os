import { useEffect, useRef } from "react";
import { EMOJI_GROUPS } from "./emojis";

/**
 * Selector de emojis sobre el compositor. Inserta donde está el cursor y
 * sigue abierto para poner varios; se cierra con Escape o al tocar fuera.
 */
export function EmojiPicker({ onPick, onClose }: { readonly onPick: (emoji: string) => void; readonly onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!box.current?.contains(target) && !target.closest("[data-emoji-toggle]")) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);

  return (
    <div className="chat-popover chat-emoji" ref={box} role="dialog" aria-label="Emojis">
      {EMOJI_GROUPS.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="chat-popover__title">{group.label}</h3>
          <div className="chat-emoji__grid">
            {group.emojis.map((emoji, index) => (
              <button key={`${emoji}-${index}`} type="button" className="chat-emoji__item" aria-label={emoji} onClick={() => onPick(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
