import type { Scope } from "../contracts/Scope";

// Permisos sobre Ventas y Productos (`/sales`, `/products`).
//   read     ver ventas, totales y el catálogo: todo el equipo
//   write    anotar una venta a mano (el asesor que cerró por chat)
//   manage   revisar, corregir y anular ventas, y crear, editar y archivar
//            productos: dueños y administradores
export const SalesPermissions = {
  read: "sales.read" as Scope,
  write: "sales.write" as Scope,
  manage: "sales.manage" as Scope
} as const;
