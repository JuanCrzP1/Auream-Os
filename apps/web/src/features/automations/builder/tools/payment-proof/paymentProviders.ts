import type { Option } from "../_kit/fields";
import { accountTypesFor, providersFor } from "@contracts/PaymentProviders";

// Catálogo de entidades y tipos de cuenta: `contracts/PaymentProviders.ts`
// (lo comparte el motor, que reconoce las entidades en los comprobantes).
// Aquí solo se arman las opciones de los selectores del editor.
export {
  accountTypesFor,
  badgeTextColor,
  defaultAccountType,
  findAccountType,
  findProvider,
  normalizeProviderId,
  providerInitials,
  providersFor,
  type AccountTypeSpec,
  type PaymentProvider
} from "@contracts/PaymentProviders";

export function providerOptions(country: string): ReadonlyArray<Option<string>> {
  return providersFor(country).map((provider) => ({ value: provider.id, label: provider.name }));
}

export function accountTypeOptions(country: string): ReadonlyArray<Option<string>> {
  return accountTypesFor(country).map((type) => ({ value: type.id, label: type.label }));
}
