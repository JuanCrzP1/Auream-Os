import { useState } from "react";

/** Copia un texto y avisa «Copiado» un momento. */
export function CopyButton({ text, label = "Copiar", className = "ui-btn ui-btn--ghost" }: { readonly text: string; readonly label?: string; readonly className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2_000);
          })
          .catch(() => setCopied(false))
      }
    >
      {copied ? "Copiado" : label}
    </button>
  );
}
