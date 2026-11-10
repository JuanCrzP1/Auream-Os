import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/account-pages.css";
import { useState } from "react";
import { useAccount } from "@shared/account/AccountContext";
import { removeCompanyLogo, uploadCompanyLogo } from "@shared/account/accountApi";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { ImagePicker } from "../components/ImagePicker";
import { CompanyForm } from "../components/CompanyForm";

/**
 * Empresa: el logo, el nombre y la zona horaria de la cuenta activa. Todo el
 * equipo los ve; solo el dueño los cambia.
 */
export function CompanyPage() {
  const { company, setCompany, reload } = useAccount();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    await reload();
    setRetrying(false);
  };

  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Empresa</h1>
          <p className="ui-page__subtitle">El logo, el nombre y la zona horaria de tu cuenta.</p>
        </div>
      </header>

      <div className="ui-panel">
        <div className="account-page__body">
          {company ? (
            <>
              <section className="account-hero" aria-label="Logo de la empresa">
                <ImagePicker
                  name={company.name}
                  imageUrl={company.logoUrl}
                  shape="square"
                  label="logo"
                  disabled={!company.canEdit}
                  onUpload={async (file, onProgress) => setCompany(await uploadCompanyLogo(file, onProgress))}
                  onRemove={async () => setCompany(await removeCompanyLogo())}
                />
                <div className="account-hero__who">
                  <h2 className="account-hero__name">{company.name}</h2>
                  <span className="account-hero__meta">Aparece en la barra lateral y en el menú de la cuenta.</span>
                </div>
              </section>
              <CompanyForm company={company} />
            </>
          ) : (
            <StateCard
              icon={StateIcons.offline}
              title="No pudimos cargar los datos de la empresa"
              description="Revisa tu conexión e inténtalo de nuevo."
              tone="warning"
              role="alert"
              actions={<RetryButton onRetry={() => void retry()} busy={retrying} />}
            />
          )}
        </div>
      </div>
    </div>
  );
}
