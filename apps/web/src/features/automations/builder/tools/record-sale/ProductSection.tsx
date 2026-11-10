import type { ProductSummary } from "@contracts/SalesContracts";
import type { ToolResources } from "../ToolResources";
import { findCountry } from "../_kit/catalogs";
import { Notice, SelectField, type Option } from "../_kit/fields";

// ---------------------------------------------------------------------------
// Paso 1 de Registrar venta: QUÉ producto se vende. Como el Pixel con sus
// píxeles, el bloque solo elige: los productos se crean en Ventas → Productos
// (otra pestaña), y al volver al editor la lista se pone al día sola.
// ---------------------------------------------------------------------------

const PRODUCTS_PAGE = "/sales?tab=products";

const money = (amount: number, currency: string) =>
  `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(amount)} ${currency}`;

function SalesLink({ children, className = "record-sale__link" }: { readonly children: string; readonly className?: string }) {
  return (
    <a className={`${className} nodrag`} href={PRODUCTS_PAGE} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Los precios del producto elegido, por país. */
export function ProductPrices({ product }: { readonly product: ProductSummary }) {
  return (
    <ul className="record-sale__prices" aria-label={`Precios de ${product.name}`}>
      {product.prices.map((price) => (
        <li key={price.country} className="record-sale__price">
          <span aria-hidden="true">{findCountry(price.country).flag}</span> {findCountry(price.country).name} · {money(price.amount, price.currency)}
        </li>
      ))}
    </ul>
  );
}

export function ProductSection({
  productId,
  resources,
  onChange
}: {
  readonly productId: string;
  readonly resources: ToolResources | undefined;
  readonly onChange: (product: ProductSummary) => void;
}) {
  const products = (resources?.products ?? []).filter((product) => product.status === "active");
  const status = resources?.productsStatus ?? "ready";
  const selected = products.find((product) => product.id === productId);

  if (status === "forbidden") return <Notice>Tu rol no permite ver los productos de esta cuenta. Pide acceso a un administrador.</Notice>;
  if (status === "unavailable") return <Notice>Ventas no está disponible en este servidor.</Notice>;
  if (status === "loading") return <p className="kit-hint">Cargando tus productos…</p>;
  if (status === "error") return <Notice>No pudimos cargar tus productos. La lista se vuelve a pedir al regresar a esta pestaña.</Notice>;
  if (products.length === 0) {
    return (
      <div className="record-sale__empty">
        <p className="record-sale__empty-title">Todavía no tienes productos</p>
        <p className="kit-hint">Créalos una vez en Ventas → Productos, con su precio en cada país; aquí eliges cuál se vendió.</p>
        <SalesLink className="record-sale__go">Crear un producto en Ventas</SalesLink>
        <p className="kit-hint">Cuando lo crees, vuelve aquí: aparece solo en la lista.</p>
      </div>
    );
  }

  const options: ReadonlyArray<Option<string>> = [
    ...(selected ? [] : [{ value: "", label: productId ? "El producto elegido ya no existe o se archivó" : "Elige un producto…" }]),
    ...products.map((product) => ({ value: product.id, label: product.name }))
  ];

  return (
    <>
      <SelectField
        label="Producto"
        value={selected ? selected.id : ""}
        options={options}
        onChange={(id) => {
          const product = products.find((entry) => entry.id === id);
          if (product) onChange(product);
        }}
      />
      {selected ? <ProductPrices product={selected} /> : null}
      <div className="record-sale__links">
        <SalesLink>Administrar productos en Ventas</SalesLink>
      </div>
    </>
  );
}
