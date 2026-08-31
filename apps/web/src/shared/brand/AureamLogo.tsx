import { BRAND_NAME } from "./brand";
import logoUrl from "./auream-logo-web.png";
import "./brand-assets.css";

interface Props {
  /** Ancho máximo en píxeles. El alto se deriva: la imagen nunca se deforma. */
  readonly width: number;
  readonly className?: string;
}

/**
 * Logotipo oficial de AUREAM OS: símbolo, nombre y descriptor.
 *
 * Responsabilidad única: renderizar la marca completa.
 *
 * Como el arte ya contiene el nombre, `alt` lo aporta al árbol de
 * accesibilidad y quien lo use NO debe repetir el nombre en texto al lado:
 * se vería y se leería dos veces.
 *
 * Se sirve la variante `-web`, redimensionada y comprimida. El PNG original se
 * conserva al lado como master y no entra en el bundle.
 */
export function AureamLogo({ width, className }: Props) {
  return (
    <img
      src={logoUrl}
      alt={BRAND_NAME}
      width={width}
      className={className ? `auream-logo ${className}` : "auream-logo"}
      draggable={false}
    />
  );
}
