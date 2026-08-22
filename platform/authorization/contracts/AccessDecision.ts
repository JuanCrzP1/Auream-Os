// Discriminated union: granted siempre tiene reason cuando es false.
export type AccessDecision =
  | { readonly granted: true }
  | { readonly granted: false; readonly reason: string };
