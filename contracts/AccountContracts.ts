// ---------------------------------------------------------------------------
// Cuenta del usuario: Mi perfil y Empresa — contratos compartidos por la API y
// el frontend.
//
//   Mi perfil  nombre visible, WhatsApp personal y foto (por usuario)
//   Empresa    nombre, logo y zona horaria (por cuenta; la zona la usan el
//              Programador, los horarios y las fechas de los flujos)
//
// El correo y la contraseña NO viajan aquí: son credenciales y su única
// autoridad es Neon Auth.
//
// Las imágenes se suben como los medios: permiso de un solo uso, los bytes van
// directo al almacén y el servidor comprueba lo que quedó (`MediaUploadTicket`).
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;

/** Fotos de perfil y logos: formatos de imagen comunes, hasta 5 MB. */
export const ACCOUNT_IMAGE_RULE = {
  maxBytes: 5 * MB,
  contentTypes: ["image/jpeg", "image/png", "image/webp"]
} as const;

/** Pedir permiso para subir una foto o un logo. */
export interface ImageUploadRequest {
  readonly contentType: string;
  readonly size: number;
}

/** Usar una imagen ya subida (la ruta que dio el permiso). */
export interface ConfirmImageRequest {
  readonly pathname: string;
}

/** `GET /me/profile`. `displayName` nulo: aún usa el nombre con el que se registró. */
export interface MyProfileResponse {
  readonly displayName: string | null;
  /** Formato internacional, p. ej. `+573001234567`. */
  readonly phone: string | null;
  readonly photoUrl: string | null;
}

/** `PATCH /me/profile`. Lo que no viene no cambia; `phone: null` lo borra. */
export interface UpdateMyProfileRequest {
  readonly displayName?: string;
  readonly phone?: string | null;
}

/** `GET /company`. */
export interface CompanyResponse {
  readonly name: string;
  /** La zona en uso (la propia o la de la plataforma). */
  readonly timezone: string;
  /** `true` si la empresa no eligió una y usa la de la plataforma. */
  readonly timezoneIsDefault: boolean;
  readonly logoUrl: string | null;
  /** Si quien pregunta puede cambiarla (dueños de la cuenta). */
  readonly canEdit: boolean;
}

/** `PATCH /company`. Lo que no viene no cambia; `timezone: null` vuelve a la de la plataforma. */
export interface UpdateCompanyRequest {
  readonly name?: string;
  readonly timezone?: string | null;
}
