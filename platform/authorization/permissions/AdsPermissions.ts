import type { Scope } from "../contracts/Scope";

// Permisos sobre Meta Ads y el dinero de los anuncios (`/ads`, `/dashboard/ads`).
//   read     ver gasto, ROAS, ganancia y campañas: dueños y administradores
//   manage   conectar Meta, elegir cuentas, sincronizar y desconectar
// El Dashboard (Ventas y Atención) lo ve todo el equipo con `analytics.read`.
export const AdsPermissions = {
  read: "ads.read" as Scope,
  manage: "ads.manage" as Scope
} as const;
