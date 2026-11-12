# expenses — Otros gastos

Lo que el negocio paga **fuera de Meta** (herramientas, sueldos, la comisión de la pasarela…). El Dashboard lo resta de la ganancia; el ROAS sigue siendo solo contra Meta.

Un gasto es:

- **monto fijo** en una moneda que se repite: una vez, cada día, cada semana o cada mes (el día de `startsOn`); o
- **% de las ventas** (de 0 a 100) mientras esté vigente.

Se aplica a **todo el negocio** o a **una línea de venta**, desde `startsOn` y, si se quiere, hasta `endsOn`.

| Capa | Archivo | Qué hace |
|---|---|---|
| Dominio | `domain/OtherExpense.ts` | Reglas puras: nombre de 1 a 60, monto con la regla de siempre («1.200.000», «3,5»), % hasta 100, fechas reales y en orden, un fijo con moneda y frecuencia |
| Aplicación | `application/OtherExpenseServices.ts` | Ver, crear, editar (lo que no llega no cambia) y borrar; la línea debe ser de la cuenta; hasta 50 por cuenta |
| Puerto | `application/OtherExpenseRepository.ts` | Implementado en `infrastructure/persistence/sql/SqlOtherExpenseRepository.ts` (`045_other_expenses.sql`) y en memoria para pruebas |

Lo usan:

- **la API**: `/other-expenses` (`apps/api/routes/routeOtherExpensesRequest.ts`). Ver con `ads.read`; cambiar con `sales.manage`.
- **el Dashboard**: `domains/analytics/application/OtherExpenseLedger.ts` calcula cuánto cuesta cada gasto en un periodo, por el puerto `OtherExpensesReader` (lo arma `apps/api/composition/composeOtherExpenseServices.ts`). Analytics no conoce este módulo.
- **el MCP**: `list_other_expenses`, `create_other_expense`, `update_other_expense` y `delete_other_expense`.

Borrar un gasto solo cambia la ganancia que muestra el Dashboard (también la de periodos pasados): no toca ventas ni anuncios.

Ver [docs/architecture/dashboard.md](../../docs/architecture/dashboard.md#otros-gastos).
