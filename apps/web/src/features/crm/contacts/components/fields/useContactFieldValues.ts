import { useCallback, useEffect, useState } from "react";
import type { ContactFieldValuesResponse } from "@contracts/ContactFieldValueContracts";
import { fetchContactFieldValues } from "@shared/contact-fields/contactFieldsApi";

export type ContactFieldValuesState = { readonly status: "loading" } | { readonly status: "error" } | { readonly status: "ready"; readonly data: ContactFieldValuesResponse };

/** Los datos de la ficha de un cliente y de dónde salió cada uno (se vuelven a pedir al abrirla). */
export function useContactFieldValues(contactId: string) {
  const [state, setState] = useState<ContactFieldValuesState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await fetchContactFieldValues(contactId) });
    } catch {
      setState({ status: "error" });
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
