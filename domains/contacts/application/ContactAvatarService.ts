// ---------------------------------------------------------------------------
// La foto de perfil de WhatsApp de un contacto (como en Leona). WhatsApp solo
// da enlaces TEMPORALES, así que la foto se guarda y se renueva sola: cuando
// el contacto escribe y la última revisión tiene más de un día. Sin foto (o
// sin permiso para verla) se guarda vacía y la pantalla muestra las
// iniciales. Nunca interrumpe nada: si el proveedor falla, se reintenta otro día.
// ---------------------------------------------------------------------------

export interface ContactAvatarStore {
  /** El contacto de ese teléfono y cuándo se revisó su foto (`null`: nunca). `null` si no existe. */
  findByPhone(tenantId: string, phone: string): Promise<{ readonly contactId: string; readonly checkedAt: string | null } | null>;
  save(tenantId: string, contactId: string, avatarUrl: string | null, checkedAt: string): Promise<void>;
}

/** Cada cuánto se vuelve a pedir la foto de un contacto. */
export const AVATAR_REFRESH_MS = 24 * 60 * 60_000;

export class ContactAvatarService {
  public constructor(
    private readonly store: ContactAvatarStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  /**
   * Renueva la foto del contacto de ese teléfono si toca. `fetchPicture` la
   * pide al proveedor (por el número que atiende el chat). Devuelve si la revisó.
   */
  public async refreshIfStale(tenantId: string, phone: string, fetchPicture: () => Promise<string | null>): Promise<boolean> {
    const contact = await this.store.findByPhone(tenantId, phone);
    const now = this.now();
    if (!contact || (contact.checkedAt && now.getTime() - Date.parse(contact.checkedAt) < AVATAR_REFRESH_MS)) return false;
    let url: string | null;
    try {
      url = await fetchPicture();
    } catch {
      return false;
    }
    await this.store.save(tenantId, contact.contactId, url, now.toISOString());
    return true;
  }
}
