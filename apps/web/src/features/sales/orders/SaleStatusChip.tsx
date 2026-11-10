import "./sale-status.css";
import type { SaleStatus } from "@contracts/SalesContracts";
import { SALE_STATUS_LABEL } from "../salesFormat";

export function SaleStatusChip({ status }: { readonly status: SaleStatus }) {
  return <span className={`sale-status sale-status--${status}`}>{SALE_STATUS_LABEL[status]}</span>;
}
