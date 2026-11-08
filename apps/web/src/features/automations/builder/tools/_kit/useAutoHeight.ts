import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * ¿El navegador dimensiona el campo por su contenido (`field-sizing`)? Ahí NO
 * se toca el alto desde JavaScript: un `height` en línea ganaría al nativo y lo
 * congelaría en el valor del montaje.
 */
const NATIVE_FIELD_SIZING =
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");

/**
 * Textarea que crece con su contenido hasta el tope del CSS.
 *
 * Solo se escribe `height`, nunca el ancho: el ancho lo fija el contenedor, el
 * navegador reparte renglones y `scrollHeight` los refleja.
 *
 * Se observa el CONTENEDOR (su ancho reparte el texto), no el campo: observar
 * el campo y escribirle `height` en el callback es un bucle que el navegador
 * corta, y el alto dejaba de actualizarse. Por lo mismo, el alto se escribe un
 * fotograma después, fuera del callback.
 */
export function useAutoHeight(value: string): RefObject<HTMLTextAreaElement> {
  const ref = useRef<HTMLTextAreaElement>(null);
  const previousWidth = useRef(0);

  const fit = useCallback(() => {
    if (NATIVE_FIELD_SIZING) return;
    const element = ref.current;
    if (!element) return;

    // Reiniciar antes de medir, o no volvería a bajar al borrar.
    element.style.height = "auto";
    const height = element.scrollHeight;
    // 0 donde no hay maquetación (jsdom): ahí manda el mínimo del CSS.
    if (height > 0) element.style.height = `${height}px`;
  }, []);

  useLayoutEffect(fit, [fit, value]);

  useLayoutEffect(() => {
    const element = ref.current;
    const container = element?.parentElement;
    if (NATIVE_FIELD_SIZING || !element || !container || typeof ResizeObserver === "undefined") return;

    previousWidth.current = container.clientWidth;
    let frame = 0;

    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      if (width === previousWidth.current) return;
      previousWidth.current = width;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });

    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [fit]);

  return ref;
}
