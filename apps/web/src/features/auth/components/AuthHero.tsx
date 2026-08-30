import { BRAND_NAME } from "@shared/brand/brand";
import "../styles/auth-hero.css";

/**
 * Panel de marca de las pantallas de autenticación.
 *
 * Responsabilidad única: presentar la identidad del producto. No contiene
 * formularios, estado ni lógica; es decorativo y prescindible — en móvil se
 * reduce a la cabecera de marca y el resto se oculta.
 *
 * La composición es un grafo de automatización dibujado en SVG: nodos
 * conectados por curvas con una señal recorriéndolas. Es el mismo lenguaje
 * visual del builder, no una ilustración genérica.
 */

const CAPABILITIES = [
  "Agentes de IA que conversan y venden",
  "Automatiza cada punto de contacto",
  "Un panel para todos tus canales"
];

export function AuthHero() {
  return (
    <aside className="auth-hero">
      <div className="auth-hero__brand">
        <span className="auth-hero__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" role="presentation">
            <path
              d="M16 3.5 27 9.75v12.5L16 28.5 5 22.25V9.75Z"
              fill="url(#markFill)"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1"
            />
            <circle cx="16" cy="16" r="3.6" fill="#fff" opacity="0.92" />
            <defs>
              <linearGradient id="markFill" x1="5" y1="3.5" x2="27" y2="28.5">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#5b6cf9" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <span className="auth-hero__wordmark">{BRAND_NAME}</span>
      </div>

      <h2 className="auth-hero__headline">
        Conversaciones que <em>trabajan</em> por ti.
      </h2>

      <p className="auth-hero__lede">
        Diseña, automatiza y mide agentes conversacionales desde un único lugar.
      </p>

      <ul className="auth-hero__capabilities">
        {CAPABILITIES.map((capability) => (
          <li key={capability}>{capability}</li>
        ))}
      </ul>

      <HeroGraph />
    </aside>
  );
}

/**
 * Nodo del grafo: una tarjeta con un punto y dos trazos, como un mensaje.
 *
 * El detalle interior es lo que evita que se lea como un rectángulo vacío.
 */
function GraphNode({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* Colores por token: en tema claro un blanco fijo desaparecería. */}
      <rect
        width="54"
        height="38"
        rx="12"
        fill="var(--chip-bg)"
        stroke="var(--primary-soft)"
        strokeWidth="1.1"
      />
      <circle cx="15" cy="19" r="4.2" fill="var(--primary)" opacity="0.85" />
      <rect x="24" y="14" width="19" height="2.6" rx="1.3" fill="var(--muted)" opacity="0.55" />
      <rect x="24" y="21" width="13" height="2.6" rx="1.3" fill="var(--muted)" opacity="0.34" />
    </g>
  );
}

/** Grafo decorativo. Separado sólo para no mezclar copy y trazado en un bloque. */
function HeroGraph() {
  return (
    <svg
      className="auth-hero__graph"
      viewBox="0 0 420 260"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="edge" x1="0" y1="0" x2="420" y2="260">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="halo">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="210" cy="130" r="120" fill="url(#halo)" />

      {/* Conectores: el recorrido que sigue una automatización. */}
      <g stroke="url(#edge)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M74 78 C 130 78, 140 130, 196 130" />
        <path d="M74 190 C 130 190, 140 132, 196 132" />
        <path d="M244 130 C 300 130, 300 68, 352 68" />
        <path d="M244 132 C 300 132, 300 196, 352 196" />
      </g>

      {/* Señal viajando por el grafo.
          Nacen invisibles: hasta que `animateMotion` arranca, el círculo se
          dibuja en el origen del lienzo y se vería como un punto suelto en la
          esquina. La opacidad se enciende justo cuando empieza el recorrido. */}
      <circle className="auth-hero__pulse" r="3.4" fill="#e9d5ff" opacity="0">
        <animate attributeName="opacity" to="1" dur="0.01s" begin="0s" fill="freeze" />
        <animateMotion
          dur="4.6s"
          repeatCount="indefinite"
          path="M74 78 C 130 78, 140 130, 196 130"
        />
      </circle>
      <circle className="auth-hero__pulse" r="3.4" fill="#7dd3fc" opacity="0">
        <animate attributeName="opacity" to="1" dur="0.01s" begin="1.4s" fill="freeze" />
        <animateMotion
          dur="5.8s"
          begin="1.4s"
          repeatCount="indefinite"
          path="M244 132 C 300 132, 300 196, 352 196"
        />
      </circle>

      {/* Nodos: canales que entran a la izquierda y salidas a la derecha. */}
      <GraphNode x={26} y={60} />
      <GraphNode x={26} y={172} />
      <GraphNode x={348} y={50} />
      <GraphNode x={348} y={178} />

      {/* Núcleo: el agente que decide. */}
      <circle cx="220" cy="131" r="30" fill="var(--primary-soft)" opacity="0.5" />
      <circle cx="220" cy="131" r="30" fill="none" stroke="var(--primary)" strokeWidth="1.4" opacity="0.6" />
      <circle cx="220" cy="131" r="9" fill="var(--primary)" />
      <circle
        className="auth-hero__ring"
        cx="220"
        cy="131"
        r="44"
        fill="none"
        stroke="var(--primary-soft)"
        strokeWidth="1"
        strokeDasharray="4 10"
      />
    </svg>
  );
}
