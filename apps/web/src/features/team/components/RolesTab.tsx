import "./team-role.css";
import "./roles-tab.css";
import { TEAM_ROLES, type TeamRole } from "@contracts/TeamContracts";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";

type Access = "all" | "edit" | "record" | "view" | "none" | "most";

const LABEL: Readonly<Record<Access, string>> = { all: "Todo", edit: "Editar", record: "Anotar", view: "Ver", none: "Sin acceso", most: "Menos dueños" };

/**
 * Qué puede hacer cada rol, por área. Refleja los permisos del servidor
 * (`ROLE_SCOPES` y `TeamPolicy`): si cambian allá, se actualiza aquí.
 */
const AREAS: ReadonlyArray<{ readonly area: string; readonly access: Readonly<Record<TeamRole, Access>> }> = [
  { area: "Conversaciones y contactos", access: { tenant_owner: "all", tenant_admin: "all", operator: "all", viewer: "view" } },
  { area: "Automatizaciones", access: { tenant_owner: "edit", tenant_admin: "edit", operator: "view", viewer: "view" } },
  { area: "Ventas y productos", access: { tenant_owner: "all", tenant_admin: "all", operator: "record", viewer: "view" } },
  { area: "Conexiones de WhatsApp", access: { tenant_owner: "all", tenant_admin: "all", operator: "view", viewer: "view" } },
  { area: "Integraciones (claves de IA, píxeles)", access: { tenant_owner: "all", tenant_admin: "all", operator: "none", viewer: "none" } },
  { area: "Equipo", access: { tenant_owner: "all", tenant_admin: "most", operator: "view", viewer: "view" } },
  { area: "Datos de la empresa", access: { tenant_owner: "all", tenant_admin: "view", operator: "view", viewer: "view" } }
];

/** Roles: una tarjeta por rol, con lo que puede hacer en cada área. */
export function RolesTab() {
  return (
    <div className="roles-tab">
      <div className="roles-tab__grid">
        {TEAM_ROLES.map((role) => {
          const info = TEAM_ROLE_INFO[role];
          return (
            <article key={role} className={`role-card role-card--${info.tone}`} aria-label={info.label}>
              <header className="role-card__head">
                <span className={`team-role team-role--${info.tone}`}>{info.label}</span>
              </header>
              <p className="role-card__description">{info.description}</p>
              <ul className="role-card__list">
                {AREAS.map(({ area, access }) => (
                  <li key={area} className={`role-card__item role-card__item--${access[role]}`}>
                    <span className="role-card__mark" aria-hidden="true">
                      {access[role] === "none" ? "—" : access[role] === "view" ? "◦" : "✓"}
                    </span>
                    <span className="role-card__area">{area}</span>
                    <span className="role-card__access">{LABEL[access[role]]}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <p className="roles-tab__note">Siempre queda al menos un dueño. Nadie cambia su propio rol, y quitar a alguien le corta el acceso al instante.</p>
    </div>
  );
}
