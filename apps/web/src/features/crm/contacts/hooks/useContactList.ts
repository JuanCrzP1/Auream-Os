import { useCallback, useEffect, useRef, useState } from "react";
import type { ContactSummary } from "@contracts/ContactContracts";
import { fetchContacts } from "../services/contactsApi";

const PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 300;

/**
 * useContactList — lista paginada de contactos con búsqueda y filtro por
 * etiqueta. La búsqueda espera a que se deje de escribir; una respuesta vieja
 * nunca pisa a una más nueva.
 */
export function useContactList() {
  const [search, setSearch] = useState("");
  const [labelId, setLabelId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setStatus("loading");
    try {
      const result = await fetchContacts({ search, ...(labelId ? { labelId } : {}), page, limit: PAGE_SIZE });
      if (request !== latest.current) return;
      setContacts([...result.contacts]);
      setHasMore(result.hasMore);
      setStatus("ready");
    } catch {
      if (request === latest.current) setStatus("error");
    }
  }, [search, labelId, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? SEARCH_DELAY_MS : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  return {
    contacts,
    hasMore,
    status,
    search,
    labelId,
    page,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    setLabelId: (value: string | null) => {
      setLabelId(value);
      setPage(1);
    },
    setPage,
    reload: load,
    /** Sustituye un contacto ya actualizado por el servidor, sin recargar todo. */
    replace: (updated: ContactSummary) => setContacts((current) => current.map((c) => (c.id === updated.id ? updated : c)))
  };
}
