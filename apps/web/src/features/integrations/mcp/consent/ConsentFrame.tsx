import type { ReactNode } from "react";
import { AureamLockup } from "@shared/brand/AureamLockup";
import "./oauth-consent.css";

/** El marco de la autorización: pantalla suelta con la marca (o la cabecera dada), como el inicio de sesión. */
export function ConsentFrame({ children, header, busy = false }: { readonly children: ReactNode; readonly header?: ReactNode; readonly busy?: boolean }) {
  return (
    <main className="oauth-consent">
      <div className="oauth-consent__ambient" aria-hidden="true" />
      <section className="oauth-consent__card" aria-busy={busy}>
        {header ?? (
          <div className="oauth-consent__brand">
            <AureamLockup size="sm" />
          </div>
        )}
        {children}
      </section>
    </main>
  );
}
