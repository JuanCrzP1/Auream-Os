import type { Product, ProductDraft } from "../domain/Product";

// ---------------------------------------------------------------------------
// ProductRepository — puerto del catálogo. SQL: `SqlProductRepository`
// (`products` y `product_prices`); pruebas: `InMemoryProductRepository`.
// Toda lectura y escritura va por cuenta (`tenantId`): un id de otra cuenta
// no existe.
// ---------------------------------------------------------------------------

export interface ProductRecord extends Product {
  /** Ventas aprobadas de este producto. */
  readonly salesCount: number;
}

export interface ProductRepository {
  list(tenantId: string): Promise<ReadonlyArray<ProductRecord>>;
  find(tenantId: string, productId: string): Promise<Product | null>;
  count(tenantId: string): Promise<number>;
  /** ¿Otro producto de la cuenta se llama igual (sin importar mayúsculas)? */
  nameTaken(tenantId: string, name: string, exceptId?: string): Promise<boolean>;
  create(tenantId: string, draft: ProductDraft): Promise<Product>;
  update(tenantId: string, productId: string, draft: ProductDraft): Promise<Product | null>;
}
