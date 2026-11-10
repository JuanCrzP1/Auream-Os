import "./pixel-hero.css";
import { PixelFlowDiagram } from "./PixelFlowDiagram";

const STEPS = [
  { title: "Copia el ID del píxel", text: "Lo encuentras en el Administrador de eventos de Meta, en la configuración de tu píxel." },
  { title: "Genera un token", text: "En esa misma configuración, en la sección API de Conversiones: «Generar token de acceso»." },
  { title: "Úsalo en tus flujos", text: "Agrega el bloque «Pixel» donde quieras registrar un Lead o una Compra." }
] as const;

/**
 * Meta Ads → Píxel, cuando todavía no hay ninguno: qué gana el negocio, cómo
 * viaja una conversión (chat → bloque Pixel → Meta) y los tres pasos para
 * conectarlo. Reemplaza el aviso vacío genérico.
 */
export function PixelHero({ onConnect }: { readonly onConnect: () => void }) {
  return (
    <section className="pixel-hero" aria-labelledby="pixel-hero-title">
      <div className="pixel-hero__main">
        <div className="pixel-hero__copy">
          <span className="pixel-hero__eyebrow">API de Conversiones</span>
          <h2 id="pixel-hero-title" className="pixel-hero__title">
            Cada venta del chat, <span className="pixel-hero__accent">de vuelta a tus anuncios</span>
          </h2>
          <p className="pixel-hero__lead">
            Conecta tu píxel y el bloque «Pixel» le avisa a Meta cada Lead y cada Compra que cierras por WhatsApp. Meta aprende
            quién te compra y muestra tus anuncios a más personas como ellas.
          </p>
          <div className="pixel-hero__cta">
            <button type="button" className="ui-btn ui-btn--primary pixel-hero__button" onClick={onConnect}>
              Conectar píxel
            </button>
            <span className="pixel-hero__note">Solo necesitas el ID del píxel y un token.</span>
          </div>
        </div>
        <PixelFlowDiagram />
      </div>

      <ol className="pixel-hero__steps" aria-label="Cómo conectarlo">
        {STEPS.map((step, index) => (
          <li key={step.title} className="pixel-hero__step">
            <span className="pixel-hero__step-number" aria-hidden="true">
              {index + 1}
            </span>
            <strong>{step.title}</strong>
            <span className="pixel-hero__step-text">{step.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
