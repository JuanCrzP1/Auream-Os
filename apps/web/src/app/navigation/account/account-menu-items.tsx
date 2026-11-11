import type { ReactElement } from "react";
import { SIDEBAR_ROUTES } from "../sidebar/sidebar-routes";
import { SidebarIcons } from "../sidebar/sidebar-icons";
import { SETTINGS_ROUTES } from "@app/settings/settings-sections";

/**
 * account-menu-items — lo que ofrece el menú de la cuenta (la tarjeta de abajo
 * en la barra lateral), en el orden estándar de las apps con barra lateral:
 * primero la persona, luego la empresa y su administración, después las
 * preferencias y la ayuda, y al final cerrar sesión.
 *
 * `soon`: la opción ya se ve (para conocer el menú completo) pero su módulo
 * llega más adelante; abre una página «Próximamente».
 */

export interface AccountMenuLink {
  readonly label: string;
  readonly hint?: string;
  readonly path: string;
  readonly icon: ReactElement;
  readonly soon?: boolean;
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const AccountMenuIcons = {
  system: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
  signOut: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" {...STROKE} strokeWidth={2}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" {...STROKE} strokeWidth={2.2}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
} as const;

/** Tu cuenta y tu empresa. Los datos de la empresa se abren también desde su tarjeta, arriba del menú. */
export const accountMenuLinks: ReadonlyArray<AccountMenuLink> = [
  { label: "Mi perfil", hint: "Tu foto, tus datos y tu contraseña", path: SETTINGS_ROUTES.profile, icon: SidebarIcons.profile },
  { label: "Configuración", hint: "Empresa, equipo, apariencia y más", path: SETTINGS_ROUTES.general, icon: SidebarIcons.settings }
];

/** Después de las preferencias. */
export const accountHelpLink: AccountMenuLink = {
  label: "Ayuda",
  hint: "Guías, novedades y soporte",
  path: SIDEBAR_ROUTES.help,
  icon: SidebarIcons.help
};
