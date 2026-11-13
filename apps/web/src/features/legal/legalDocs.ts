import deletion from "./content/eliminar-datos.md?raw";
import privacy from "./content/privacidad.md?raw";
import terms from "./content/terminos.md?raw";
import { LEGAL_LINKS } from "@shared/legal/LegalLinks";

// ---------------------------------------------------------------------------
// Las páginas legales públicas (sin sesión): las piden Meta para aprobar la
// app y la ley de datos personales. Sus direcciones (`LEGAL_LINKS`) van en la
// configuración de la app de Meta, así que NO deben cambiar.
// ---------------------------------------------------------------------------

export type LegalDocId = "privacy" | "terms" | "deletion";

export interface LegalDoc {
  readonly id: LegalDocId;
  readonly path: string;
  readonly title: string;
  /** Nombre corto para los enlaces entre páginas. */
  readonly label: string;
  readonly source: string;
}

export const LEGAL_DOCS: ReadonlyArray<LegalDoc> = [
  { id: "privacy", ...LEGAL_LINKS.privacy, title: "Política de privacidad y tratamiento de datos", source: privacy },
  { id: "terms", ...LEGAL_LINKS.terms, title: "Términos y condiciones", source: terms },
  { id: "deletion", ...LEGAL_LINKS.deletion, title: "Eliminación de datos", source: deletion }
];

export const legalDoc = (id: LegalDocId): LegalDoc => LEGAL_DOCS.find((doc) => doc.id === id)!;
