/**
 * Guarda un archivo bajado de la API en el equipo (la descarga normal del
 * navegador). El enlace temporal se libera enseguida para no dejar memoria
 * tomada.
 */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
