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
}
