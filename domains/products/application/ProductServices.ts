import type { ProductListResponse, ProductSummary, SaveProductRequest } from "../../../contracts/SalesContracts";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { PRODUCTS_PER_TENANT_MAX, productDraft, type Product } from "../domain/Product";
import type { ProductRecord, ProductRepository } from "./ProductRepository";

// ---------------------------------------------------------------------------
// El catálogo: ver, crear, editar y archivar productos. Quién puede tocarlo lo
// decide la ruta (`sales.manage`); aquí se validan los datos. Un producto con
// ventas no se borra: se archiva, para que su historial siga completo.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ProductServices {
  public constructor(private readonly repository: ProductRepository) {}

  public async list(tenantId: string, canManage: boolean, canRecordSales = false): Promise<ProductListResponse> {
    const products = await this.repository.list(tenantId);
    return { products: products.map(toSummary), canManage, canRecordSales };
  }

  /** Un producto activo de la cuenta, o `null` (no existe, es de otra cuenta o está archivado). */
  public async findActive(tenantId: string, productId: string | null | undefined): Promise<Product | null> {
    if (!productId || !UUID.test(productId)) return null;
    const product = await this.repository.find(tenantId, productId);
    return product && product.status === "active" ? product : null;
  }

  public async find(tenantId: string, productId: string): Promise<Product> {
    const product = UUID.test(productId) ? await this.repository.find(tenantId, productId) : null;
    if (!product) throw new NotFoundError("Ese producto no existe.");
    return product;
  }

  public async create(tenantId: string, input: Partial<SaveProductRequest>): Promise<ProductSummary> {
    const draft = productDraft({ ...input, status: "active" });
    if ((await this.repository.count(tenantId)) >= PRODUCTS_PER_TENANT_MAX) {
      throw new ValidationError(`El catálogo llegó a ${PRODUCTS_PER_TENANT_MAX} productos. Archiva los que ya no vendas.`);
    }
    if (await this.repository.nameTaken(tenantId, draft.name)) throw new ConflictError(`Ya tienes un producto llamado «${draft.name}».`);
    return toSummary({ ...(await this.repository.create(tenantId, draft)), salesCount: 0 });
  }

  public async update(tenantId: string, productId: string, input: Partial<SaveProductRequest>): Promise<ProductSummary> {
    const current = await this.find(tenantId, productId);
    const draft = productDraft({ ...input, status: input.status ?? current.status });
    if (await this.repository.nameTaken(tenantId, draft.name, productId)) throw new ConflictError(`Ya tienes un producto llamado «${draft.name}».`);
    const saved = await this.repository.update(tenantId, productId, draft);
    if (!saved) throw new NotFoundError("Ese producto no existe.");
    const listed = (await this.repository.list(tenantId)).find((product) => product.id === productId);
    return toSummary({ ...saved, salesCount: listed?.salesCount ?? 0 });
  }
}

function toSummary(product: ProductRecord): ProductSummary {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    kind: product.kind,
    status: product.status,
    prices: product.prices,
    salesCount: product.salesCount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}
