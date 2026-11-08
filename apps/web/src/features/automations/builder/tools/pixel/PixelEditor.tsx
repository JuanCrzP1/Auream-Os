import type { ToolEditorProps } from "../ToolUi";
import { Notice, SelectField, TextField, VariableHint } from "../_kit/fields";
import { CardSection, ChoiceCards, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { CartIcon, UserPlusIcon } from "../_kit/icons";
import { CURRENCIES } from "../_kit/catalogs";
import { readPixelConfig, type PixelConfig } from "./pixelConfig";
import { pixelTool } from "./definition";
import { PixelIcon } from "./PixelIcon";

export function PixelEditor({ draft, onChange }: ToolEditorProps) {
  const config = readPixelConfig(draft.config);
  const update = (patch: Partial<PixelConfig>) => onChange({ config: { ...draft.config, ...config, ...patch } });

  return (
    <ToolEditorLayout
      accent={pixelTool.colors.header}
      outputs={null}
      Icon={PixelIcon}
      title="Pixel de Meta"
      description="Registra una conversión en la API de Conversiones de Meta (Facebook e Instagram)."
    >
      <CardSection step={1} title="Pixel" description="El conjunto de datos de Meta que recibe el evento.">
        <TextField
          label="ID del pixel"
          value={config.pixelId}
          placeholder="1234567890123456"
          monospace
          hint="Lo encuentras en el Administrador de eventos de Meta."
          onChange={(pixelId) => update({ pixelId: pixelId.trim() })}
        />
      </CardSection>

      <CardSection step={2} title="Evento" description="Qué conversión se registra.">
        <ChoiceCards
          label="Tipo de evento"
          value={config.event}
          choices={[
            { value: "lead", title: "Lead", description: "Un contacto mostró interés.", Icon: UserPlusIcon },
            { value: "purchase", title: "Compra", description: "Se concretó una venta, con su valor.", Icon: CartIcon }
          ]}
          onChange={(event) => update({ event })}
        />

        {config.event === "purchase" ? (
          <>
            <div className="kit-grid">
              <TextField label="Valor" value={config.value} placeholder="49900 o {comprobante.valor}" onChange={(value) => update({ value })} />
              <SelectField label="Moneda" value={config.currency} options={CURRENCIES} onChange={(currency) => update({ currency })} />
            </div>
            <VariableHint variables={["{comprobante.valor}"]} />
          </>
        ) : null}
      </CardSection>

      <CardSection step={3} title="Opcional" description="Solo para campañas de clic a WhatsApp.">
        <TextField
          label="ID de la página de Facebook"
          value={config.pageId}
          placeholder="Página asociada al anuncio"
          monospace
          onChange={(pageId) => update({ pageId: pageId.trim() })}
        />
      </CardSection>

      <Notice>Evita poner dos bloques Pixel seguidos con el mismo evento: Meta contaría la conversión dos veces.</Notice>
      <OutputsPreview outputs={null} />
    </ToolEditorLayout>
  );
}
