import "./download-sales.css";
import { useState } from "react";
import { SALES_EXPORT_MAX_ROWS, type DashboardFilters } from "@contracts/DashboardContracts";
import { saveFile } from "@shared/files/saveFile";
import { dashboardApi } from "../../services/dashboardApi";

type State = { readonly kind: "idle" } | { readonly kind: "busy" } | { readonly kind: "done"; readonly text: string } | { readonly kind: "failed" };

const count = (n: number) => n.toLocaleString("es-CO");

/**
 * «Descargar ventas»: baja un CSV (abre en Excel y Google Sheets) con las
 * ventas aprobadas de lo que se mira: periodo, línea, filtros y moneda. Al
 * terminar dice cuántas trajo y, si pasaron del tope, que eligió menos días.
 */
export function DownloadSalesButton({ filters, sales }: {
  readonly filters: DashboardFilters;
  /** Cuántas ventas hay en lo que se mira (para el botón). */
  readonly sales: number;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const download = async () => {
    setState({ kind: "busy" });
    try {
      const file = await dashboardApi.exportSales(filters);
      saveFile(file.blob, file.filename);
      setState({
        kind: "done",
        text: file.truncated
          ? `Se descargaron las ${count(SALES_EXPORT_MAX_ROWS)} más recientes. Para el resto, elige menos días.`
          : `Listo: ${file.rows === 1 ? "1 venta" : `${count(file.rows)} ventas`}.`
      });
    } catch {
      setState({ kind: "failed" });
    }
  };

  return (
    <div className="download-sales">
      <button type="button" className="download-sales__btn" disabled={state.kind === "busy" || sales === 0} onClick={() => void download()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11M7 10.5 12 15.5l5-5M5 19.5h14" />
        </svg>
        {state.kind === "busy" ? "Preparando…" : sales === 0 ? "Sin ventas para descargar" : `Descargar ${sales === 1 ? "1 venta" : `${count(sales)} ventas`}`}
      </button>
      <span className="download-sales__status" role="status">
        {state.kind === "done" ? state.text : state.kind === "failed" ? "No se pudo descargar. Vuelve a intentarlo." : ""}
      </span>
    </div>
  );
}
