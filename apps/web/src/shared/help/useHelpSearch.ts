import { useEffect, useState } from "react";
import type { ArticleSummary } from "@contracts/HelpContracts";
import { helpApi } from "./helpApi";

const WAIT_MS = 250;

/** Busca en la ayuda mientras se escribe (desde 2 letras). `null` = no hay búsqueda. */
export function useHelpSearch(query: string): ReadonlyArray<ArticleSummary> | null {
  const [results, setResults] = useState<ReadonlyArray<ArticleSummary> | null>(null);
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = window.setTimeout(() => void helpApi.search(query.trim()).then(setResults).catch(() => setResults([])), WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [query]);
  return results;
}
