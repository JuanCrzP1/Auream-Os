import "@shared/ui/controls/controls.css";
import "./account-pages.css";
import { useAccount } from "@shared/account/AccountContext";
import { removeProfilePhoto, uploadProfilePhoto } from "@shared/account/accountApi";
import { EmailSection } from "./EmailSection";
import { ImagePicker } from "./ImagePicker";
import { PasswordForm } from "./PasswordForm";
import { PersonalDataForm } from "./PersonalDataForm";

/**
 * Configuración → Mi perfil: tu foto, tus datos (nombre y WhatsApp personal),
 * tu correo de acceso y tu contraseña, en ese orden. Es tuyo en todas las
 * empresas a las que perteneces.
 */
export function ProfileSettings() {
  const { profile, displayName, email, setProfile } = useAccount();

  return (
    <div className="account-page__body">
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
      <PasswordForm />
    </div>
  );
}
