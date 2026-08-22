import "./palette-shell.css";
import "./palette-block.css";
import { useState } from "react";
import type { NodeType } from "@contracts/FlowSnapshot";
import { BlockIcons } from "./palette-block-icons";


const paletteItems: Array<{ type: NodeType; label: string; sub: string; color: string; grad: string }> = [
  { type: "message",   label: "Mensaje",          sub: "Envía texto o media",        color: "#2563eb", grad: "linear-gradient(135deg,#3b82f6,#1d4ed8)" },
  { type: "question",  label: "Esperar respuesta", sub: "Aguarda input del usuario",  color: "#ea580c", grad: "linear-gradient(135deg,#f97316,#c2410c)" },
  { type: "capture",   label: "Captura",           sub: "Guarda datos del usuario",   color: "#16a34a", grad: "linear-gradient(135deg,#22c55e,#15803d)" },
  { type: "action",    label: "Acción",            sub: "Ejecuta lógica externa",     color: "#dc2626", grad: "linear-gradient(135deg,#ef4444,#b91c1c)" },
  { type: "condition", label: "Condicional",       sub: "Bifurca según condición",    color: "#7c3aed", grad: "linear-gradient(135deg,#a855f7,#6d28d9)" },
  { type: "delay",     label: "Intervalo",         sub: "Pausa antes de continuar",   color: "#0891b2", grad: "linear-gradient(135deg,#22d3ee,#0e7490)" },
  { type: "fallback",  label: "Fallback",          sub: "Ruta de rescate",            color: "#d97706", grad: "linear-gradient(135deg,#fbbf24,#b45309)" },
  { type: "end",       label: "Finalizar",         sub: "Cierra el flujo",            color: "#16a34a", grad: "linear-gradient(135deg,#4ade80,#15803d)" },
  { type: "ai",        label: "Extensión IA",      sub: "Procesamiento inteligente",  color: "#9333ea", grad: "linear-gradient(135deg,#c084fc,#7e22ce)" },
];

interface PalettePanelProps {
  isOpen: boolean;
  onAddNode: (nodeType: NodeType) => void;
}

function handleDragStart(event: React.DragEvent<HTMLButtonElement>, nodeType: NodeType) {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.effectAllowed = "move";
}

export function PalettePanel({ isOpen, onAddNode }: PalettePanelProps) {
  const [query, setQuery] = useState("");
  const filtered = paletteItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.sub.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <aside className={`builder-palette${isOpen ? "" : " builder-palette--closed"}`}>

      <div className="palette-header">
        <div className="palette-header__brand">
          <div className="palette-header__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <p className="palette-header__title">Herramientas</p>
            <p className="palette-header__sub">{filtered.length} disponibles</p>
          </div>
        </div>
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
      </div>

      <div className="palette-list">
        {filtered.map((item) => (
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
              style={{ background: item.grad }}
              aria-hidden="true"
            >
              {BlockIcons[item.type]}
            </span>
            <span className="palette-block__text">
              <span className="palette-block__label">{item.label}</span>
              <span className="palette-block__sub">{item.sub}</span>
            </span>
            <span className="palette-block__drag" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="5" r="1.4"/><circle cx="11" cy="5" r="1.4"/>
                <circle cx="5" cy="11" r="1.4"/><circle cx="11" cy="11" r="1.4"/>
              </svg>
            </span>
          </button>
        ))}
      </div>

      <div className="palette-footer">
        <button type="button" className="palette-footer__btn" title="Centrar canvas">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <rect x="2" y="2" width="16" height="16" rx="2"/>
            <rect x="7" y="7" width="6" height="6" rx="1"/>
          </svg>
        </button>
        <button type="button" className="palette-footer__btn" title="Reiniciar zoom">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10a7 7 0 1 0 1.5-4.3"/>
            <polyline points="1 4.5 4.5 4.5 4.5 8"/>
          </svg>
        </button>
        <span className="palette-footer__tip">Arrastra al canvas</span>
      </div>

    </aside>
  );
}
