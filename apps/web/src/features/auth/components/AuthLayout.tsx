import type { ReactNode } from "react";
import { ThemeToggleButton } from "@shared/theme/components/ThemeToggleButton";
import { AuthHero } from "./AuthHero";
import "../styles/auth-page.css";

interface Props {
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}

/**
 * Marco visual compartido por las pantallas de autenticación.
 *
 * Reparte la pantalla en dos: la marca a un lado y el formulario al otro. Por
 * debajo de 940px pasa a una sola columna, con la marca reducida a cabecera.
 *
 * Sigue sin conocer qué formulario contiene: recibe título, subtítulo y
 * contenido, igual que antes.
 */
export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <main className="auth-page">
      <div className="auth-page__ambient" aria-hidden="true" />
      <ThemeToggleButton className="auth-page__theme-toggle" />

      <div className="auth-page__stage">
        <AuthHero />

        <section className="auth-page__panel">
          <header className="auth-page__header">
            <h1 className="auth-page__title">{title}</h1>
            <p className="auth-page__subtitle">{subtitle}</p>
          </header>

          {children}

          <footer className="auth-page__footer">{footer}</footer>
        </section>
      </div>
    </main>
  );
}
