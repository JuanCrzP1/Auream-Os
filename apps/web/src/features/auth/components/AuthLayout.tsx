import type { ReactNode } from "react";
import { ThemeToggleButton } from "@shared/theme/components/ThemeToggleButton";
import "../styles/auth-page.css";

interface Props {
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}

/** Marco visual compartido por las pantallas de autenticación. */
export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <main className="auth-page">
      <ThemeToggleButton className="auth-page__theme-toggle" />

      <section className="auth-page__panel">
        <header className="auth-page__header">
          <h1 className="auth-page__title">{title}</h1>
          <p className="auth-page__subtitle">{subtitle}</p>
        </header>

        {children}

        <footer className="auth-page__footer">{footer}</footer>
      </section>
    </main>
  );
}
