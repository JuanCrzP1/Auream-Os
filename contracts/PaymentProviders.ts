import { DEFAULT_COUNTRY } from "./Countries";

// ---------------------------------------------------------------------------
// Entidades de pago y tipos de cuenta POR PAÍS. Contrato compartido: el
// builder pregunta con ellas y el motor las reconoce en los comprobantes.
// Cada país nombra distinto lo que aparece en un comprobante (CLABE, CBU,
// Chave PIX, Yape, IBAN…), así que el editor pregunta con sus palabras.
// ---------------------------------------------------------------------------

export interface PaymentProvider {
  /** Único global: `<país>-<entidad>` en minúsculas. */
  readonly id: string;
  readonly name: string;
  /** Color de la insignia (identificación visual, no logotipo). */
  readonly color: string;
}

export interface AccountTypeSpec {
  readonly id: string;
  readonly label: string;
  /** Rótulo del campo del identificador. */
  readonly numberLabel: string;
  readonly placeholder: string;
}

interface CountryPayments {
  readonly providers: ReadonlyArray<PaymentProvider>;
  readonly accountTypes: ReadonlyArray<AccountTypeSpec>;
  /** Tipo propuesto para billeteras/redes (si difiere del primero). */
  readonly walletType?: string;
}

const p = (country: string, slug: string, name: string, color: string): PaymentProvider => ({
  id: `${country.toLowerCase()}-${slug}`,
  name,
  color
});

const t = (id: string, label: string, numberLabel: string, placeholder: string): AccountTypeSpec => ({
  id,
  label,
  numberLabel,
  placeholder
});

const SAVINGS = t("savings", "Cuenta de ahorros", "Número de cuenta", "Número de cuenta");
const CHECKING = t("checking", "Cuenta corriente", "Número de cuenta", "Número de cuenta");
const MOBILE = (label: string) => t("wallet", label, "Número de celular", "Celular registrado");

