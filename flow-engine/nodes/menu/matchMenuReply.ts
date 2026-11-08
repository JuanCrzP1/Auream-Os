import type { MenuConfig, MenuOption } from "../../../contracts/MenuConfig";

// ---------------------------------------------------------------------------
// Qué opción del Menú eligió el cliente. Pura.
//
// En orden de certeza:
//   1. Respuesta nativa de WhatsApp (botón o lista): llega con el id exacto.
//   2. Un número: «2», «2.», «2)», « 2 ».
//   3. El texto de la opción, sin distinguir mayúsculas, tildes ni espacios.
// Si nada coincide, `null`: el Menú sale por «Otra respuesta».
// ---------------------------------------------------------------------------

const normalize = (value: string) => value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");

export function matchMenuReply(
  options: ReadonlyArray<MenuOption>,
  reply: { readonly optionId?: unknown; readonly text?: unknown }
): MenuOption | null {
  if (typeof reply.optionId === "string") {
    const byId = options.find((option) => option.id === reply.optionId);
    if (byId) return byId;
  }

  if (typeof reply.text !== "string" || reply.text.trim() === "") return null;

  const number = /^\s*(\d{1,2})\s*[.)-]?\s*$/.exec(reply.text);
  if (number) return options[Number(number[1]) - 1] ?? null;

  const text = normalize(reply.text);
  return options.find((option) => normalize(option.title) === text) ?? null;
}

/** El menú en texto, con las opciones numeradas: lo que ve un canal sin botones. */
export function renderMenuText(config: MenuConfig): string {
  const lines = config.options.map((option, index) =>
    option.description.trim() ? `${index + 1}. ${option.title} — ${option.description}` : `${index + 1}. ${option.title}`
  );
  return [config.title.trim(), config.message.trim(), lines.join("\n"), config.footer.trim()]
    .filter((block) => block.length > 0)
    .join("\n\n");
}
