import type { ToolEditorProps } from "../ToolUi";
import { Field, TextAreaField, TextField, VariableHint } from "../_kit/fields";
import { CardSection, ChatPreview, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { CONTACT_VARIABLES } from "../_kit/catalogs";
import { CountryDialPicker } from "@shared/ui/country-dial/CountryDialPicker";
import { readNotificationConfig, type NotificationConfig } from "./notificationConfig";
import { notificationTool } from "./definition";
import { NotificationIcon } from "./NotificationIcon";

export function NotificationEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readNotificationConfig(draft.config);
  const update = (patch: Partial<NotificationConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });

  return (
    <ToolEditorLayout
      resources={resources}
      accent={notificationTool.colors.header}
      outputs={null}
      Icon={NotificationIcon}
      title="Notificación al equipo"
      description="Envía un aviso por WhatsApp a alguien de tu equipo, desde el número conectado que atiende el chat. El cliente no lo ve."
    >
      <CardSection step={1} title="Destinatario" description="Quién recibe el aviso.">
        <TextField label="Nombre" value={config.name} placeholder="Ej.: Ventas, Juan, Soporte" onChange={(name) => update({ name })} />
        <Field label="Número de WhatsApp">
          {(id) => (
            <div className="kit-row">
              <div className="kit-fixed">
                <CountryDialPicker value={config.countryCode} onChange={(countryCode) => update({ countryCode })} />
              </div>
              <input
                id={id}
                type="tel"
                inputMode="numeric"
                className="kit-input nodrag"
                value={config.phone}
                placeholder="3001234567"
                onChange={(event) => update({ phone: event.target.value.replace(/\D/g, "") })}
              />
            </div>
          )}
        </Field>
      </CardSection>

      <CardSection step={2} title="Mensaje" description="Qué dice el aviso. Las variables se reemplazan con los datos del contacto.">
        <TextAreaField
          variables
          label="Texto del aviso"
          value={config.message}
          placeholder="Ej.: Nuevo lead interesado: {full_name}"
          onChange={(message) => update({ message })}
        />
        <VariableHint variables={CONTACT_VARIABLES} />
        <ChatPreview message={config.message} caption="Así le llega a tu equipo" />
      </CardSection>

      <OutputsPreview outputs={null} />
    </ToolEditorLayout>
  );
}
