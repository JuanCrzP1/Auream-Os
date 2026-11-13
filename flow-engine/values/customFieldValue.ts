import type { ContactProfile } from "../../contracts/ContactContracts";

// ---------------------------------------------------------------------------
// Un dato del cliente para el flujo (mensajes `{ciudad}` y Condicional):
//
//   1. lo que se guardó en ESTA conversación (lo que el cliente acaba de
//      decir, tal cual: «Sí», «13/11/1990», «Cartagena»)
//   2. si no, su ficha (un cliente que vuelve otro día, o un dato que puso el
//      equipo, una integración o un webhook)
//
// Cada vez que un flujo arranca, la conversación empieza en blanco
// (`SessionService`): lo de la conversación nunca es de otro día. Así un dato
// viejo de la ficha no tapa lo que el cliente acaba de responder.
// ---------------------------------------------------------------------------

const said = (value: unknown) => value !== undefined && value !== null && value !== "";

export function customFieldValue(name: string, context: Readonly<Record<string, unknown>>, profile: ContactProfile | null): unknown {
  if (said(context[name])) return context[name];
  if (profile && name in profile.fields) return profile.fields[name];
  return context[name];
}

/** ¿Tiene el dato en la conversación o en la ficha? (Uno vacío también cuenta: tapa al reloj y al anuncio, como siempre.) */
export function hasCustomField(name: string, context: Readonly<Record<string, unknown>>, profile: ContactProfile | null): boolean {
  return (context[name] !== undefined && context[name] !== null) || (profile !== null && name in profile.fields);
}
