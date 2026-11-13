import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import { useSearchParams } from "react-router-dom";
import { CampaignDetail } from "../campaign/CampaignDetail";
import { CampaignEditor } from "../editor/CampaignEditor";
import { GroupsOverview } from "../overview/GroupsOverview";
import { SendToGroups } from "../send/SendToGroups";

/**
 * Grupos y comunidades: campañas con un enlace que llena grupos, mis grupos,
 * enviar a muchos grupos y cada campaña por dentro. Dónde está la persona
 * viaja en la dirección: `?tab=mine`, `?campaign=<id>`, `?view=new`,
 * `?edit=<id>` o `?view=send[&to=<campaña>][&group=<grupo>]`.
 */
export function GroupsPage() {
  const [params, setParams] = useSearchParams();
  const open = (next: Record<string, string>) => setParams(next);
  const campaign = params.get("campaign");
  const edit = params.get("edit");
  const view = params.get("view");

  if (view === "new" || edit) return <CampaignEditor campaignId={edit} onClose={() => open(edit ? { campaign: edit } : {})} onSaved={(id) => open({ campaign: id })} />;
  if (view === "send") return <SendToGroups preset={params.get("to")} presetGroup={params.get("group")} onClose={() => open(params.get("to") ? { campaign: params.get("to")! } : {})} onSent={() => open(params.get("to") ? { campaign: params.get("to")! } : {})} />;
  if (campaign) return <CampaignDetail id={campaign} onBack={() => open({})} onEdit={() => open({ edit: campaign })} onSend={(group) => open({ view: "send", to: campaign, ...(group ? { group } : {}) })} />;
  return (
    <GroupsOverview
      tab={params.get("tab") === "mine" ? "mine" : "campaigns"}
      onTab={(tab) => open(tab === "mine" ? { tab } : {})}
      onOpen={(id) => open({ campaign: id })}
      onNew={() => open({ view: "new" })}
      onSend={() => open({ view: "send" })}
    />
  );
}
