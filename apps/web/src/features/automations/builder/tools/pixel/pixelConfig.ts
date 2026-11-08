// La forma de la configuración es el contrato compartido con el motor
// (`contracts/PixelConfig.ts`): una conexión de píxel de la cuenta, el evento,
// su valor y la página del anuncio. Ni el ID del píxel ni el token viven aquí.
export {
  PIXEL_DEFAULT_CONFIG,
  PIXEL_EVENT_LABELS,
  PIXEL_EVENTS,
  readPixelConfig,
  type PixelConfig,
  type PixelEvent
} from "@contracts/PixelConfig";
