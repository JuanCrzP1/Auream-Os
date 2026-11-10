# products — catálogo de productos (bounded context)

Se ve en **Ventas → Productos**. Web: `apps/web/src/features/sales/` (sub-módulo de productos).

## Responsabilidad
Lo que vende la cuenta: cada producto con su nombre, descripción, imagen, **tipo** (principal, upsell, downsell), **precio por país y moneda** y estado (activo, borrador, archivado).

## Por qué es un dominio aparte
Lo usan varios: Ventas (qué se vendió), los flujos y los Agentes de IA (qué ofrecer y a qué precio) y Meta Ads (a qué producto pertenece cada campaña). Si viviera dentro de Ventas, los demás tendrían que depender de Ventas.

## No le pertenece
El inventario y los pagos (fuera de alcance por ahora).

## Capas
`domain/` (Product, Price) · `application/` · persistencia SQL. API prevista: `/products`.
