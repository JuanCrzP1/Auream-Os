import markUrl from "./auream-mark-web.png";
import "./brand-assets.css";

interface Props {
  /** Ancho en píxeles. El alto lo deriva la imagen: nunca se deforma. */
  readonly width: number;
  readonly className?: string;
}

/**
 * Isotipo oficial de AUREAM OS.
 *
 * Responsabilidad única: renderizar el símbolo. No conoce rutas, sesión ni
 * navegación; quien lo coloca decide dónde va y de qué tamaño.
 *
 * Es decorativo (`alt=""`): siempre acompaña al nombre en texto o a un enlace
 * que ya se anuncia por sí mismo. Duplicar ahí el nombre lo haría sonar dos
 * veces en un lector de pantalla.
 *
 * Manda el ANCHO, no un lado cuadrado: el arte es apaisado y forzarlo a
 * cuadrado recortaba los extremos de la «A». El PNG original se conserva al
 * lado como master y no entra en el bundle.
 */
export function AureamMark({ width, className }: Props) {
  return (
    <img
      src={markUrl}
      alt=""
      width={width}
      className={className ? `auream-mark ${className}` : "auream-mark"}
      draggable={false}
    />
  );
}
