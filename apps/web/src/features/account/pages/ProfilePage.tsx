import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/account-pages.css";
import { useState } from "react";
import { useAccount } from "@shared/account/AccountContext";
import { removeProfilePhoto, uploadProfilePhoto } from "@shared/account/accountApi";
import { ImagePicker } from "../components/ImagePicker";
import { PersonalDataForm } from "../components/PersonalDataForm";
import { EmailSection } from "../components/EmailSection";
import { PasswordForm } from "../components/PasswordForm";

type Tab = "personal" | "security";

/**
 * Mi perfil: tu foto, tus datos (nombre y WhatsApp personal, guardados en tu
 * perfil), tu correo de acceso y tu contraseña. Es tuyo en todas las empresas
 * a las que perteneces.
 */
export function ProfilePage() {
  const { profile, displayName, email, setProfile } = useAccount();
  const [tab, setTab] = useState<Tab>("personal");

  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Mi perfil</h1>
          <p className="ui-page__subtitle">Tu foto, tus datos personales y la seguridad de tu cuenta.</p>
        </div>
      </header>

      <nav className="ui-tabs" role="tablist" aria-label="Secciones">
        <button type="button" role="tab" aria-selected={tab === "personal"} className="ui-tab" onClick={() => setTab("personal")}>
          Datos personales
        </button>
        <button type="button" role="tab" aria-selected={tab === "security"} className="ui-tab" onClick={() => setTab("security")}>
          Seguridad
        </button>
      </nav>

      <div className="ui-panel">
        <div className="account-page__body">
          {tab === "personal" ? (
            <>
              <section className="account-hero" aria-label="Foto de perfil">
                <ImagePicker
                  name={displayName}
                  imageUrl={profile?.photoUrl ?? null}
                  label="foto"
                  onUpload={async (file, onProgress) => setProfile(await uploadProfilePhoto(file, onProgress))}
                  onRemove={async () => setProfile(await removeProfilePhoto())}
                />
                <div className="account-hero__who">
                  <h2 className="account-hero__name">{displayName}</h2>
                  <span className="account-hero__meta">{email}</span>
                </div>
              </section>
              <PersonalDataForm />
              <EmailSection />
            </>
          ) : (
            <PasswordForm />
          )}
        </div>
      </div>
    </div>
  );
}
