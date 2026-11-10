import {
  ACCOUNT_IMAGE_RULE,
  type CompanyResponse,
  type MyProfileResponse,
  type UpdateCompanyRequest,
  type UpdateMyProfileRequest
} from "@contracts/AccountContracts";
import type { MediaUploadTicket } from "@contracts/MediaContracts";
import { builderApiClient } from "@shared/http/builderApiClient";
import { putToStorage, type UploadProgress } from "@shared/media/putToStorage";

// ---------------------------------------------------------------------------
// Mi perfil y Empresa contra la API. Las imágenes (foto y logo) se suben como
// los medios: permiso → bytes directo al almacén → el servidor comprueba lo
// subido y lo guarda (y borra la anterior).
// ---------------------------------------------------------------------------

export const fetchMyProfile = () => builderApiClient.get<MyProfileResponse>("/me/profile");
export const updateMyProfile = (input: UpdateMyProfileRequest) => builderApiClient.patch<MyProfileResponse>("/me/profile", input);
export const removeProfilePhoto = () => builderApiClient.delete<MyProfileResponse>("/me/profile/photo");

export const fetchCompany = () => builderApiClient.get<CompanyResponse>("/company");
export const updateCompany = (input: UpdateCompanyRequest) => builderApiClient.patch<CompanyResponse>("/company", input);
export const removeCompanyLogo = () => builderApiClient.delete<CompanyResponse>("/company/logo");

/** Lo que el navegador puede comprobar antes de subir (el servidor lo vuelve a comprobar). */
export function imageProblem(file: File): string | null {
  if (!(ACCOUNT_IMAGE_RULE.contentTypes as ReadonlyArray<string>).includes(file.type)) return "La imagen debe ser JPG, PNG o WebP.";
  if (file.size > ACCOUNT_IMAGE_RULE.maxBytes) return "La imagen supera el máximo de 5 MB.";
  return null;
}

async function uploadImage<T>(base: string, file: File, onProgress: UploadProgress): Promise<T> {
  const ticket = await builderApiClient.post<MediaUploadTicket>(`${base}/uploads`, { contentType: file.type, size: file.size });
  await putToStorage(ticket, file, file.type, onProgress);
  return builderApiClient.put<T>(base, { pathname: ticket.pathname });
}

export const uploadProfilePhoto = (file: File, onProgress: UploadProgress = () => {}) => uploadImage<MyProfileResponse>("/me/profile/photo", file, onProgress);
export const uploadCompanyLogo = (file: File, onProgress: UploadProgress = () => {}) => uploadImage<CompanyResponse>("/company/logo", file, onProgress);

/** Para el selector de archivos. */
export const ACCOUNT_IMAGE_ACCEPT = ACCOUNT_IMAGE_RULE.contentTypes.join(",");
