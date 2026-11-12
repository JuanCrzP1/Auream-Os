# sales-lines — Líneas de venta

Partes del negocio que se miden aparte en el Dashboard («Venezuela», «Dilo cantando Colombia»). Cada línea junta:

- **productos**: sus ventas cuentan en la línea;
- **números**: por cuáles vende (vacío = todos);
- **campañas de Meta**: su gasto es el de la línea, y las ventas que trajeron son las «por anuncio».

| Capa | Archivo | Qué hace |
|---|---|---|
| Dominio | `domain/SalesLine.ts` | Reglas puras: nombre de 1 a 40, color de la paleta, ids válidos y al menos un producto o una campaña |
| Aplicación | `application/SalesLineServices.ts` | Ver, crear, editar (lo que no llega no cambia) y borrar; nombre único sin importar mayúsculas; hasta 30 por cuenta |
| Puerto | `application/SalesLineRepository.ts` | Implementado en `infrastructure/persistence/sql/SqlSalesLineRepository.ts` (`043_sales_lines.sql`) y en memoria para pruebas |

Lo usan:

- **la API**: `/sales-lines` (`apps/api/routes/routeSalesLinesRequest.ts`). Ver con `analytics.read`; cambiar con `sales.manage`.
- **el Dashboard**: `domains/analytics/application/DashboardScopeResolver.ts`, por el puerto `SalesLineLookup`. Analytics no conoce este módulo.
- **el MCP**: `list_sales_lines`, `create_sales_line`, `update_sales_line` y `delete_sales_line`.

Borrar una línea no toca ventas, productos ni campañas: solo deja de existir esa forma de mirarlos.

Ver [docs/architecture/dashboard.md](../../docs/architecture/dashboard.md#líneas-de-venta-filtros-y-moneda).
