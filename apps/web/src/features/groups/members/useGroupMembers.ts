import { useCallback, useEffect, useRef, useState } from "react";
import type { GroupMemberFilter, GroupMembersPage, GroupMemberView } from "@contracts/GroupMemberContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { groupsApi } from "../services/groupsApi";

const SEARCH_DELAY_MS = 300;

/**
 * La lista de miembros de un grupo: el filtro, la búsqueda (espera a que se
 * deje de escribir), «Ver más» y recargar. `summary` son los conteos SIN
 * búsqueda (el resumen de arriba no cambia mientras se busca).
 */
export function useGroupMembers(groupId: string) {
  const [filter, setFilter] = useState<GroupMemberFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<GroupMembersPage | null>(null);
  const [summary, setSummary] = useState<GroupMembersPage | null>(null);
  const [rows, setRows] = useState<GroupMemberView[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // Solo cuenta la última respuesta: cambiar rápido de filtro no mezcla listas.
    const ticket = ++latest.current;
    setError(null);
    groupsApi
      .members(groupId, filter, query)
      .then((first) => {
        if (ticket !== latest.current) return;
        setPage(first);
        setRows([...first.members]);
        if (!query) setSummary(first);
      })
      .catch((cause) => ticket === latest.current && setError(apiErrorMessage(cause, "No pudimos cargar los miembros. Vuelve a intentarlo.")));
  }, [groupId, filter, query, reloads]);

  const more = useCallback(async () => {
    if (page?.nextOffset === null || page?.nextOffset === undefined) return;
    setLoadingMore(true);
    try {
      const next = await groupsApi.members(groupId, filter, query, page.nextOffset);
      setPage(next);
      setRows((current) => [...current, ...next.members]);
    } catch (cause) {
      setError(apiErrorMessage(cause, "No pudimos cargar más miembros."));
    } finally {
      setLoadingMore(false);
    }
  }, [groupId, filter, query, page]);

  const reload = useCallback(() => setReloads((value) => value + 1), []);

  return { filter, setFilter, search, setSearch, searching: query !== "", page, summary, rows, more, loadingMore, error, reload };
}
