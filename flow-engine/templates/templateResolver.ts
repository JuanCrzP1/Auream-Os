import type { ContactProfile } from "../../contracts/ContactContracts";
import type { RuntimeInput } from "../../contracts/RuntimeContracts";
import type { VariableResolver } from "../../contracts/TemplateVariables";

// ---------------------------------------------------------------------------
// De dónde sale el valor de cada variable durante una ejecución.
//
//   1. Variables del sistema (`full_name`, `phone`…): el contacto manda; lo que
//      el flujo guardó en la conversación completa lo que falte.
//   2. Campos personalizados del contacto.
//   3. Datos guardados en la conversación (p. ej. por «Esperar respuesta»).
//   4. El reloj, en la zona del negocio: `{fecha}` (09/11/2026) y `{hora}`
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
    if (name in builtIns && builtIns[name] !== undefined && builtIns[name] !== null) return builtIns[name];
    if (profile && name in profile.fields) return profile.fields[name];
    if (context[name] !== undefined && context[name] !== null) return context[name];
    return clock[name];
  };
}
