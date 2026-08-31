import { BRAND_NAME } from "./brand";
import { AureamMark } from "./AureamMark";
import "./brand-lockup.css";

/** Escalas del conjunto. `sm` para chrome de aplicación, `lg` para portadas. */
export type LockupSize = "sm" | "lg";

interface Props {
  readonly size: LockupSize;
  readonly className?: string;
}

/** Ancho del isotipo. Es apaisado, así que el alto sale de él. */
const MARK_WIDTH_PX: Record<LockupSize, number> = { sm: 46, lg: 62 };

/**
 * La marca como conjunto: símbolo más nombre.
 *
 * Responsabilidad única: presentar la identidad en una sola pieza coherente.
 * No conoce rutas, sesión, navegación ni datos.
 *
 * Usa el isotipo —no el logotipo completo— y compone el nombre con tipografía
 * real. Tres razones, todas de diseño y no de conveniencia:
 *
 *   1. El logotipo trae su propio nombre y su propia bajada. Colocado sobre un
 *      titular, apilaba tres mensajes de texto que competían entre sí.
 *   2. El nombre como texto hereda el tema, así que se lee igual en claro y en
 *      oscuro. El lettering del PNG es blanco y desaparece sobre fondo claro.
 *   3. El isotipo llena su lienzo, así que el conjunto se alinea solo. El
 *      logotipo obligaba a márgenes negativos para anular su relleno interno.
 *
 * El logotipo completo sigue siendo el asset oficial y se usa donde la marca va
 * sola y a gran tamaño, como la portada del README.
 */
export function AureamLockup({ size, className }: Props) {
  return (
    <div className={className ? `auream-lockup auream-lockup--${size} ${className}` : `auream-lockup auream-lockup--${size}`}>
      <AureamMark width={MARK_WIDTH_PX[size]} />
      <span className="auream-lockup__name">{BRAND_NAME}</span>
    </div>
  );
}
