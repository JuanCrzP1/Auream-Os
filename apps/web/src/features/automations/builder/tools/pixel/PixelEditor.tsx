import "./pixel-editor.css";
import type { ToolEditorProps } from "../ToolUi";
import { Notice, SelectField, TextField, VariableHint } from "../_kit/fields";
import { CardSection, ChoiceCards, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { CartIcon, UserPlusIcon } from "../_kit/icons";
import { CURRENCIES } from "../_kit/catalogs";
import { readPixelConfig, type PixelConfig } from "./pixelConfig";
import { pixelTool } from "./definition";
import { PixelIcon } from "./PixelIcon";
import { PixelConnectionSection } from "./PixelConnectionSection";
import { PixelTestPanel } from "./PixelTestPanel";

export function PixelEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readPixelConfig(draft.config);
  // Lo que se guarda es la configuración vigente: sin el ID de píxel que
  // guardaban las versiones anteriores (ahora vive en la conexión).
  const { pixelId: _legacyPixelId, platform: _legacyPlatform, ...current } = draft.config;
  const update = (patch: Partial<PixelConfig>) => onChange({ config: { ...current, ...config, ...patch } });

  return (
    <ToolEditorLayout
      resources={resources}
      accent={pixelTool.colors.header}
      outputs={null}
      Icon={PixelIcon}
      title="Pixel de Meta"
      description="Registra una conversión en la API de Conversiones de Meta (Facebook e Instagram)."
    >
      <CardSection step={1} title="Píxel" description="El píxel de Meta que recibe el evento. Su token vive cifrado en tu cuenta, no en el flujo.">
        <PixelConnectionSection connectionId={config.connectionId} resources={resources} onChange={(connectionId) => update({ connectionId })} />
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
              <TextField
                variables
                label="Valor"
                value={config.value}
                placeholder="49.900 o {comprobante.valor}"
                hint="Como lo escribes: 49.900, $ 149.900, 1.234,50 o una variable."
                onChange={(value) => update({ value })}
              />
              <SelectField label="Moneda" value={config.currency} options={CURRENCIES} onChange={(currency) => update({ currency })} />
            </div>
            <VariableHint variables={["{comprobante.valor}"]} />
          </>
        ) : null}
      </CardSection>

      <CardSection step={3} title="Anuncios de clic a WhatsApp" description="Opcional. Atribuye el evento al anuncio por el que llegó el cliente.">
        <TextField
          variables
          label="ID de la página de Facebook"
          value={config.pageId}
          placeholder="Página del anuncio, p. ej. 1029384756"
          monospace
          hint="Si el cliente llegó por un anuncio de clic a WhatsApp, el evento se atribuye a ese anuncio (el Lead se envía como LeadSubmitted). Sin página, se registra como conversación."
          onChange={(pageId) => update({ pageId: pageId.trim() })}
        />
      </CardSection>

      <CardSection step={4} title="Probar" description="Envía el evento a Meta con un código de prueba y confírmalo en el Administrador de eventos.">
        <PixelTestPanel rawConfig={draft.config} test={resources?.testPixel} />
      </CardSection>

      <Notice>
        Cada bloque avisa a un píxel. Para varios píxeles (por ejemplo, dos marcas), pon un bloque por píxel; con el mismo píxel y el mismo evento dos veces, Meta
        contaría la conversión doble. Si Meta no responde, la conversación sigue igual.
      </Notice>
      <OutputsPreview outputs={null} />
    </ToolEditorLayout>
  );
}
