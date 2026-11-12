import { useEffect, useState } from "react";
import { adsApi } from "@shared/ads/adsApi";
import { formatCop } from "@shared/ads/adsFormat";
import type { CheckItem } from "./CheckList";

/**
 * Las campañas de Meta con gasto en el periodo, para elegirlas en Filtros y
 * en las líneas (con lo que gastó cada una). Sin acceso a los anuncios: `null`.
 */
export function useCampaignOptions(range: { readonly from: string; readonly to: string }, enabled: boolean): ReadonlyArray<CheckItem> | null {
  const [items, setItems] = useState<ReadonlyArray<CheckItem>>([]);
  const key = `${range.from}:${range.to}:${enabled}`;

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    adsApi
      .performance(range, "campaign")
      .then((response) => alive && setItems(response.rows.map((row) => ({ id: row.id, label: row.name, hint: formatCop(row.spend, response.currency) }))))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
    // `key` resume el periodo y el permiso (el objeto `range` cambia en cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return enabled ? items : null;
}
