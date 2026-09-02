import { useState, useCallback } from "react";
import { createFolder } from "../services/createFolder";

interface UseCreateFolderParams {
  /** Se invoca tras crear: el hub recarga la lista del servidor. */
  onFolderCreated: () => void;
}

/**
 * useCreateFolder — orquesta la creación de una carpeta.
 *
 * Responsabilidad única: estado del diálogo (abierto / en curso / error) y
 * llamada al servicio. No contiene JSX ni conoce el hub.
 *
 * No guarda la carpeta creada: la lista del servidor sigue siendo la única
 * fuente de verdad, así que al terminar sólo avisa para que el hub recargue.
 * Nada se persiste en el cliente.
 */
export function useCreateFolder({ onFolderCreated }: UseCreateFolderParams) {
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setError(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  const submit = useCallback(
    async (name: string) => {
      const trimmed = name.trim();

      // El diálogo ya lo impide; el hook no da por hecho quién lo llama.
      if (trimmed.length === 0 || busy) return;

      setBusy(true);
      setError(null);

      try {
        await createFolder(trimmed);
        setIsOpen(false);
        onFolderCreated();
      } catch {
        setError("No se pudo crear la carpeta. Inténtalo de nuevo.");
      } finally {
        setBusy(false);
      }
    },
    [busy, onFolderCreated]
  );

  return { isOpen, busy, error, open, close, submit };
}
