import "./payment-proof-editor.css";
import type { ToolEditorProps } from "../ToolUi";
import { SwitchField } from "../_kit/Switch";
import { AddButton, InlineSelect, SelectField, TextField, VariableHint } from "../_kit/fields";
import { CURRENCIES, DEFAULT_COUNTRY } from "../_kit/catalogs";
import { CardSection, ChoiceCards, Counter, EmptyState, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { createLocalId } from "../_kit/createLocalId";
import { removeById, replaceById } from "../_kit/read";
import {
  PAYMENT_PROOF_FIELDS,
  createAccount,
  paymentProofOutputs,
  readPaymentProofConfig,
  type PaymentAccount,
  type PaymentProofConfig
} from "./paymentProofConfig";
import { PaymentAccountCard } from "./editor/PaymentAccountCard";
import { PaymentProofTestPanel } from "./PaymentProofTestPanel";
import { paymentProofTool } from "./definition";
import { PaymentProofIcon } from "./PaymentProofIcon";

const MAX_AGE_OPTIONS = [
  { value: "1", label: "1 hora" },
  { value: "6", label: "6 horas" },
  { value: "24", label: "24 horas" },
  { value: "48", label: "2 días" },
  { value: "168", label: "7 días" },
  { value: "720", label: "30 días" }
];

export function PaymentProofEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readPaymentProofConfig(draft.config);
  const update = (patch: Partial<PaymentProofConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });
  const patchAccount = (id: string, patch: Partial<PaymentAccount>) => update({ accounts: replaceById(config.accounts, id, patch) });
  // Una cuenta nueva hereda el país de la última: lo normal es registrar varias del mismo país.
  const addAccount = () =>
    update({
      accounts: [
        ...config.accounts,
        createAccount(createLocalId("acc"), config.accounts[config.accounts.length - 1]?.country ?? DEFAULT_COUNTRY)
      ]
    });

  const ageValue = MAX_AGE_OPTIONS.some((option) => option.value === String(config.maxAgeHours))
    ? String(config.maxAgeHours)
    : "24";

  return (
    <ToolEditorLayout
      accent={paymentProofTool.colors.header}
      outputs={paymentProofOutputs({ ...draft.config, ...config })}
      Icon={PaymentProofIcon}
      title="Comprobante automático"
      description="Lee la imagen o el PDF del pago que envía el cliente y comprueba que el dinero llegó a una de tus cuentas. Sin IA: la lectura corre en Auream."
    >
      <CardSection step={1} title="Comprobante" description="Dónde está la imagen o el PDF que envió el cliente.">
        <TextField
          label="Variable con el comprobante"
          value={config.source}
          monospace
          hint="Normalmente la guarda un bloque «Esperar respuesta» anterior. Acepta imágenes (JPG, PNG, WebP) y PDF."
          onChange={(source) => update({ source: source.trim() })}
        />
      </CardSection>

      <CardSection
        step={2}
        title="Tus cuentas de recaudo"
        description="Las cuentas donde recibes pagos. El comprobante debe mostrar una de ellas para ser válido."
        aside={<Counter value={config.accounts.length} />}
      >
        {config.accounts.length === 0 ? (
          <EmptyState
            title="Aún no registras cuentas"
            description="Añade las cuentas, billeteras o llaves donde te pagan, en cualquier país, con el titular tal como sale en el comprobante."
            action={<AddButton label="Añadir cuenta" onClick={addAccount} />}
          />
        ) : (
          <>
            <ul className="kit-list">
              {config.accounts.map((account, index) => (
                <PaymentAccountCard
                  key={account.id}
                  account={account}
                  index={index}
                  onChange={(patch) => patchAccount(account.id, patch)}
                  onRemove={() => update({ accounts: removeById(config.accounts, account.id) })}
                />
              ))}
            </ul>
            <AddButton label="Añadir cuenta" onClick={addAccount} />
          </>
        )}
      </CardSection>

      <CardSection step={3} title="Qué debe cumplir el comprobante" description="Si algo no se cumple, el flujo sigue por «Comprobante rechazado».">
        <SwitchField
          label="Cuenta de destino registrada"
          hint="El banco y el número o llave deben coincidir con una de tus cuentas."
          checked={config.matchAccount}
          onChange={(matchAccount) => update({ matchAccount })}
        />
        <SwitchField
          label="Titular correcto"
          hint="El nombre del destino debe coincidir con el titular o una de sus variantes."
          checked={config.matchHolder}
          onChange={(matchHolder) => update({ matchHolder })}
        />
        <SwitchField
          label="Comprobante reciente"
          hint="Rechaza pagos hechos hace demasiado tiempo."
          checked={config.maxAgeEnabled}
          onChange={(maxAgeEnabled) => update({ maxAgeEnabled })}
        />
        {config.maxAgeEnabled ? (
          <div className="kit-field">
            <span className="kit-label">Antigüedad máxima</span>
            <InlineSelect
              value={ageValue}
              options={MAX_AGE_OPTIONS}
              ariaLabel="Antigüedad máxima del comprobante"
              onChange={(value) => update({ maxAgeHours: Number(value) })}
            />
          </div>
        ) : null}
        <SwitchField
          label="Rechazar comprobantes repetidos"
          hint="Si la referencia del pago ya se aceptó antes en tu cuenta, sale por «Comprobante repetido»."
          checked={config.rejectDuplicates}
          onChange={(rejectDuplicates) => update({ rejectDuplicates })}
        />
        <SwitchField
          label="Una salida por cada motivo de rechazo"
          hint="Apagado: una sola salida «Comprobante rechazado» y el motivo queda en la variable de error. Encendido: una salida por cada verificación (cuenta, titular, monto, antigüedad, repetido, no es comprobante y error)."
          checked={config.splitRejections}
          onChange={(splitRejections) => update({ splitRejections })}
        />
      </CardSection>

      <CardSection step={4} title="Monto" description="Opcional. Compara el valor del comprobante con lo que esperas cobrar.">
        <ChoiceCards
          label="Verificación del monto"
          value={config.amountCheck}
          choices={[
            { value: "off", title: "No verificar", description: "Acepta cualquier valor." },
            { value: "exact", title: "Monto exacto", description: "Debe ser igual al esperado." },
            { value: "minimum", title: "Monto mínimo", description: "Igual o mayor al esperado." }
          ]}
          onChange={(amountCheck) => update({ amountCheck })}
        />
        {config.amountCheck !== "off" ? (
          <div className="kit-grid">
            <TextField
              label="Monto esperado"
              value={config.expectedAmount}
              placeholder="49900 o {producto.precio}"
              onChange={(expectedAmount) => update({ expectedAmount })}
            />
            <SelectField label="Moneda" value={config.amountCurrency} options={CURRENCIES} onChange={(amountCurrency) => update({ amountCurrency })} />
          </div>
        ) : null}
      </CardSection>

      <CardSection step={5} title="Resultado" description="Datos que quedan disponibles para los siguientes bloques.">
        <div className="kit-grid">
          <TextField
            label="Guardar datos en"
            value={config.resultVariable}
            monospace
            onChange={(resultVariable) => update({ resultVariable: resultVariable.trim() })}
          />
          <TextField
            label="Guardar motivo del rechazo en"
            value={config.errorVariable}
            monospace
            onChange={(errorVariable) => update({ errorVariable: errorVariable.trim() })}
          />
        </div>
        <VariableHint variables={PAYMENT_PROOF_FIELDS.map((field) => `{${config.resultVariable || "comprobante"}.${field}}`)} />
      </CardSection>

      <CardSection step={6} title="Probar" description="Sube un comprobante real y mira qué lee Auream y por qué salida seguiría el flujo.">
        <PaymentProofTestPanel config={config} rawConfig={{ ...draft.config, ...config }} test={resources?.testPaymentProof} />
      </CardSection>

      <OutputsPreview outputs={paymentProofOutputs({ ...draft.config, ...config })} />
    </ToolEditorLayout>
  );
}