const BY_COUNTRY: Readonly<Record<string, CountryPayments>> = {
  CO: {
    providers: [
      p("CO", "bancolombia", "Bancolombia", "#fdda24"),
      p("CO", "nequi", "Nequi", "#da0081"),
      p("CO", "daviplata", "Daviplata", "#ed1c27"),
      p("CO", "davivienda", "Davivienda", "#ed1c27"),
      p("CO", "bogota", "Banco de Bogotá", "#0b3f8f"),
      p("CO", "bbva", "BBVA", "#004481"),
      p("CO", "occidente", "Banco de Occidente", "#0063a8"),
      p("CO", "popular", "Banco Popular", "#00843d"),
      p("CO", "avvillas", "Banco AV Villas", "#003da5"),
      p("CO", "cajasocial", "Banco Caja Social", "#0069b4"),
      p("CO", "colpatria", "Scotiabank Colpatria", "#ec111a"),
      p("CO", "itau", "Itaú", "#ec7000"),
      p("CO", "falabella", "Banco Falabella", "#43b02a"),
      p("CO", "nu", "Nu", "#820ad1"),
      p("CO", "lulo", "Lulo Bank", "#c8f04b"),
      p("CO", "breb", "Bre-B", "#1f6feb"),
      p("CO", "efecty", "Efecty", "#ffd100")
    ],
    accountTypes: [SAVINGS, CHECKING, MOBILE("Billetera / celular"), t("key", "Llave Bre-B", "Llave", "@tunegocio")],
    walletType: "wallet"
  },
  MX: {
    providers: [
      p("MX", "bbva", "BBVA México", "#004481"),
      p("MX", "banorte", "Banorte", "#eb0029"),
      p("MX", "santander", "Santander", "#ec0000"),
      p("MX", "banamex", "Banamex", "#056dae"),
      p("MX", "hsbc", "HSBC", "#db0011"),
      p("MX", "azteca", "Banco Azteca", "#006c35"),
      p("MX", "nu", "Nu México", "#820ad1"),
      p("MX", "mercadopago", "Mercado Pago", "#00b1ea"),
      p("MX", "spin", "Spin by OXXO", "#e30613")
    ],
    accountTypes: [
      t("clabe", "CLABE interbancaria", "CLABE (18 dígitos)", "012180001234567891"),
      t("card", "Tarjeta de débito", "Número de tarjeta", "4152 3131 2345 6789"),
      t("account", "Número de cuenta", "Número de cuenta", "Número de cuenta"),
      MOBILE("Celular (DiMo / CoDi)")
    ],
    walletType: "clabe"
  },
  PE: {
    providers: [
      p("PE", "bcp", "BCP", "#002a8d"),
      p("PE", "interbank", "Interbank", "#05be50"),
      p("PE", "bbva", "BBVA Perú", "#004481"),
      p("PE", "scotiabank", "Scotiabank", "#ec111a"),
      p("PE", "yape", "Yape", "#742384"),
      p("PE", "plin", "Plin", "#00c5c8"),
      p("PE", "bn", "Banco de la Nación", "#c8102e")
    ],
    accountTypes: [
      SAVINGS,
      CHECKING,
      t("cci", "CCI", "Código de cuenta interbancario (20 dígitos)", "00219300123456789012"),
      MOBILE("Yape / Plin (celular)")
    ],
    walletType: "wallet"
  },
  CL: {
    providers: [
      p("CL", "bancoestado", "BancoEstado", "#f39200"),
      p("CL", "chile", "Banco de Chile", "#002464"),
      p("CL", "santander", "Santander Chile", "#ec0000"),
      p("CL", "bci", "BCI", "#0070b8"),
      p("CL", "scotiabank", "Scotiabank Chile", "#ec111a"),
      p("CL", "itau", "Itaú Chile", "#ec7000"),
      p("CL", "mercadopago", "Mercado Pago", "#00b1ea"),
      p("CL", "tenpo", "Tenpo", "#2d2d2d")
    ],
    accountTypes: [
      t("vista", "Cuenta vista / CuentaRUT", "Número de cuenta", "Número de cuenta o RUT"),
      CHECKING,
      t("savings", "Cuenta de ahorro", "Número de cuenta", "Número de cuenta")
    ]
  },
  AR: {
    providers: [
      p("AR", "galicia", "Banco Galicia", "#f26722"),
      p("AR", "nacion", "Banco Nación", "#0072bc"),
      p("AR", "santander", "Santander Argentina", "#ec0000"),
      p("AR", "bbva", "BBVA Argentina", "#004481"),
      p("AR", "macro", "Banco Macro", "#002d72"),
      p("AR", "mercadopago", "Mercado Pago", "#00b1ea"),
      p("AR", "uala", "Ualá", "#3e6bfd"),
      p("AR", "brubank", "Brubank", "#6f2dbd")
    ],
    accountTypes: [
      t("cbu", "CBU", "CBU (22 dígitos)", "0070089420000012345678"),
      t("cvu", "CVU", "CVU (22 dígitos)", "0000003100012345678901"),
      t("alias", "Alias", "Alias", "tu.negocio.mp")
    ],
    walletType: "cvu"
  },
  EC: {
    providers: [
      p("EC", "pichincha", "Banco Pichincha", "#ffdd00"),
      p("EC", "guayaquil", "Banco Guayaquil", "#e5007d"),
      p("EC", "pacifico", "Banco del Pacífico", "#0072ce"),
      p("EC", "produbanco", "Produbanco", "#00843d"),
      p("EC", "deuna", "DeUna", "#5c2d91")
    ],
    accountTypes: [SAVINGS, CHECKING, MOBILE("DeUna / celular")],
    walletType: "wallet"
  },
  VE: {
    providers: [
      p("VE", "banesco", "Banesco", "#00843d"),
      p("VE", "venezuela", "Banco de Venezuela", "#d71920"),
      p("VE", "mercantil", "Mercantil", "#003da5"),
      p("VE", "provincial", "BBVA Provincial", "#004481"),
      p("VE", "bnc", "BNC", "#0b3f8f"),
      p("VE", "bancamiga", "Bancamiga", "#00a19a")
    ],
    accountTypes: [
      t("pago_movil", "Pago móvil", "Teléfono del pago móvil", "0414 1234567"),
      t("account", "Cuenta bancaria", "Número de cuenta (20 dígitos)", "01340000000000000000")
    ]
  },
  BR: {
    providers: [
      p("BR", "itau", "Itaú", "#ec7000"),
      p("BR", "bradesco", "Bradesco", "#cc092f"),
      p("BR", "bb", "Banco do Brasil", "#fcfc30"),
      p("BR", "caixa", "Caixa", "#005ca9"),
      p("BR", "santander", "Santander Brasil", "#ec0000"),
      p("BR", "nubank", "Nubank", "#820ad1"),
      p("BR", "inter", "Inter", "#ff7a00"),
      p("BR", "picpay", "PicPay", "#21c25e"),
      p("BR", "mercadopago", "Mercado Pago", "#00b1ea")
    ],
    accountTypes: [
      t("pix", "Chave PIX", "Chave PIX (CPF, CNPJ, e-mail, celular o aleatoria)", "contato@tunegocio.com"),
      t("checking", "Conta corrente", "Agencia y cuenta", "0001 / 12345-6"),
      t("savings", "Poupança", "Agencia y cuenta", "0001 / 12345-6")
    ]
  },
  PA: {
    providers: [
      p("PA", "general", "Banco General", "#e30613"),
      p("PA", "banistmo", "Banistmo", "#004b87"),
      p("PA", "bac", "BAC", "#e10a0a"),
      p("PA", "yappy", "Yappy", "#ff6b00")
    ],
    accountTypes: [SAVINGS, CHECKING, MOBILE("Yappy (celular)")],
    walletType: "wallet"
  },
  CR: {
    providers: [
      p("CR", "bncr", "Banco Nacional", "#00843d"),
      p("CR", "bcr", "Banco de Costa Rica", "#0033a0"),
      p("CR", "bac", "BAC Credomatic", "#e10a0a"),
      p("CR", "popular", "Banco Popular", "#f39200")
    ],
    accountTypes: [
      t("iban", "Cuenta IBAN", "IBAN (CR + 20 dígitos)", "CR05015202001026284066"),
      t("sinpe", "SINPE Móvil", "Número de SINPE Móvil", "8888 8888")
    ],
    walletType: "sinpe"
  },
  GT: {
    providers: [
      p("GT", "industrial", "Banco Industrial", "#0033a0"),
      p("GT", "banrural", "Banrural", "#00843d"),
      p("GT", "bam", "BAM", "#ffcc00"),
      p("GT", "gyt", "G&T Continental", "#e30613")
    ],
    accountTypes: [t("monetary", "Cuenta monetaria", "Número de cuenta", "Número de cuenta"), SAVINGS]
  },
  DO: {
    providers: [
      p("DO", "popular", "Banco Popular", "#003da5"),
      p("DO", "banreservas", "Banreservas", "#0072bc"),
      p("DO", "bhd", "Banco BHD", "#00843d"),
      p("DO", "scotiabank", "Scotiabank", "#ec111a")
    ],
    accountTypes: [SAVINGS, CHECKING]
  },
  BO: {
    providers: [
      p("BO", "bnb", "Banco Nacional de Bolivia", "#00843d"),
      p("BO", "union", "Banco Unión", "#0033a0"),
      p("BO", "mercantil", "Banco Mercantil Santa Cruz", "#00843d"),
      p("BO", "tigomoney", "Tigo Money", "#00377b")
    ],
    accountTypes: [SAVINGS, CHECKING, MOBILE("Tigo Money / QR")]
  },
  PY: {
    providers: [
      p("PY", "itau", "Itaú Paraguay", "#ec7000"),
      p("PY", "continental", "Banco Continental", "#003da5"),
      p("PY", "ueno", "ueno bank", "#5f259f"),
      p("PY", "tigomoney", "Tigo Money", "#00377b")
    ],
    accountTypes: [SAVINGS, CHECKING, MOBILE("Billetera / celular")]
  },
  UY: {
    providers: [
      p("UY", "brou", "BROU", "#003da5"),
      p("UY", "itau", "Itaú Uruguay", "#ec7000"),
      p("UY", "santander", "Santander Uruguay", "#ec0000"),
      p("UY", "prex", "Prex", "#00a3e0")
    ],
    accountTypes: [SAVINGS, CHECKING]
  },
  US: {
    providers: [
      p("US", "chase", "Chase", "#117aca"),
      p("US", "bofa", "Bank of America", "#e31837"),
      p("US", "wellsfargo", "Wells Fargo", "#d71e28"),
      p("US", "zelle", "Zelle", "#6d1ed4"),
      p("US", "cashapp", "Cash App", "#00d632"),
      p("US", "paypal", "PayPal", "#003087")
    ],
    accountTypes: [
      t("zelle", "Zelle", "Correo o teléfono de Zelle", "pagos@tunegocio.com"),
      t("checking", "Checking account", "Routing y número de cuenta", "021000021 / 123456789"),
      t("wallet", "Cash App / PayPal", "$cashtag, usuario o correo", "$tunegocio")
    ]
  },
  ES: {
    providers: [
      p("ES", "santander", "Santander", "#ec0000"),
      p("ES", "bbva", "BBVA", "#004481"),
      p("ES", "caixabank", "CaixaBank", "#007eae"),
      p("ES", "sabadell", "Banco Sabadell", "#006dff"),
      p("ES", "bizum", "Bizum", "#05c3dd")
    ],
    accountTypes: [
      t("iban", "IBAN", "IBAN", "ES91 2100 0418 4502 0005 1332"),
      t("bizum", "Bizum", "Móvil de Bizum", "600 000 000")
    ]
  }
};

