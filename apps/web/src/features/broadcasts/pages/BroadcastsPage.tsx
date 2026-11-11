import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import { useSearchParams } from "react-router-dom";
import { BroadcastDetail } from "../detail/BroadcastDetail";
import { BroadcastsList } from "../list/BroadcastsList";
import { NewBroadcast } from "../wizard/NewBroadcast";

/**
 * Difusiones: la lista con lo que vendió cada una, crear una nueva (4 pasos)
 * y cada difusión por dentro. Dónde está la persona viaja en la dirección:
 * `?view=new` o `?id=<difusión>`.
 */
export function BroadcastsPage() {
  const [params, setParams] = useSearchParams();
  const open = (next: Record<string, string>) => setParams(next);
  const id = params.get("id");

  if (params.get("view") === "new") return <NewBroadcast onClose={() => open({})} onCreated={(created) => open({ id: created })} />;
  if (id) return <BroadcastDetail id={id} onBack={() => open({})} onOpen={(next) => open({ id: next })} />;
  return <BroadcastsList onNew={() => open({ view: "new" })} onOpen={(next) => open({ id: next })} />;
}
