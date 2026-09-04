import "./palette-shell.css";
import "./palette-block.css";
import { useState } from "react";
import type { NodeType } from "@contracts/FlowSnapshot";
import { listPaletteTools } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";

// Las herramientas ofrecidas las decide el registry: este panel solo las pinta.
const paletteItems = listPaletteTools();

interface PalettePanelProps {
  onAddNode: (nodeType: NodeType) => void;
}

function handleDragStart(event: React.DragEvent<HTMLButtonElement>, nodeType: NodeType) {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.effectAllowed = "move";
}

export function PalettePanel({ onAddNode }: PalettePanelProps) {
  const [query, setQuery] = useState("");
  // Estado puramente visual de la tarjeta: no sale de este componente ni toca
  // el modelo de automatización.
  //
  // Arranca recogida: al entrar al builder lo primero debe ser el lienzo, no la
  // lista de herramientas. El icono queda a un clic para desplegarla.
  const [collapsed, setCollapsed] = useState(true);
  const filtered = paletteItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <aside className={`builder-palette${collapsed ? " builder-palette--collapsed" : ""}`}>

      {/* La marca queda FUERA del área desplazable: así permanece visible tanto
          al desplazar la lista como al recoger la tarjeta.

          El propio icono ES el control: contrae con la tarjeta abierta y la
          vuelve a abrir cuando está recogida. Un solo botón para los dos
          estados, en lugar de un control extra que desaparece. */}
      <div className="palette-header">
        <button
          type="button"
          className="palette-header__toggle"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? "Abrir herramientas" : "Contraer herramientas"}
          aria-label={collapsed ? "Abrir herramientas" : "Contraer herramientas"}
          aria-expanded={!collapsed}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </button>
        <p className="palette-header__title">Herramientas</p>
      </div>

      {/* Lo que se desplaza y lo que se recoge: contador, buscador y lista. */}
      <div className="palette-scroll">

        <p className="palette-header__sub">{filtered.length} disponibles</p>

        <div className="palette-header__search">
          <svg className="palette-header__search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="8.5" cy="8.5" r="5.5"/>
            <line x1="12.5" y1="12.5" x2="17" y2="17"/>
          </svg>
          <input
            className="palette-header__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar bloque..."
          />
        </div>

        <div className="palette-list">
        {filtered.map((item) => {
          // `resolveToolUi` siempre devuelve algo pintable: una herramienta de
          // la paleta sin icono declarado cae en el neutro en lugar de dejar un
          // hueco mudo. La paridad con el registry la vigila un test.
          const { Icon } = resolveToolUi(item.type);
          return (
          <button
            key={item.type}
            type="button"
            draggable
            className="palette-block"
            onDragStart={(e) => handleDragStart(e, item.type)}
            onClick={() => onAddNode(item.type)}
          >
            <span
              className="palette-block__icon"
              style={{ background: item.colors.gradient }}
              aria-hidden="true"
            >
              <Icon />
            </span>
            <span className="palette-block__text">
              <span className="palette-block__label">{item.label}</span>
              {/* La descripción es secundaria y puede recortarse; el título
                  nativo la deja consultable completa. */}
              <span className="palette-block__sub" title={item.description}>
                {item.description}
              </span>
            </span>
            <span className="palette-block__drag" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="5" r="1.4"/><circle cx="11" cy="5" r="1.4"/>
                <circle cx="5" cy="11" r="1.4"/><circle cx="11" cy="11" r="1.4"/>
              </svg>
            </span>
          </button>
          );
        })}
        </div>

      </div>

      {/* Aquí vivían «Centrar canvas» y «Reiniciar zoom»: dos botones sin
          ningún manejador, que no hacían nada al pulsarlos. No se implementan
          porque ya existen —React Flow monta `<Controls>` con encuadre y zoom
          en el propio lienzo—, y esta paleta se renderiza fuera del
          `ReactFlowProvider`, así que darles comportamiento obligaría a subir
          el provider solo para duplicar controles que ya están. */}
      <div className="palette-footer">
        <span className="palette-footer__tip">Arrastra al canvas</span>
      </div>

    </aside>
  );
}