/** Entidad genérica para lo que no esté en el catálogo de un país. */
const OTHER: PaymentProvider = { id: "other", name: "Otro banco o billetera", color: "#64748b" };

function paymentsOf(country: string): CountryPayments {
  return BY_COUNTRY[country] ?? BY_COUNTRY[DEFAULT_COUNTRY];
}

export function providersFor(country: string): ReadonlyArray<PaymentProvider> {
  return [...paymentsOf(country).providers, OTHER];
}

/** Todas las entidades del catálogo, de todos los países (sin «Otro»). */
export function allProviders(): ReadonlyArray<PaymentProvider> {
  return Object.values(BY_COUNTRY).flatMap((payments) => payments.providers);
}

export function findProvider(country: string, id: string): PaymentProvider {
  return providersFor(country).find((provider) => provider.id === id) ?? OTHER;
}

export function accountTypesFor(country: string): ReadonlyArray<AccountTypeSpec> {
  return paymentsOf(country).accountTypes;
}

export function findAccountType(country: string, id: string): AccountTypeSpec {
  const types = accountTypesFor(country);
  return types.find((type) => type.id === id) ?? types[0];
}

/** Billeteras y redes usan su identificador propio; los bancos, el primer tipo del país. */
const WALLET_SLUGS = new Set([
  "nequi", "daviplata", "breb", "yape", "plin", "deuna", "yappy", "mercadopago", "uala",
  "spin", "tigomoney", "zelle", "cashapp", "paypal", "bizum", "picpay", "tenpo", "prex"
]);

