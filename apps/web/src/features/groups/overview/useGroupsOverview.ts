import { useCallback, useEffect, useState } from "react";
import type { GroupsOverviewResponse } from "@contracts/GroupContracts";
import { RequestError } from "@shared/http/RequestError";
import { groupsApi } from "../services/groupsApi";

export function useGroupsOverview() {
  const [data, setData] = useState<GroupsOverviewResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const refresh = useCallback(async () => {
    try {
      setData(await groupsApi.overview());
      setStatus("ready");
    } catch (error) {
      setStatus(error instanceof RequestError && error.status === 403 ? "forbidden" : "error");
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, status, refresh };
}
