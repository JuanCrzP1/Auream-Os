import type { BusinessDataExample } from "@contracts/BusinessDataContracts";
import type { ContactFieldValue } from "@contracts/ContactContracts";
import { previewPieces } from "../businessDataText";

/**
 * «Así lo ve tu cliente»: un mensaje real que usa el dato, en una burbuja de
 * WhatsApp, con el valor resaltado (el que se está escribiendo, antes de
 * guardar). Sin mensajes que lo usen, un ejemplo con solo el valor.
 */
export function CustomerPreview({
  datumKey,
  example,
  values
}: {
  readonly datumKey: string;
  readonly example: BusinessDataExample | null;
  /** Los valores de la cuenta, con el de este dato como está escrito ahora. */
  readonly values: Readonly<Record<string, ContactFieldValue>>;
}) {
  const template = example?.template ?? `{${datumKey}}`;
  return (
    <figure className="bd-preview" aria-label="Así lo ve tu cliente">
      <div className="bd-preview__chat">
        <p className="bd-preview__bubble">
          {previewPieces(template, values).map((piece, index) =>
            piece.key === datumKey ? (
              <mark key={index} className="bd-preview__value">{piece.text || "…"}</mark>
            ) : (
              <span key={index}>{piece.text}</span>
            )
          )}
        </p>
      </div>
      <figcaption>{example ? example.source : "Aún no lo usa ningún mensaje: así se vería solo."}</figcaption>
    </figure>
  );
}
