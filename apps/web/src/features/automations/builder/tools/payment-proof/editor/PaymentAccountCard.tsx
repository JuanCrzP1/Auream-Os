import type { CSSProperties } from "react";
import { ChipsField, InlineSelect, RemoveButton, TextField } from "../../_kit/fields";
import { maskNumber, type PaymentAccount } from "../paymentProofConfig";
import { COUNTRY_OPTIONS, findCountry } from "../../_kit/catalogs";
import {
  accountTypeOptions,
  badgeTextColor,
  defaultAccountType,
  findAccountType,
  findProvider,
  providerInitials,
  providerOptions,
  providersFor
} from "../paymentProviders";

interface PaymentAccountCardProps {
  readonly account: PaymentAccount;
  readonly index: number;
  readonly onChange: (patch: Partial<PaymentAccount>) => void;
  readonly onRemove: () => void;
}

/** Una cuenta de recaudo: identidad visual, datos del destino y cómo se reconoce. */
export function PaymentAccountCard({ account, index, onChange, onRemove }: PaymentAccountCardProps) {
  const country = findCountry(account.country);
  const provider = findProvider(account.country, account.provider);
  const type = findAccountType(account.country, account.accountType);
  const recognized = [
    provider.id === "other" ? "" : provider.name,
    account.number,
    account.holder.trim(),
    ...account.holderAliases,
    account.holderDocument
  ].filter((value, position, all) => value.length > 0 && all.indexOf(value) === position);

  return (
    <li className="pp-account" style={{ "--pp-brand": provider.color, "--pp-brand-text": badgeTextColor(provider.color) } as CSSProperties}>
      <header className="pp-account__head">
        <span className="pp-account__badge" aria-hidden="true">
          {providerInitials(provider.name)}
        </span>
        <div className="pp-account__identity">
          <span className="pp-account__name">{account.alias.trim() || provider.name}</span>
          <span className="pp-account__meta">
            {country.flag} {type.label}
            {account.number ? ` · ${maskNumber(account.number)}` : ""}
          </span>
        </div>
        <RemoveButton label={`Quitar cuenta ${index + 1}`} onClick={onRemove} />
      </header>

      <div className="pp-account__body">
        <div className="kit-grid kit-grid--3">
          <div className="kit-field">
            <span className="kit-label">País</span>
            <InlineSelect
              value={account.country}
              options={COUNTRY_OPTIONS}
              ariaLabel={`País de la cuenta ${index + 1}`}
              onChange={(value) => {
                const first = providersFor(value)[0].id;
                onChange({ country: value, provider: first, accountType: defaultAccountType(value, first) });
              }}
            />
          </div>
          <div className="kit-field">
            <span className="kit-label">Banco o billetera</span>
            <InlineSelect
              value={account.provider}
              options={providerOptions(account.country)}
              ariaLabel={`Banco o billetera de la cuenta ${index + 1}`}
              onChange={(value) => onChange({ provider: value, accountType: defaultAccountType(account.country, value) })}
            />
          </div>
          <div className="kit-field">
            <span className="kit-label">Tipo</span>
            <InlineSelect
              value={account.accountType}
              options={accountTypeOptions(account.country)}
              ariaLabel={`Tipo de la cuenta ${index + 1}`}
              onChange={(accountType) => onChange({ accountType })}
            />
          </div>
        </div>

        <div className="kit-grid">
          <TextField
            label={type.numberLabel}
            value={account.number}
            monospace
            placeholder={type.placeholder}
            onChange={(number) => onChange({ number: number.trim() })}
          />
          <TextField
            label="Titular"
            value={account.holder}
            placeholder="Como sale en el comprobante"
            onChange={(holder) => onChange({ holder })}
          />
        </div>

        <ChipsField
          label="Otras formas en que aparece el titular"
          values={account.holderAliases}
          placeholder="AUREAM S.A.S, Auream SAS…"
          hint="Algunos bancos abrevian o escriben el nombre en mayúsculas. Añade cada variante."
          onChange={(holderAliases) => onChange({ holderAliases })}
        />

        <div className="kit-grid">
          <TextField
            label={`${country.taxIdLabel} del titular (opcional)`}
            value={account.holderDocument}
            monospace
            placeholder={country.taxIdLabel}
            onChange={(holderDocument) => onChange({ holderDocument: holderDocument.trim() })}
          />
          <TextField
            label="Nombre interno (opcional)"
            value={account.alias}
            placeholder="Cuenta principal"
            onChange={(alias) => onChange({ alias })}
          />
        </div>

        <p className="pp-account__recognized">
          <span className="pp-account__recognized-label">Así la reconocemos en el comprobante</span>
          {recognized.length > 0 ? (
            recognized.map((value) => (
              <code key={value} className="pp-account__token">
                {value}
              </code>
            ))
          ) : (
            <span className="pp-account__pending">Completa el número y el titular</span>
          )}
        </p>
      </div>
    </li>
  );
}
