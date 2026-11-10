import { useCallback, useEffect, useRef, useState } from "react";
import type { ContactCrmResponse } from "@contracts/CrmActivityContracts";
import { crmApi } from "../services/crmApi";

/** Lo que el CRM sabe de un cliente (etapas, seguimientos, historial). `reload` tras cada cambio. */
export function useContactCrm(contactId: string) {
  const [data, setData] = useState<ContactCrmResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const response = await crmApi.contact(contactId);
      if (id === request.current) {
        setData(response);
        setFailed(false);
      }
    } catch {
      if (id === request.current) setFailed(true);
    }
  }, [contactId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, failed, reload };
}
