import { useCallback, useEffect, useRef, useState } from "react";
import type { FollowUpBucket, FollowUpListResponse, FollowUpSummary } from "@contracts/CrmActivityContracts";
import { crmApi } from "../services/crmApi";

/** Los seguimientos de un grupo (Vencidos · Hoy · Próximos · Hechos), de quien mira o de todos. */
export function useFollowUps(bucket: FollowUpBucket, assignee: "me" | "all", refreshKey: number) {
  const [data, setData] = useState<FollowUpListResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const response = await crmApi.followUps(bucket, assignee);
      if (id !== request.current) return;
      setData(response);
      setStatus("ready");
    } catch {
      if (id === request.current) setStatus("error");
    }
  }, [bucket, assignee]);

  useEffect(() => {
    setStatus("loading");
    void load();
  }, [load, refreshKey]);

  const toggle = useCallback(
    async (followUp: FollowUpSummary) => {
      await crmApi.updateFollowUp(followUp.id, { done: followUp.doneAt === null });
      await load();
    },
    [load]
  );

  return { data, status, reload: load, toggle };
}
