import "./pixel-flow.css";
import type { ReactNode } from "react";
import { IntegrationMark } from "@shared/ui/integration-kit/IntegrationMark";
import { AdsIcons } from "../components/adsIcons";

/**
 * Cómo viaja una conversión: el chat de WhatsApp, el bloque «Pixel» del flujo
 * y Meta. Sobre el lienzo de puntos del editor, un punto de luz recorre cada
 * tramo (se retira si el sistema pide menos movimiento). Es una imagen: los
 * lectores de pantalla leen la frase entera en vez de las piezas.
 */
export function PixelFlowDiagram() {
  return (
    <div
      className="pixel-flow"
      role="img"
      aria-label="Cómo viaja una conversión: del chat de WhatsApp al bloque Pixel de tu flujo, y de ahí a Meta, que la atribuye a tu anuncio."
    >
      <FlowNode icon={<span className="pixel-flow__icon pixel-flow__icon--chat">{AdsIcons.chat}</span>} title="Chat de WhatsApp" caption="El cliente escribe y compra" />
      <FlowLink tag="Lead · Compra" />
      <FlowNode icon={<span className="pixel-flow__icon pixel-flow__icon--pixel">{AdsIcons.pixel}</span>} title="Bloque Pixel" caption="En tu flujo de Auream" />
      <FlowLink tag="API de Conversiones" late />
      <FlowNode icon={<IntegrationMark kind="meta" />} title="Meta" caption="La atribuye a tu anuncio" />
    </div>
  );
}

function FlowNode({ icon, title, caption }: { readonly icon: ReactNode; readonly title: string; readonly caption: string }) {
  return (
    <div className="pixel-flow__node">
      {icon}
      <strong className="pixel-flow__title">{title}</strong>
      <span className="pixel-flow__caption">{caption}</span>
    </div>
  );
}

/** El cable entre dos piezas, con lo que viaja por él. `late`: su punto sale cuando el anterior va a mitad de camino. */
function FlowLink({ tag, late = false }: { readonly tag: string; readonly late?: boolean }) {
  return (
    <div className={`pixel-flow__link${late ? " pixel-flow__link--late" : ""}`}>
      <span className="pixel-flow__pulse" />
      <span className="pixel-flow__tag">{tag}</span>
    </div>
  );
}
