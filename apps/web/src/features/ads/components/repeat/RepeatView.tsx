import "./repeat.css";
import { useEffect, useState } from "react";
import type { AdLevel } from "@contracts/DashboardContracts";
import { DEFAULT_REPEAT_WINDOW, REPEAT_WINDOWS, type AdsRepeatResponse, type RepeatWindow } from "@contracts/AdsRepeatContracts";
import { adsApi } from "@shared/ads/adsApi";
import { formatRoas } from "@shared/ads/adsFormat";
import { RepeatTable } from "./RepeatTable";

/**
 * Meta Ads › Rendimiento › «Con recompras»: qué tan buenos son los clientes
 * que trae cada anuncio. Ventana de 30, 60 o 90 días desde su primera compra;
 * si el periodo es reciente, avisa que las cifras aún están madurando.
 */
export function RepeatView({ level, from, to }: { readonly level: AdLevel; readonly from: string; readonly to: string }) {
  const [windowDays, setWindowDays] = useState<RepeatWindow>(DEFAULT_REPEAT_WINDOW);
  const [data, setData] = useState<AdsRepeatResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    adsApi.repeat({ from, to }, level, windowDays).then((response) => alive && setData(response)).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [level, from, to, windowDays]);

  if (failed) return <p className="ui-error" role="alert">No pudimos cargar las recompras. Vuelve a intentarlo en unos segundos.</p>;
  if (!data) return <div className="ads-performance__loading" aria-busy="true" aria-label="Cargando las recompras" />;

  const t = data.totals;
  return (
    <div className="repeat-view">
      <div className="repeat-view__bar">
        <p className="repeat-view__intro">
          Los <strong>clientes nuevos</strong> de cada anuncio (su primera compra vino de ahí) y lo que <strong>volvieron a comprar</strong> después, con o sin
          anuncio. Es otra mirada: no se suma al ROAS real.
        </p>
        <div className="repeat-view__window">
          <span className="repeat-view__window-label" id="repeat-window-label">Recompras</span>
          <div className="ads-performance__group" role="group" aria-labelledby="repeat-window-label">
            {REPEAT_WINDOWS.map((days) => (
              <button key={days} type="button" aria-pressed={windowDays === days} className="ads-performance__toggle" onClick={() => setWindowDays(days)}>
                a {days} días
              </button>
            ))}
          </div>
        </div>
      </div>
      {data.maturingDays > 0 ? (
        <p className="repeat-view__maturing" role="note">
          ⏳ Aún madurando: faltan <strong>{data.maturingDays} {data.maturingDays === 1 ? "día" : "días"}</strong> para que todos los clientes de este periodo
          cumplan {data.window} días. Las recompras pueden seguir subiendo.
        </p>
      ) : null}
      {data.rows.length === 0 ? (
        <p className="ui-muted">Sin clientes nuevos por anuncio en este periodo.</p>
      ) : (
        <>
          <p className="ui-muted repeat-view__summary">
            {t.newCustomers} clientes nuevos · ROAS de nuevos {formatRoas(t.newRoas)} · ROAS a {data.window} días <strong>{formatRoas(t.windowRoas)}</strong>
          </p>
          <RepeatTable data={data} />
        </>
      )}
    </div>
  );
}
