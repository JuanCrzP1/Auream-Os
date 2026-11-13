import "./legal-links.css";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------------
// Las páginas legales públicas y sus enlaces. Las direcciones van en la app
// de Meta (política de privacidad, términos, eliminación de datos): no cambiarlas.
// ---------------------------------------------------------------------------

export const LEGAL_LINKS = {
  privacy: { path: "/privacidad", label: "Privacidad" },
  terms: { path: "/terminos", label: "Términos" },
  deletion: { path: "/eliminar-datos", label: "Eliminación de datos" }
} as const;

/** Enlaces a las tres páginas legales (pie de iniciar sesión y registrarse). */
export function LegalLinks() {
  return (
    <nav className="auth-legal" aria-label="Información legal">
      {Object.values(LEGAL_LINKS).map((link) => (
        <Link key={link.path} to={link.path}>{link.label}</Link>
      ))}
    </nav>
  );
}

/** Al crear la cuenta se aceptan los términos y la política de privacidad. */
export function ConsentNotice() {
  return (
    <p className="auth-consent">
      Al crear tu cuenta aceptas los <Link to={LEGAL_LINKS.terms.path}>Términos y condiciones</Link> y la{" "}
      <Link to={LEGAL_LINKS.privacy.path}>Política de privacidad</Link>, incluida la transferencia de datos a servidores fuera de Colombia.
    </p>
  );
}
