import type { NotificationFeed, NotificationKind } from "../../../contracts/NotificationContracts";
import { buildFeed } from "../domain/Signal";
import type { NotificationReads, SignalSource } from "./NotificationPorts";

export interface NotificationViewer {
  readonly tenantId: string;
  readonly userId: string;
  readonly kinds: ReadonlySet<NotificationKind>;
}

/** La campana: los avisos de quien mira y marcarlos como vistos. */
export class NotificationServices {
  public constructor(
    private readonly source: SignalSource,
    private readonly reads: NotificationReads,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly clock: () => Date = () => new Date()
  ) {}

  public async feed(viewer: NotificationViewer): Promise<NotificationFeed> {
    if (viewer.kinds.size === 0) return { items: [], unread: 0 };
    const [signals, seenAt] = await Promise.all([
      this.timezoneOf(viewer.tenantId).then((timezone) => this.source.read({ ...viewer, timezone, now: this.clock() })),
      this.reads.seenAt(viewer.tenantId, viewer.userId)
    ]);
    const items = buildFeed(signals, seenAt);
    return { items, unread: items.filter((item) => item.unread).length };
  }

  /** Abrir la campana: lo que hay hasta ahora deja de contar como nuevo. */
  public async markSeen(viewer: NotificationViewer): Promise<void> {
    await this.reads.markSeen(viewer.tenantId, viewer.userId, this.clock());
  }
}
