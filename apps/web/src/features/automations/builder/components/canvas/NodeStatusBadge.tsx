import type { NodeReviewStatus } from "@features/automations/builder/services/reviewFlow";

/**
 * Marca en la esquina de un bloque con problemas: color por gravedad, número
 * de problemas y los motivos al pasar el ratón (y para lectores de pantalla).
 * La lista completa, con navegación, está en la revisión del flujo.
 */
export function NodeStatusBadge({ status }: { readonly status: NodeReviewStatus }) {
  const count = status.messages.length;
  const label = `${status.severity === "error" ? "Con errores" : "Por revisar"}: ${status.messages.join(" ")}`;

  return (
    <span
      className={`flow-node__status flow-node__status--${status.severity}`}
      role="img"
      aria-label={label}
      title={status.messages.join("\n")}
    >
      {count > 1 ? count : "!"}
    </span>
  );
}

/**
 * Pestaña de un bloque que ya se configura pero que el motor aún no ejecuta
 * (`executable: false`). No fingir funcionalidad: se dice en el propio bloque.
 */
export function NotExecutableTab() {
  return (
    <span className="flow-node__soon" title="Ya puedes configurarlo, pero todavía no se ejecuta con clientes.">
      Próximamente
    </span>
  );
}
