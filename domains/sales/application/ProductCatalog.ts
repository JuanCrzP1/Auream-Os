import type { ProductPrice } from "../../../contracts/SalesContracts";

// ---------------------------------------------------------------------------
// ProductCatalog — lo que Ventas necesita del catálogo (otro dominio): un
// producto ACTIVO de la cuenta con su nombre y sus precios. Lo cumple
// `ProductServices` (domains/products); Ventas no conoce su repositorio.
// ---------------------------------------------------------------------------

export interface CatalogProduct {
  readonly id: string;
  readonly name: string;
  readonly prices: ReadonlyArray<ProductPrice>;
}

export interface ProductCatalog {
  /** `null` si no existe, es de otra cuenta o está archivado. */
  findActive(tenantId: string, productId: string | null | undefined): Promise<CatalogProduct | null>;
}
