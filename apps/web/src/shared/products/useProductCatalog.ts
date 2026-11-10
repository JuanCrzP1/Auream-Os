import { useCallback, useEffect, useState } from "react";
import type { ProductSummary, SaveProductRequest } from "@contracts/SalesContracts";
import { RequestError } from "@shared/http/RequestError";
import { createProduct, fetchProducts, updateProduct } from "./productsApi";

/** Mismo significado que en los píxeles: `forbidden` (su rol no lo ve) o `unavailable` (el servidor no tiene Ventas). */
export type ProductCatalogStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/** El catálogo de la cuenta y sus operaciones. La lista del servidor manda: tras cada cambio se vuelve a pedir. */
export function useProductCatalog() {
  const [products, setProducts] = useState<ReadonlyArray<ProductSummary>>([]);
  const [canManage, setCanManage] = useState(false);
  const [status, setStatus] = useState<ProductCatalogStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      const response = await fetchProducts();
      setProducts(response.products);
      setCanManage(response.canManage);
      setStatus("ready");
    } catch (error) {
      const code = error instanceof RequestError ? error.status : 0;
      setStatus(code === 403 ? "forbidden" : code === 503 ? "unavailable" : "error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (request: SaveProductRequest) => {
      const product = await createProduct(request);
      await refresh();
      return product;
    },
    [refresh]
  );

  const update = useCallback(
    async (id: string, request: SaveProductRequest) => {
      const product = await updateProduct(id, request);
      await refresh();
      return product;
    },
    [refresh]
  );

  return { products, canManage, status, refresh, create, update };
}

export type ProductCatalog = ReturnType<typeof useProductCatalog>;
