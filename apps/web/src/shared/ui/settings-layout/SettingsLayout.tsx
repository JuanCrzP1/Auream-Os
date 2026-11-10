import "../side-panel/side-panel.css";
import "./settings-layout.css";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

export interface SettingsNavItem {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly icon: ReactNode;
  /** Qué hay en la sección: el subtítulo de su encabezado. */
  readonly description: string;
  /** Llega más adelante: se ve en el menú con «Pronto». */
  readonly soon?: boolean;
}

export interface SettingsNavGroup {
  readonly title: string;
  readonly items: ReadonlyArray<SettingsNavItem>;
}

/**
 * Configuración a pantalla completa (como Linear o Vercel): la barra de la app
 * se esconde, a la izquierda queda el menú de Configuración por grupos (tu
 * cuenta, la empresa) y arriba «Volver a Auream», que regresa a donde estabas.
 * Las secciones las arma la app: este marco no conoce ningún módulo.
 */
export function SettingsLayout({
  groups,
  current,
  backTo,
  children
}: {
  readonly groups: ReadonlyArray<SettingsNavGroup>;
  readonly current: SettingsNavItem;
  readonly backTo: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="settings-shell">
      <nav className="settings-nav ui-side-panel" aria-label="Configuración">
        <Link className="settings-nav__back" to={backTo}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Volver a Auream
        </Link>
        <p className="settings-nav__title">Configuración</p>

        {groups.map((group) => (
          <div key={group.title} className="settings-nav__group">
            <p className="settings-nav__group-title">{group.title}</p>
            <ul className="settings-nav__list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavLink to={item.path} className="settings-nav__item" aria-current={item.id === current.id ? "page" : undefined}>
                    <span className="settings-nav__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="settings-nav__label">{item.label}</span>
                    {item.soon ? <span className="settings-nav__soon">Pronto</span> : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <main className="settings-main">
        <header className="settings-main__head">
          <h1 className="settings-main__title">{current.label}</h1>
          <p className="settings-main__description">{current.description}</p>
        </header>
        <div className="settings-main__body">{children}</div>
      </main>
    </div>
  );
}
