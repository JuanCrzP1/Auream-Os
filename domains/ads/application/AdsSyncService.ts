import { ADS_FIRST_SYNC_DAYS, ADS_SYNC_EVERY_HOURS } from "../../../contracts/AdsContracts";
import { AdsProviderError, type AdsProvider, type AdsRepository, type AdsSyncScheduler, type TokenCipher } from "./AdsPorts";
import { tokenContext } from "./AdConnectionServices";

// ---------------------------------------------------------------------------
// AdsSyncService — trae de Meta las campañas, conjuntos y anuncios de una
// cuenta y lo que gastó cada anuncio por día. Corre en la cola de tareas:
//
//   · La primera vez trae 31 días y deja programada otra vuelta para los 31
//     anteriores (así el Dashboard compara con el periodo anterior).
//   · Después, cada 3 horas, los últimos 7 días (Meta corrige los recientes).
//   · Si el token ya no sirve, lo anota y espera a que vuelvan a conectar.
//
// Nunca lanza: el fallo queda en la cuenta y se reintenta en la próxima vuelta.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const HALF = Math.ceil(ADS_FIRST_SYNC_DAYS / 2);

export interface SyncWindow {
  readonly since: string;
  readonly until: string;
}

/** `YYYY-MM-DD` de `date` en la zona de la cuenta (las fechas de Meta van en esa zona). */
export function dayIn(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export class AdsSyncService {
  public constructor(
    private readonly repository: AdsRepository,
    private readonly provider: AdsProvider,
    private readonly cipher: TokenCipher,
    private readonly scheduler: AdsSyncScheduler,
    private readonly onError: (error: unknown, context: Record<string, unknown>) => void,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async sync(tenantId: string, accountId: string, window?: SyncWindow): Promise<void> {
    const [connection, account] = await Promise.all([this.repository.connection(tenantId), this.repository.account(tenantId, accountId)]);
    if (!connection || !account || !account.enabled) return;
    const now = this.now();
    const day = (offset: number) => dayIn(new Date(now.getTime() - offset * DAY_MS), account.timezone);
    const first = account.lastSyncedAt === null && !window;
    const range = window ?? { since: day(first ? HALF - 1 : 6), until: day(0) };
    try {
      const token = this.cipher.decrypt(connection.tokenCiphertext, tokenContext(tenantId));
      await this.repository.saveEntities(tenantId, accountId, await this.provider.entities(token, account.externalId));
      await this.repository.saveInsights(tenantId, accountId, range.since, range.until, await this.provider.insights(token, account.externalId, range.since, range.until));
      await this.repository.markSynced(tenantId, accountId, null);
      if (connection.lastError) await this.repository.setConnectionError(tenantId, null);
      if (first) await this.scheduler.scheduleSync(tenantId, accountId, now, { since: day(ADS_FIRST_SYNC_DAYS - 1), until: day(HALF) });
      if (!window) await this.scheduler.scheduleSync(tenantId, accountId, new Date(now.getTime() + ADS_SYNC_EVERY_HOURS * 3_600_000));
    } catch (error) {
      const message = error instanceof AdsProviderError ? error.message : "No se pudo sincronizar con Meta. Se reintenta en la próxima vuelta.";
      await this.repository.markSynced(tenantId, accountId, message);
      if (error instanceof AdsProviderError && error.reconnect) {
        await this.repository.setConnectionError(tenantId, message);
        return;
      }
      this.onError(error, { step: "ads.sync", tenantId, accountId });
      if (!window) await this.scheduler.scheduleSync(tenantId, accountId, new Date(now.getTime() + ADS_SYNC_EVERY_HOURS * 3_600_000));
    }
  }
}
