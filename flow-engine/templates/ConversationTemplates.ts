import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts";
import { renderTemplate, variablesIn } from "../../contracts/TemplateVariables";
import { identityOf, type ContactDirectory } from "../ports/ContactDirectory";
import { templateResolver } from "./templateResolver";

// ---------------------------------------------------------------------------
// ConversationTemplates — textos que se le envían al cliente (Mensaje, Menú,
// Esperar respuesta) con sus variables resueltas: `{first_name}`, campos del
// contacto, datos de la conversación y el formato heredado `{{context.x}}`.
//
// Solo consulta el contacto si algún texto usa variables: un mensaje fijo no
// cuesta una lectura. Sin directorio de contactos (tests de un bloque suelto),
// resuelve con lo que hay en la conversación.
// ---------------------------------------------------------------------------

export class ConversationTemplates {
  public constructor(private readonly contacts?: ContactDirectory) {}

  public async render(texts: ReadonlyArray<string>, input: RuntimeInput, session: Session): Promise<string[]> {
    if (!texts.some((text) => variablesIn(text).length > 0)) return [...texts];

    const profile = this.contacts ? await this.contacts.resolve(session.tenantId, identityOf(input.envelope)) : null;
    const resolve = templateResolver({ ...input, sessionContext: { ...input.sessionContext, ...session.context } }, profile);
    return texts.map((text) => renderTemplate(text, resolve).text);
  }
}
