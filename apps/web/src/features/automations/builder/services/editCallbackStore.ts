type EditCallback = ((id: string | null) => void) | null;

let _cb: EditCallback = null;

export function setEditCallback(fn: EditCallback): void {
  _cb = fn;
}

export function triggerEdit(id: string): void {
  _cb?.(id);
}
