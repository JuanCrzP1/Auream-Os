/**
 * FolderEmptyState — una carpeta que todavía no contiene nada.
 *
 * Distinto del estado vacío del hub: aquel ofrece crear una automatización o
 * explorar plantillas porque no hay nada en ninguna parte. Aquí sí las hay,
 * solo que ninguna está en esta carpeta, y lo único que falta es traerlas. Por
 * eso no repite acciones, solo explica el gesto que ya existe.
 */
export function FolderEmptyState() {
  return (
    <p className="hub-folder-empty">
      <strong>Esta carpeta está vacía</strong>
      Arrastra una automatización hasta aquí para guardarla dentro.
    </p>
  );
}
