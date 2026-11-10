import "./team-role.css";
import "./roles-guide.css";
import { TEAM_ROLES, type TeamRole } from "@contracts/TeamContracts";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";

type Access = "all" | "edit" | "view" | "none" | "most";

const LABEL: Readonly<Record<Access, string>> = { all: "Todo", edit: "Editar", view: "Ver", none: "—", most: "Menos dueños" };

/**
 * Qué puede hacer cada rol, por área. Refleja los permisos del servidor
 * (`ROLE_SCOPES` y `TeamPolicy`): si cambian allá, se actualiza aquí.
 */
const AREAS: ReadonlyArray<{ readonly area: string; readonly access: Readonly<Record<TeamRole, Access>> }> = [
  { area: "Conversaciones y contactos", access: { tenant_owner: "all", tenant_admin: "all", operator: "all", viewer: "view" } },
  { area: "Automatizaciones", access: { tenant_owner: "edit", tenant_admin: "edit", operator: "view", viewer: "view" } },
  { area: "Conexiones de WhatsApp", access: { tenant_owner: "all", tenant_admin: "all", operator: "view", viewer: "view" } },
  { area: "Integraciones (claves de IA, píxeles)", access: { tenant_owner: "all", tenant_admin: "all", operator: "none", viewer: "none" } },
  { area: "Equipo", access: { tenant_owner: "all", tenant_admin: "most", operator: "view", viewer: "view" } },
  { area: "Datos de la empresa", access: { tenant_owner: "all", tenant_admin: "view", operator: "view", viewer: "view" } }
];

/** «¿Qué puede hacer cada rol?»: desplegable con la tabla de permisos. */
export function RolesGuide() {
  return (
    <details className="roles-guide">
      <summary className="roles-guide__summary">¿Qué puede hacer cada rol?</summary>
      <div className="roles-guide__scroll">
        <table className="roles-guide__table">
          <thead>
            <tr>
              <th scope="col">Área</th>
              {TEAM_ROLES.map((role) => (
                <th key={role} scope="col">
                  <span className={`team-role team-role--${TEAM_ROLE_INFO[role].tone}`}>{TEAM_ROLE_INFO[role].label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AREAS.map(({ area, access }) => (
              <tr key={area}>
                <th scope="row">{area}</th>
                {TEAM_ROLES.map((role) => (
                  <td key={role} className={`roles-guide__cell roles-guide__cell--${access[role]}`}>
                    {LABEL[access[role]]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="roles-guide__note">Siempre queda al menos un dueño. Nadie cambia su propio rol, y quitar a alguien le corta el acceso al instante.</p>
    </details>
  );
}
