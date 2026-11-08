/**
 * Pestaña de un bloque que ya se configura pero que el motor aún no ejecuta
 * (`executable: false`). No fingir funcionalidad: se dice en el propio bloque.
 *
 * Los problemas del flujo NO se marcan bloque a bloque (saturaba el lienzo):
 * viven en la revisión del flujo, que lleva a cada bloque.
 */
export function NotExecutableTab() {
  return (
    <span className="flow-node__soon" title="Ya puedes configurarlo, pero todavía no se ejecuta con clientes.">
      Próximamente
    </span>
  );
}
