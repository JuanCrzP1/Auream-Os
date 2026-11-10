import type { AdAdvice } from "@contracts/DashboardContracts";
import { formatMoney } from "@shared/format/formatMoney";

// Cómo se dicen las cifras de anuncios: «5,2x», «$ 1.337», «2,9 %».

export const formatRoas = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })}x`);

export const formatCop = (value: number | null, currency: string) => (value === null ? "—" : formatMoney(Math.round(value), currency).replace(` ${currency}`, ""));

export const formatPercent = (value: number | null, digits = 1) => (value === null ? "—" : `${(value * 100).toLocaleString("es-CO", { maximumFractionDigits: digits })} %`);

export const formatCount = (value: number) => value.toLocaleString("es-CO");

export const ADVICE_LABEL: Readonly<Record<AdAdvice, string>> = { scale: "Escalar", keep: "Mantener", review: "Revisar", pause: "Apagar", learning: "Aprendiendo" };
