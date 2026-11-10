import type { UserProfile } from "../domain/UserProfile";

// ---------------------------------------------------------------------------
// UserProfileRepository — puerto. La implementación SQL vive en
// `infrastructure/persistence/sql/SqlUserProfileRepository.ts`.
// ---------------------------------------------------------------------------

export interface UserProfileRepository {
  /** El perfil guardado, o `null` si la persona nunca lo editó. */
  find(userId: string): Promise<UserProfile | null>;
  /** Crea o reemplaza el perfil completo. */
  save(profile: UserProfile): Promise<void>;
  /**
   * Guarda lo que firma Neon Auth de la persona para mostrarla a su equipo:
   * su correo de acceso y, si nunca puso un nombre en Mi perfil, el nombre
   * con el que se registró. Nunca pisa un nombre elegido en Mi perfil.
   */
  recordIdentity(userId: string, identity: { readonly email: string; readonly name?: string }): Promise<void>;
}
