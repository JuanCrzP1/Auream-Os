import { adVariable } from "../../contracts/AdOrigin";
import type { ContactProfile } from "../../contracts/ContactContracts";
import type { RuntimeInput } from "../../contracts/RuntimeContracts";
import { isBusinessKey } from "../../contracts/BusinessDataContracts";
import type { VariableResolver } from "../../contracts/TemplateVariables";
import { customFieldValue, hasCustomField } from "../values/customFieldValue";

// ---------------------------------------------------------------------------
// De dónde sale el valor de cada variable durante una ejecución.
//
//   1. Variables del sistema (`full_name`, `phone`…): el contacto manda; lo que
//      el flujo guardó en la conversación completa lo que falte.
//   2. Lo que se guardó en ESTA conversación (p. ej. por «Esperar
//      respuesta»): lo que el cliente acaba de decir, tal cual.
//   3. La ficha del cliente (campos personalizados), si la conversación no lo
//      tiene. Ver `values/customFieldValue`.
//   4. El anuncio de clic a WhatsApp por el que entró el contacto, con los
//      nombres de Leona: `{source_id}`, `{source_url}`, `{media_url}`,
//      `{thumbnail_url}` y `{ctwa_clid}` (el Pixel lo usa para atribuir).
//   0. Los Datos del negocio (`{g_horario}`): solo de Configuración, nunca de
//      la conversación ni de la ficha (un flujo no los puede cambiar).
//   5. El reloj, en la zona del negocio: `{fecha}` (09/11/2026) y `{hora}`
//      (14:35); `{data}` es la fecha con el nombre de Leona. Van al final: un
//      campo que un flujo ya llame «fecha» sigue valiendo lo suyo.
//
// Mismo orden que usa el Condicional para leer datos: una variable vale lo
// mismo en un mensaje, en una integración y en una regla.
// ---------------------------------------------------------------------------

/** `{fecha}`, `{hora}` y `{data}` del instante del turno, en la zona del negocio. */
function clockVariables(input: RuntimeInput): Readonly<Record<string, string>> {
  const at = new Date(input.now);
  if (Number.isNaN(at.getTime())) return {};
  const format = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat("es-CO", { timeZone: input.timezone, ...options }).format(at);
    } catch {
      return new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", ...options }).format(at);
    }
  };
  const fecha = format({ day: "2-digit", month: "2-digit", year: "numeric" });
  return { fecha, data: fecha, hora: format({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) };
}

function firstWord(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().split(/\s+/)[0] : undefined;
}

export function templateResolver(input: RuntimeInput, profile: ContactProfile | null): VariableResolver {
  const context = input.sessionContext;
  const inboundText = input.envelope.payload["text"];
  const fullName = profile?.name ?? context["full_name"] ?? context["name"];

  const builtIns: Readonly<Record<string, unknown>> = {
    full_name: fullName ?? context["first_name"],
    first_name: firstWord(fullName) ?? context["first_name"],
    phone: profile?.phone ?? context["phone"] ?? input.envelope.userKey,
    email: profile?.email ?? context["email"],
    last_message: typeof inboundText === "string" ? inboundText : context["last_message"]
  };

  const clock = clockVariables(input);

  return (name) => {
    if (isBusinessKey(name)) return input.business?.[name];
    if (name in builtIns && builtIns[name] !== undefined && builtIns[name] !== null) return builtIns[name];
    // Lo que el cliente dijo en esta conversación manda; si no, su ficha.
    if (hasCustomField(name, context, profile)) return customFieldValue(name, context, profile);
    return adVariable(profile?.ad ?? null, name) ?? clock[name];
  };
}
