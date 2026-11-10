import type { ConfirmImageRequest, ImageUploadRequest, MyProfileResponse, UpdateMyProfileRequest } from "../../../contracts/AccountContracts";
import type { MediaUploadTicket } from "../../../contracts/MediaContracts";
import type { ImageUploads } from "../../media/application/ImageUploads";
import { emptyProfile, normalizeDisplayName, normalizePhone, userPhotoFolder, type UserProfile } from "../domain/UserProfile";
import type { UserProfileRepository } from "./UserProfileRepository";

// ---------------------------------------------------------------------------
// Mi perfil: leer y cambiar el nombre visible, el WhatsApp personal y la foto
// de la persona que pregunta. Siempre de SÍ MISMA: el `userId` sale de la
// identidad verificada, nunca de la petición.
//
// La foto: permiso de subida a su carpeta → el navegador sube → `setPhoto`
// comprueba lo subido, la guarda y borra la anterior.
// ---------------------------------------------------------------------------

export function toProfileResponse(profile: UserProfile): MyProfileResponse {
  return { displayName: profile.displayName, phone: profile.phone, photoUrl: profile.photoUrl };
}

export class ProfileServices {
  public constructor(
    private readonly repository: UserProfileRepository,
    /** `null` sin almacén de archivos: no hay fotos (la API responde 503). */
    private readonly images: ImageUploads | null
  ) {}

  public get canUploadPhotos(): boolean {
    return this.images !== null;
  }

  public async get(userId: string): Promise<MyProfileResponse> {
    return toProfileResponse(await this.load(userId));
  }

  public async update(userId: string, input: Partial<UpdateMyProfileRequest>): Promise<MyProfileResponse> {
    const current = await this.load(userId);
    const next: UserProfile = {
      ...current,
      ...(input.displayName !== undefined ? { displayName: normalizeDisplayName(input.displayName) } : {}),
      ...(input.phone !== undefined ? { phone: normalizePhone(input.phone) } : {})
    };
    await this.repository.save(next);
    return toProfileResponse(next);
  }

  public photoTicket(userId: string, input: Partial<ImageUploadRequest>): Promise<MediaUploadTicket> {
    return this.requireImages().ticket(userPhotoFolder(userId), `user:${userId}`, input);
  }

  public async setPhoto(userId: string, input: Partial<ConfirmImageRequest>): Promise<MyProfileResponse> {
    const images = this.requireImages();
    const folder = userPhotoFolder(userId);
    const photo = await images.confirm(folder, input.pathname);
    const current = await this.load(userId);
    const next: UserProfile = { ...current, photoPathname: photo.pathname, photoUrl: photo.url };
    await this.repository.save(next);
    if (current.photoPathname !== photo.pathname) await images.discard(folder, current.photoPathname);
    return toProfileResponse(next);
  }

  public async removePhoto(userId: string): Promise<MyProfileResponse> {
    const current = await this.load(userId);
    if (!current.photoPathname) return toProfileResponse(current);
    const next: UserProfile = { ...current, photoPathname: null, photoUrl: null };
    await this.repository.save(next);
    await this.images?.discard(userPhotoFolder(userId), current.photoPathname);
    return toProfileResponse(next);
  }

  private async load(userId: string): Promise<UserProfile> {
    return (await this.repository.find(userId)) ?? emptyProfile(userId);
  }

  private requireImages(): ImageUploads {
    if (!this.images) throw new Error("No hay almacén de archivos para las fotos.");
    return this.images;
  }
}
