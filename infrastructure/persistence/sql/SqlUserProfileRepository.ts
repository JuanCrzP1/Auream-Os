import type { UserProfile } from "../../../domains/profiles/domain/UserProfile";
import type { UserProfileRepository } from "../../../domains/profiles/application/UserProfileRepository";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlUserProfileRepository — `user_profiles` (028). Sin reglas de negocio.
// ---------------------------------------------------------------------------

interface ProfileRow {
  readonly user_id: string;
  readonly display_name: string | null;
  readonly phone: string | null;
  readonly photo_pathname: string | null;
  readonly photo_url: string | null;
}

export class SqlUserProfileRepository implements UserProfileRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async find(userId: string): Promise<UserProfile | null> {
    const result = await this.sql.query<ProfileRow>(
      "select user_id, display_name, phone, photo_pathname, photo_url from user_profiles where user_id = $1",
      [userId]
    );
    const row = result.rows[0];
    return row
      ? { userId: row.user_id, displayName: row.display_name, phone: row.phone, photoPathname: row.photo_pathname, photoUrl: row.photo_url }
      : null;
  }

  public async save(profile: UserProfile): Promise<void> {
    await this.sql.query(
      `insert into user_profiles (user_id, display_name, phone, photo_pathname, photo_url)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id) do update
         set display_name = excluded.display_name, phone = excluded.phone,
             photo_pathname = excluded.photo_pathname, photo_url = excluded.photo_url, updated_at = now()`,
      [profile.userId, profile.displayName, profile.phone, profile.photoPathname, profile.photoUrl]
    );
  }

  public async recordIdentity(userId: string, identity: { readonly email: string; readonly name?: string }): Promise<void> {
    // Solo escribe si algo cambió (se llama cada vez que la persona abre la
    // app) y nunca pisa el nombre que eligió en Mi perfil.
    await this.sql.query(
      `insert into user_profiles (user_id, email, display_name) values ($1, $2, $3)
       on conflict (user_id) do update
         set email = excluded.email,
             display_name = coalesce(user_profiles.display_name, excluded.display_name),
             updated_at = now()
       where user_profiles.email is distinct from excluded.email
          or (user_profiles.display_name is null and excluded.display_name is not null)`,
      [userId, identity.email, identity.name ?? null]
    );
  }
}
