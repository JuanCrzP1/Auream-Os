/**
 * El texto con `{nombre}` donde está el cursor (o reemplazando lo marcado), y
 * dónde queda el cursor después. Sin campo enfocado, al final. Puro.
 */
export function insertVariable(value: string, token: string, selection: { readonly start: number | null; readonly end: number | null } | null): { readonly value: string; readonly caret: number } {
  const start = selection?.start ?? value.length;
  const end = selection?.end ?? start;
  const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
  return { value: next, caret: start + token.length };
}

/** Pone el cursor después de lo insertado, cuando React ya pintó el valor nuevo. */
export function placeCaret(element: HTMLInputElement | HTMLTextAreaElement | null, caret: number): void {
  if (!element) return;
  requestAnimationFrame(() => {
    element.focus();
    // Algunos campos (correo, número) no dejan mover el cursor: basta el foco.
    try {
      element.setSelectionRange(caret, caret);
    } catch {
      /* sin cursor */
    }
  });
}
