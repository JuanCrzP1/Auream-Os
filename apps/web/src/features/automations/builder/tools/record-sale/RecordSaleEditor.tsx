import "./record-sale-editor.css";
import type { ToolEditorProps } from "../ToolUi";
import { Notice, TextField, VariableHint } from "../_kit/fields";
import { CartIcon, ListIcon } from "../_kit/icons";
import { CardSection, ChoiceCards, OutputsPreview, ToolEditorLayout } from "../_kit/layout";
import { recordSaleTool } from "./definition";
import { ProductSection } from "./ProductSection";
import { RecordSaleIcon } from "./RecordSaleIcon";
import { readRecordSaleConfig, type RecordSaleConfig } from "./recordSaleConfig";

/** Lo que deja el bloque para los siguientes (Pixel, Notificación, Condicional). */
const SALE_VARIABLES = ["{venta.valor}", "{venta.moneda}", "{venta.producto}", "{venta.estado}"];

export function RecordSaleEditor({ draft, onChange, resources }: ToolEditorProps) {
  const config = readRecordSaleConfig(draft.config);
  const update = (patch: Partial<RecordSaleConfig>) => onChange({ config: { ...config, ...patch } });

  return (
    <ToolEditorLayout
      resources={resources}
      accent={recordSaleTool.colors.header}
      outputs={null}
      Icon={RecordSaleIcon}
      title="Registrar venta"
      description="Guarda la venta en Ventas. Ponlo después de la salida «Comprobante válido» o de un pago confirmado."
      className="record-sale"
    >
      <CardSection step={1} title="Producto" description="Qué se vendió. Los productos y sus precios por país se crean en Ventas → Productos.">
        <ProductSection productId={config.productId} resources={resources} onChange={(product) => update({ productId: product.id, productName: product.name })} />
      </CardSection>

      <CardSection step={2} title="Monto" description="De dónde sale lo que pagó el cliente.">
        <ChoiceCards
          label="Origen del monto"
          value={config.amountMode}
          choices={[
            { value: "variable", title: "Lo que dice el comprobante", description: "El monto y la moneda que leyó el Comprobante (o de otra variable).", Icon: ListIcon },
            { value: "product", title: "Precio del producto", description: "El precio en el país del cliente, según su número de WhatsApp.", Icon: CartIcon }
          ]}
          onChange={(amountMode) => update({ amountMode })}
        />
        {config.amountMode === "variable" ? (
          <>
            <div className="kit-grid">
              <TextField variables label="Monto" value={config.amount} placeholder="{comprobante.valor}" hint="Una variable o un número: 49.900, $ 149.900, 1.234,50." onChange={(amount) => update({ amount })} />
              <TextField variables label="Moneda" value={config.currency} placeholder="{comprobante.moneda}" hint="Una variable o el código: COP, MXN, USD…" onChange={(currency) => update({ currency })} />
            </div>
            <VariableHint variables={["{comprobante.valor}", "{comprobante.moneda}"]} />
          </>
        ) : (
          <Notice>Si el producto no tiene precio en el país del cliente, la venta queda «Por revisar» para que alguien ponga el monto.</Notice>
        )}
      </CardSection>

      <CardSection step={3} title="Cliente y pago" description="Opcional. Para reconocer la venta y no registrarla dos veces.">
        <div className="kit-grid">
          <TextField
            variables
            label="Nombre del cliente"
            value={config.customerName}
            placeholder="{comprobante.nombre_pagador}"
            hint="Si queda vacío, el nombre del contacto."
            onChange={(customerName) => update({ customerName })}
          />
          <TextField
            variables
            label="Referencia del pago"
            value={config.reference}
            placeholder="{comprobante.referencia}"
            monospace
            hint="El mismo comprobante nunca se registra dos veces."
            onChange={(reference) => update({ reference })}
          />
        </div>
      </CardSection>

      <Notice>
        Nunca se inventa un precio: si falta el producto, el monto o la moneda, la venta queda «Por revisar» en Ventas y no suma en los totales hasta que alguien la complete.
        Los siguientes bloques pueden usar estos datos, por ejemplo en el Pixel (Compra) o una Notificación al equipo.
      </Notice>
      <VariableHint variables={SALE_VARIABLES} />
      <OutputsPreview outputs={null} />
    </ToolEditorLayout>
  );
}
