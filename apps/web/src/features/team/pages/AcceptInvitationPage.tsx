import "@shared/ui/controls/controls.css";
import "../components/team-role.css";
import "./accept-invitation.css";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { InvitationPreviewResponse } from "@contracts/TeamContracts";
import { AccountAvatar } from "@shared/account/AccountAvatar";
import { useAuth } from "@shared/auth/context/AuthContext";
import { activeTenantStore } from "@shared/auth/tenant/activeTenantStore";
import { useActiveTenantOptional } from "@shared/auth/tenant/ActiveTenantContext";
import { RequestError } from "@shared/http/RequestError";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { AuthLayout } from "@shared/ui/auth-layout/AuthLayout";
import { teamApi } from "../services/teamApi";

type Loaded = { readonly kind: "loading" | "missing" | "error" } | { readonly kind: "ready"; readonly preview: InvitationPreviewResponse };

const CLOSED = {
  expired: { title: "Esta invitación venció", text: "Las invitaciones duran 7 días. Pídele a quien te invitó un enlace nuevo." },
  revoked: { title: "Esta invitación fue cancelada", text: "Si todavía quieres unirte, pídele a quien te invitó un enlace nuevo." },
  accepted: { title: "Esta invitación ya se usó", text: "Si fuiste tú, entra a Auream y elige la empresa desde el menú de tu cuenta." }
} as const;

const goToApp = (
  <Link to="/" replace>
    Ir a Auream
  </Link>
);

/**
 * `/invite/:token` — lo que ve quien abre un enlace de invitación. Sin sesión:
 * crear la cuenta o entrar, y volver aquí. Con sesión: «Unirme», que entra a
 * la empresa sin crear un espacio propio vacío. Si entró con otro correo, se
 * lo decimos y puede cambiar de cuenta sin perder el enlace.
 */
export function AcceptInvitationPage() {
  const { token = "" } = useParams();
  const { state: auth, signOut } = useAuth();
  const navigate = useNavigate();
  const tenants = useActiveTenantOptional();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = { from: `/invite/${token}` };

  useEffect(() => {
    let alive = true;
    teamApi
      .preview(token)
      .then((preview) => alive && setLoaded({ kind: "ready", preview }))
      .catch((e: unknown) => alive && setLoaded({ kind: e instanceof RequestError && e.status === 404 ? "missing" : "error" }));
    return () => {
      alive = false;
    };
  }, [token]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const joined = await teamApi.accept(token);
      tenants?.selectTenant(joined.tenantId);
      navigate("/conversations", { replace: true });
      tenants?.reload();
    } catch (e) {
      setError(apiErrorMessage(e, "No pudimos unirte al equipo. Inténtalo de nuevo."));
      setJoining(false);
    }
  };

  const switchAccount = async () => {
    await signOut();
    activeTenantStore.clear();
    navigate("/login", { replace: true, state: back });
  };

  if (loaded.kind !== "ready") {
    const missing = loaded.kind === "missing";
    return (
      <AuthLayout
        title={loaded.kind === "loading" ? "Abriendo la invitación" : missing ? "Esta invitación no existe" : "No pudimos abrir la invitación"}
        subtitle={loaded.kind === "loading" ? "Un momento…" : missing ? "Revisa que el enlace esté completo o pide uno nuevo a quien te invitó." : "Parece un problema de conexión. Vuelve a intentarlo en unos segundos."}
        footer={goToApp}
      >
        {loaded.kind === "loading" ? <div className="invite-page__loading" aria-busy="true" /> : null}
      </AuthLayout>
    );
  }

  const { preview } = loaded;
  const role = TEAM_ROLE_INFO[preview.role];
  const company = (
    <div className="invite-page__company">
      <AccountAvatar name={preview.companyName} imageUrl={preview.companyLogoUrl} size={52} shape="square" />
      <div>
        <span className="invite-page__label">Empresa</span>
        <strong className="invite-page__name">{preview.companyName}</strong>
      </div>
    </div>
  );

  if (preview.status !== "pending") {
    const closed = CLOSED[preview.status];
    return (
      <AuthLayout title={closed.title} subtitle={closed.text} footer={goToApp}>
        <div className="invite-page">{company}</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Te invitaron a un equipo" subtitle={`${preview.inviterName ?? "Alguien"} te invitó a trabajar con su equipo en Auream.`} footer={goToApp}>
      <div className="invite-page">
        {company}
        <div className="invite-page__role">
          <span className={`team-role team-role--${role.tone}`}>{role.label}</span>
          <p>{role.description}</p>
        </div>
        <p className="invite-page__for">
          Para <strong>{preview.emailHint}</strong>: entra o crea tu cuenta con ese correo.
        </p>

        {error ? (
          <p className="invite-page__error" role="alert">
            {error}
          </p>
        ) : null}

        {auth.status === "authenticated" ? (
          <div className="invite-page__actions">
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => void join()} disabled={joining}>
              {joining ? "Uniéndote…" : `Unirme a ${preview.companyName}`}
            </button>
            {error ? (
              <button type="button" className="invite-page__switch" onClick={() => void switchAccount()}>
                Entrar con otra cuenta
              </button>
            ) : null}
          </div>
        ) : auth.status === "anonymous" ? (
          <div className="invite-page__actions">
            <Link className="ui-btn ui-btn--primary" to="/register" state={back}>
              Crear mi cuenta
            </Link>
            <Link className="ui-btn ui-btn--ghost" to="/login" state={back}>
              Ya tengo cuenta
            </Link>
          </div>
        ) : (
          <p className="ui-muted">Comprobando tu sesión…</p>
        )}
      </div>
    </AuthLayout>
  );
}
