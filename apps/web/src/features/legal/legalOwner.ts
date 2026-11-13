// ---------------------------------------------------------------------------
// Quién responde por Auream ante la ley (Ley 1581 de 2012) y ante Meta. Es
// el ÚNICO lugar con estos datos: las tres páginas legales los toman de aquí.
// Cuando haya registro en Cámara de Comercio, el nombre y el domicilio deben
// ser exactamente los del certificado (Meta los compara al verificar).
// ---------------------------------------------------------------------------

export const LEGAL_OWNER = {
  /** Nombre completo de la persona natural (o razón social). Vacío: se muestra solo la marca. */
  holder: "",
  /** Ciudad del domicilio. */
  city: "",
  country: "Colombia",
  /** Correo para datos personales y solicitudes de borrado. */
  email: "kmilodiim59@gmail.com",
  /** Desde cuándo rigen los textos (cambiarla al modificarlos). */
  effectiveDate: "12 de noviembre de 2026"
} as const;

/** Rellena los marcadores de un texto legal con los datos del responsable. */
export function fillLegal(source: string, owner: typeof LEGAL_OWNER = LEGAL_OWNER): string {
  const responsible = owner.holder ? `${owner.holder}, titular de la marca Auream` : "Auream";
  const domicile = owner.city ? `${owner.city}, ${owner.country}` : owner.country;
  return source
    .replaceAll("{{RESPONSABLE}}", responsible)
    .replaceAll("{{DOMICILIO}}", domicile)
    .replaceAll("{{CORREO}}", owner.email)
    .replaceAll("{{FECHA}}", owner.effectiveDate);
}
