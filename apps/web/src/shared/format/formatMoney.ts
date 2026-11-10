// Cómo se muestra el dinero en toda la app (Ventas, CRM).

/** «$ 150.000 COP» con los decimales de cada moneda (sin decimales si son ,00). */
export function formatMoney(amount: number, currency: string): string {
  const number = new Intl.NumberFormat("es-CO", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
  return `$ ${number} ${currency}`;
}

/** Corto para tarjetas y columnas: «$ 1,2 M COP», «$ 49,9 mil COP». */
export function formatMoneyShort(amount: number, currency: string): string {
  const compact = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
  return `$ ${compact} ${currency}`;
}