export function defaultAccountType(country: string, providerId: string): string {
  const payments = paymentsOf(country);
  const slug = providerId.split("-").slice(1).join("-");

  if (slug === "breb") return "key";
  if (slug === "zelle") return "zelle";
  if (slug === "bizum") return "bizum";
  if (WALLET_SLUGS.has(slug) && payments.walletType) return payments.walletType;
  if (WALLET_SLUGS.has(slug) && payments.accountTypes.some((type) => type.id === "wallet")) return "wallet";
  return payments.accountTypes[0].id;
}

/**
 * Id de entidad válido para el país. Acepta ids del modelo anterior sin
 * prefijo de país (`nequi` → `co-nequi`).
 */
export function normalizeProviderId(country: string, id: string): string {
  const providers = providersFor(country);
  if (providers.some((provider) => provider.id === id)) return id;

  const prefixed = `${country.toLowerCase()}-${id}`;
  return providers.some((provider) => provider.id === prefixed) ? prefixed : OTHER.id;
}

/** Iniciales para la insignia: «Banco de Bogotá» → «BB». */
export function providerInitials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").split(/\s+/).filter((word) => /^[A-ZÁÉÍÓÚ0-9]/.test(word));
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

/** Texto legible sobre el color de la entidad (oscuro sobre marcas claras). */
export function badgeTextColor(hex: string): string {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}
