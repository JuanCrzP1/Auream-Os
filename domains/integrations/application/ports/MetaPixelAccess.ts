/**
 * Lo que el dominio necesita de Meta para administrar píxeles: comprobar que
 * el token tiene acceso a ese píxel. Lo implementa `MetaConversionsClient`.
 */
export type PixelAccessCheck =
  | { readonly ok: true; readonly pixelName?: string }
  | { readonly ok: false; readonly reason: "invalid_token" | "pixel_not_found" | "unavailable"; readonly message: string };

export interface MetaPixelAccess {
  verifyPixel(pixelId: string, accessToken: string): Promise<PixelAccessCheck>;
}
