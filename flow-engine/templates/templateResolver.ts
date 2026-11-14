import { adVariable } from "../../contracts/AdOrigin";
import type { ContactProfile } from "../../contracts/ContactContracts";
import type { RuntimeInput } from "../../contracts/RuntimeContracts";
import { isBusinessKey } from "../../contracts/BusinessDataContracts";
import type { VariableResolver } from "../../contracts/TemplateVariables";
import { variableAlias } from "../../contracts/VariableCatalog";
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
//   5. El reloj, en la zona del negocio: `{fecha}` (09/11/2026), `{hora}`
//      (14:35) y, con los nombres de Leona, `{data}` (09/11), `{dia}`
//      (lunes) y `{saludo}` (Buenos días · Buenas tardes · Buenas noches).
//      Van al final: un campo que un flujo ya llame «fecha» vale lo suyo.
//   6. La conversación: `{attendant_name}` (el asesor asignado),
//      `{instance_name}` y `{instance_number}` (el número conectado); y el
//      cliente: `{created_at}` (cuándo llegó, en la hora del negocio).
//
// Un nombre de Leona que Auream llama distinto (`{phone_number}`,
// `{ai.response}`, `{comprovante.valor}`…) vale lo mismo, si no existe con su
// propio nombre (`VariableCatalog`).
//
// Mismo orden que usa el Condicional para leer datos: una variable vale lo
// mismo en un mensaje, en una integración y en una regla.
// ---------------------------------------------------------------------------

const two = (value: number) => String(value).padStart(2, "0");

/** Un instante en la hora del negocio (zona inválida: UTC). */
function wall(at: Date, timezone: string) {
  const read = (zone: string) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "long", hourCycle: "h23" }).formatToParts(at);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return { year: get("year"), month: get("month"), day: get("day"), hour: Number(get("hour")), minute: get("minute"), second: get("second"), weekday: get("weekday") };
  };
  try {
    return read(timezone);
  } catch {
    return read("UTC");
  }
}

const WEEKDAYS: Readonly<Record<string, string>> = { Monday: "lunes", Tuesday: "martes", Wednesday: "miércoles", Thursday: "jueves", Friday: "viernes", Saturday: "sábado", Sunday: "domingo" };

/** Saludo según la hora del negocio: antes de las 12, de 12 a 18:59 y desde las 19. */
export function greetingAt(hour: number): string {
  return hour >= 5 && hour < 12 ? "Buenos días" : hour >= 12 && hour < 19 ? "Buenas tardes" : "Buenas noches";
}

/** `{fecha}`, `{data}`, `{hora}`, `{dia}` y `{saludo}` del instante del turno, en la zona del negocio. */
function clockVariables(input: RuntimeInput): Readonly<Record<string, string>> {
  const at = new Date(input.now);
  if (Number.isNaN(at.getTime())) return {};
  const now = wall(at, input.timezone);
  return {
    fecha: `${now.day}/${now.month}/${now.year}`,
    data: `${now.day}/${now.month}`,
    hora: `${two(now.hour)}:${now.minute}`,
    dia: WEEKDAYS[now.weekday] ?? now.weekday.toLowerCase(),
    saludo: greetingAt(now.hour)
  };
}

/** `{created_at}`: dd/MM/aaaa HH:mm:ss en la hora del negocio, como en Leona. */
function arrivedAt(createdAt: string | undefined, timezone: string): string | undefined {
  const at = createdAt ? new Date(createdAt) : null;
  if (!at || Number.isNaN(at.getTime())) return undefined;
  const when = wall(at, timezone);
  return `${when.day}/${when.month}/${when.year} ${two(when.hour)}:${when.minute}:${when.second}`;
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
    last_message: typeof inboundText === "string" ? inboundText : context["last_message"],
    created_at: arrivedAt(profile?.createdAt, input.timezone),
    attendant_name: input.conversation?.assigneeName ?? undefined,
    instance_name: input.conversation?.connectionName ?? undefined,
    instance_number: input.conversation?.connectionNumber ?? undefined
  };

  const clock = clockVariables(input);

  const resolve = (name: string): unknown => {
    if (isBusinessKey(name)) return input.business?.[name];
    if (name in builtIns && builtIns[name] !== undefined && builtIns[name] !== null) return builtIns[name];
    // Lo que el cliente dijo en esta conversación manda; si no, su ficha.
    if (hasCustomField(name, context, profile)) return customFieldValue(name, context, profile);
    return adVariable(profile?.ad ?? null, name) ?? clock[name];
  };

  return (name) => {
    const own = resolve(name);
    if (own !== undefined) return own;
    const alias = variableAlias(name);
    return alias ? resolve(alias) : undefined;
  };
}
