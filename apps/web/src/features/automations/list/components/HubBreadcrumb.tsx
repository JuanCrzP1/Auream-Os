import { useState } from "react";
import "./hub-breadcrumb.css";
import { arrastraUnFlujo, leerFlujoArrastrado } from "../services/flowDragPayload";

interface HubBreadcrumbProps {
  /** Nombre de la carpeta abierta. */
  readonly folderName: string;
  readonly onGoToRoot: () => void;
  /** Un flujo se ha soltado sobre «Automatizaciones»: vuelve a la raíz. */
  readonly onDropFlowToRoot: (flowId: string) => void;
}

/**
 * HubBreadcrumb — dónde estoy y cómo vuelvo.
 *
 * Solo aparece dentro de una carpeta: en la raíz no hay ningún camino que
 * mostrar, y una miga con un solo elemento es ruido.
 *
 * EL PRIMER TRAMO ES TAMBIÉN LA SALIDA DE LA CARPETA. Arrastrar una
 * automatización sobre «Automatizaciones» la devuelve a la raíz. Es la
 * interacción inversa de la que ya existe —se arrastra a una carpeta para
 * meterla— y evita inventar un botón «Sacar de la carpeta» que solo tendría
 * sentido en esta pantalla. El caso de uso ya lo admitía (`folderId: null`);
 * lo que faltaba era el gesto.
 */
export function HubBreadcrumb({ folderName, onGoToRoot, onDropFlowToRoot }: HubBreadcrumbProps) {
  const [recibiendo, setRecibiendo] = useState(false);

  return (
    <nav className="hub-breadcrumb" aria-label="Ubicación">
      <button
        type="button"
        className={`hub-breadcrumb__root${recibiendo ? " hub-breadcrumb__root--receiving" : ""}`}
        onClick={onGoToRoot}
        onDragOver={(event) => {
          if (!arrastraUnFlujo(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setRecibiendo(true);
        }}
        onDragLeave={() => setRecibiendo(false)}
        onDrop={(event) => {
          const flowId = leerFlujoArrastrado(event.dataTransfer);
          setRecibiendo(false);
          if (!flowId) return;

          event.preventDefault();
          onDropFlowToRoot(flowId);
        }}
      >
        Automatizaciones
      </button>
      <span className="hub-breadcrumb__sep" aria-hidden="true">
        /
      </span>
      <span className="hub-breadcrumb__current" aria-current="page">
        {folderName}
      </span>
    </nav>
  );
}
